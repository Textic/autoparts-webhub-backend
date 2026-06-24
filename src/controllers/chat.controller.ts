import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import pool from '../config/db';

// Initialize the Google GenAI SDK. It automatically loads GEMINI_API_KEY from environment variables.
const ai = new GoogleGenAI({});

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Missing required field: message' });
      return;
    }

    // Prepare contents array for the multi-turn conversation
    let contents: any[] = [];
    if (history && Array.isArray(history)) {
      contents = [...history];
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const systemInstruction = 'Eres el asistente de IA de AutoParts WebHub. Ayuda al usuario a buscar repuestos, verificar stock y agendar citas de retiro. Sé conciso, profesional y responde siempre en español.';

    const tools: any = [
      {
        functionDeclarations: [
          {
            name: 'check_part_stock',
            description: 'Searches for the available stock, category, location, and price of a spare part using its SKU or name.',
            parameters: {
              type: 'object',
              properties: {
                search_term: {
                  type: 'string',
                  description: 'The SKU or name of the spare part to search for.',
                },
              },
              required: ['search_term'],
            },
          },
          {
            name: 'schedule_pickup_appointment',
            description: 'Schedules a new appointment for a client to pick up a spare part in the physical store. The status of the new appointment will automatically be pending.',
            parameters: {
              type: 'object',
              properties: {
                user_id: {
                  type: 'integer',
                  description: 'The ID of the user/client making the pickup.',
                },
                part_id: {
                  type: 'integer',
                  description: 'The ID of the spare part to be picked up.',
                },
                quantity: {
                  type: 'integer',
                  description: 'The quantity of parts to pick up. Defaults to 1 if not specified.',
                },
                date: {
                  type: 'string',
                  description: 'The date of the appointment in YYYY-MM-DD format.',
                },
                time: {
                  type: 'string',
                  description: 'The time of the appointment in HH:MM format (24-hour clock).',
                },
              },
              required: ['user_id', 'part_id', 'date', 'time'],
            },
          }
        ]
      }
    ];

    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: contents,
      config: {
        systemInstruction,
        tools
      }
    });

    let loopCount = 0;
    // Maximum 5 iterations to prevent infinite loops in case of model issues
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
      loopCount++;

      // 1. Save the model's turn with the function calls to our conversation history
      contents.push(response.candidates?.[0]?.content || {
        role: 'model',
        parts: [{ functionCall: response.functionCalls[0] }]
      });

      const toolParts: any[] = [];

      for (const call of response.functionCalls) {
        const { name, args } = call;
        let result: any;

        try {
          if (name === 'check_part_stock') {
            const searchTerm = (args as any).search_term;
            console.log(`[Tool check_part_stock] Recibido search_term: "${searchTerm}"`);
            const words = searchTerm.split(/\s+/).filter(Boolean);
            let sql = `
              SELECT DISTINCT p.id, p.sku, p.name, p.category, p.price, p.available_stock, p.warehouse_location
              FROM parts p
              LEFT JOIN part_compatibilities pc ON p.id = pc.part_id
              LEFT JOIN vehicles v ON pc.vehicle_id = v.id
            `;
            const conditions: string[] = [];
            const params: any[] = [];

            if (words.length > 0) {
              words.forEach((word: string) => {
                conditions.push(`(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR CAST(v.manufacturing_year AS CHAR) LIKE ?)`);
                const wild = `%${word}%`;
                params.push(wild, wild, wild, wild, wild, wild);
              });
              sql += ` WHERE ` + conditions.join(' AND ');
            }
            console.log(`[Tool check_part_stock] Ejecutando query con palabras:`, words);
            const [rows] = await pool.query(sql, params);
            console.log(`[Tool check_part_stock] Encontrados ${Array.isArray(rows) ? rows.length : 0} resultados:`, rows);
            result = rows;
          } else if (name === 'schedule_pickup_appointment') {
            console.log(`[Tool schedule_pickup_appointment] Recibido args:`, args);
            const { user_id, part_id, quantity, date, time } = args as any;

            // Obtener configuración del sistema de la DB
            const [settingsRows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
            const settingsMap = new Map((settingsRows as any[]).map(row => [row.setting_key, row.setting_value]));

            const limitStr = settingsMap.get('hourly_appointment_limit') || '20';
            const startTimeStr = settingsMap.get('allow_start_time') || '09:00';
            const endTimeStr = settingsMap.get('allow_end_time') || '17:30';

            const maxAllowed = parseInt(limitStr, 10);
            const [startH, startM] = startTimeStr.split(':').map(Number);
            const [endH, endM] = endTimeStr.split(':').map(Number);
            const minTime = startH * 60 + startM;
            const maxTime = endH * 60 + endM;

            // 1. Validar horario (allow_start_time - allow_end_time)
            const parts = time.split(':');
            const hour = parseInt(parts[0], 10);
            const minute = parseInt(parts[1], 10);
            const timeInMinutes = hour * 60 + minute;

            if (isNaN(timeInMinutes) || timeInMinutes < minTime || timeInMinutes > maxTime) {
              result = { 
                status: 'error', 
                error: `El horario de retiro permitido es únicamente entre las ${startTimeStr} y las ${endTimeStr}.` 
              };
            } else {
              // 2. Validar límite por hora (Máximo X citas en la misma hora)
              const countSql = `
                SELECT COUNT(*) as count 
                FROM appointments 
                WHERE appointment_date = ? 
                  AND HOUR(appointment_time) = ?
              `;
              const [countRows] = await pool.query(countSql, [date, hour]);
              const currentCount = (countRows as any)[0]?.count || 0;

              if (currentCount >= maxAllowed) {
                result = { 
                  status: 'error', 
                  error: `Lo sentimos, el cupo de retiro para el bloque de las ${hour}:00 a las ${hour}:59 está completo (límite de ${maxAllowed} citas por hora). Por favor, elige o sugiere otra hora.` 
                };
              } else {
                // 3. Crear cita
                const qty = quantity || 1;
                const sql = `
                  INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
                  VALUES (?, ?, ?, ?, ?, 'pending', 1)
                `;
                const [insertResult] = await pool.query(sql, [user_id, part_id, qty, date, time]);
                const insertId = (insertResult as any).insertId;
                result = { status: 'success', appointment_id: insertId };
              }
            }
          } else {
            result = { error: `Unknown function: ${name}` };
          }
        } catch (err: any) {
          console.error(`Error executing function ${name}:`, err);
          result = { error: err.message || err };
        }

        toolParts.push({
          functionResponse: {
            name,
            response: { result }
          }
        });
      }

      // 2. Add the tool execution result to our conversation history
      contents.push({
        role: 'tool',
        parts: toolParts
      });

      // 3. Request the model to continue generation using the tool results
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: contents,
        config: {
          systemInstruction,
          tools
        }
      });
    }

    res.status(200).json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in handleChat:', error);
    res.status(500).json({
      error: 'Failed to communicate with Gemini AI',
      message: error.message || error
    });
  }
};

