import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import pool from '../config/db';

const ai = new GoogleGenAI({});

const generateContentWithRetry = async (ai: GoogleGenAI, options: any, retries = 2, delayMs = 600): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await ai.models.generateContent(options);
    } catch (err: any) {
      const errStr = String(err.message || err);
      const isRateLimitOrUnavailable = 
        errStr.includes('503') || 
        errStr.includes('UNAVAILABLE') || 
        errStr.includes('429') || 
        errStr.includes('ResourceExhausted') ||
        err.status === 503 ||
        err.status === 429;
      
      if (isRateLimitOrUnavailable && i < retries) {
        console.warn(`Gemini API 503/429 detected. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
};

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history, currentPartId } = req.body;

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

    let userContext = 'No has iniciado sesión (visitante anónimo).';
    if (res?.locals?.session && res?.locals?.session?.user) {
      const u = res.locals.session.user;
      userContext = `El usuario actual ha iniciado sesión. Detalles: ID: ${u.id}, Nombre: ${u.name}, Correo: ${u.email}, Rol: ${u.role}.`;
    }

    let productContext = 'El usuario no está visualizando ningún repuesto en particular en este momento.';
    if (currentPartId) {
      try {
        const [rows] = await pool.query('SELECT * FROM parts WHERE id = ?', [Number(currentPartId)]);
        const parts = rows as any[];
        if (parts.length > 0) {
          const p = parts[0];
          productContext = `El usuario está visualizando el repuesto: ID: ${p.id}, Nombre: "${p.name}", SKU: "${p.sku}", Categoría: "${p.category}", Precio: $${p.price} CLP, Stock: ${p.available_stock} unidades, Ubicación: "${p.warehouse_location}".`;
        }
      } catch (dbErr) {
        console.error('Error fetching part details for chat context:', dbErr);
      }
    }

    const serverDateTime = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
    const systemInstruction = `Eres el asistente de IA de AutoParts WebHub. Ayuda al usuario a buscar repuestos, verificar stock y agendar citas de retiro. Sé conciso, profesional y responde siempre en español.

CONTEXTO ACTUAL:
- Fecha y hora actual del servidor: ${serverDateTime} (Zona Horaria Chile)
- ${userContext}
- ${productContext}

INSTRUCCIONES IMPORTANTES:
1. Si el usuario te pide agendar una cita de retiro, utiliza la función \`schedule_pickup_appointment\`. 
   - Debes pasar el ID del usuario actual: ${res?.locals?.session?.user?.id || 'null'}.
   - Debes pasar el ID del repuesto (\`part_id\`). Si el usuario está visualizando un repuesto en el contexto (ID: ${currentPartId || 'ninguno'}), usa ese ID.
   - Si el usuario NO está visualizando ningún repuesto pero te ha indicado qué repuesto desea por su nombre o SKU (por ejemplo: "Pastillas de Freno Premium"), debes realizar OBLIGATORIAMENTE la búsqueda del repuesto de forma automática en segundo plano llamando a la función "check_part_stock" para obtener su ID. NUNCA le pidas permiso al usuario para buscar el repuesto ni le preguntes por el SKU o ID si el usuario ya te dio el nombre del repuesto; búscalo tú mismo de forma proactiva y automática para resolver el ID.
   - NUNCA pases null o undefined para el part_id.
2. Puedes recibir la fecha y hora en formatos relativos o naturales (por ejemplo: "mañana", "el próximo lunes", "hoy", "a las 4 de la tarde"). Debes calcular la fecha correcta basándote en la "Fecha y hora actual del servidor" suministrada arriba, y transformarla al formato estándar YYYY-MM-DD y HH:MM antes de invocar la función \`schedule_pickup_appointment\`.
3. Si el usuario no indica un año, asume el año de la fecha actual del servidor.
4. Si el usuario no ha iniciado sesión, indícales amablemente que deben iniciar sesión para poder agendar una cita.
5. Si el usuario te pregunta sobre el producto que está viendo, utiliza la información provista en el contexto.
6. NUNCA inventes, simules o asumas que has agendado una cita con éxito en tus respuestas si no has ejecutado previamente la función "schedule_pickup_appointment" y recibido una respuesta con "status: 'success'". Si te falta información clave como la fecha o la hora, pregúntale educadamente al usuario por los datos faltantes en lugar de simular el agendamiento.
7. Para cualquier consulta sobre precio, stock, ubicación en bodega o SKU de repuestos, debes llamar OBLIGATORIAMENTE a la función "check_part_stock". NUNCA supongas, inventes o aproximes el precio, stock o ubicación física de un producto en base a tu conocimiento general. Si no ejecutas la función "check_part_stock" para el producto específico consultado, debes responder que no posees la información actualizada y que necesitas realizar la búsqueda.
8. Al comunicarle al usuario el resultado del agendamiento, habla de forma amigable, fluida y profesional en español. NUNCA utilices jerga técnica o de código como decir 'el estado es "success"', 'status: success', 'status: error', etc. Simplemente di "Tu cita ha sido agendada con éxito..." o explica de forma clara y humana el problema si la cita fue rechazada por horario o límites.`;

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

    console.log('CONTENTS SENT TO GEMINI (FIRST CALL):', JSON.stringify(contents, null, 2));
    let response = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
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

            if (!part_id || isNaN(Number(part_id))) {
              result = { 
                status: 'error', 
                error: 'El ID del repuesto (part_id) es inválido o no fue especificado. Por favor, realiza una búsqueda del repuesto antes de agendar.' 
              };
            } else {
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
        role: 'function',
        parts: toolParts
      });

      // 3. Request the model to continue generation using the tool results
      console.log('CONTENTS SENT TO GEMINI (LOOP CALL):', JSON.stringify(contents, null, 2));
      response = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction,
          tools
        }
      });
    }

    console.log('Gemini raw response:', JSON.stringify(response, null, 2));
    const replyText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini final reply:', replyText);
    res.status(200).json({ reply: replyText });
  } catch (error: any) {
    console.error('Error in handleChat:', error);
    res.status(500).json({
      error: 'Failed to communicate with Gemini AI',
      message: error.message || error
    });
  }
};

