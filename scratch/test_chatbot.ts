import pool from '../src/config/db';

async function runTests() {
  console.log('--- INICIANDO PRUEBAS AUTOMATIZADAS DE LÍMITES Y HORARIOS ---');
  
  const url = 'http://localhost:3000/api/chat';
  const testDate = '2026-06-30';
  
  try {
    // 1. Limpiar citas previas del día de prueba y preparar escenario de prueba
    console.log('\n[Preparando DB] Limpiando citas del día de prueba...');
    await pool.query('DELETE FROM appointments WHERE appointment_date = ?', [testDate]);
    
    console.log('[Preparando DB] Insertando 2 citas de prueba para simular saturación en el bloque de las 14:00...');
    // Cita 1 (14:00)
    await pool.query(
      `INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
       VALUES (1, 1, 1, ?, '14:00:00', 'pending', 1)`,
      [testDate]
    );
    // Cita 2 (14:30)
    await pool.query(
      `INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
       VALUES (1, 1, 1, ?, '14:30:00', 'pending', 1)`,
      [testDate]
    );
    
    console.log('[Preparando DB] Escenario de prueba listo.');

    // 2. Prueba de Horario Inválido (Ej: 08:30)
    console.log('\n[Prueba 1] Solicitando agendar cita en horario no permitido (08:30)...');
    const payload1 = {
      message: `Hola, quiero agendar una cita para retirar 1 filtro de aceite (ID de repuesto: 3, mi ID de usuario es 1) para la fecha ${testDate} a las 08:30.`,
      history: []
    };
    
    const res1 = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bypass-auth': 'true'
      },
      body: JSON.stringify(payload1)
    });
    
    const data1 = (await res1.json()) as { reply: string };
    console.log('Respuesta del Chatbot (Debería rechazar por horario):');
    console.log(data1.reply);

    // 3. Prueba de Límite por Hora (Ej: Intentar agendar la cita número 3 en la hora 14:00)
    console.log(`\n[Prueba 2] Solicitando agendar la 3ra cita en el bloque de las 14:00 (límite temporal = 2)...`);
    const payload2 = {
      message: `Quiero agendar una cita para retirar 1 filtro de aire (ID de repuesto: 4, mi ID de usuario es 1) para la fecha ${testDate} a las 14:45.`,
      history: []
    };
    
    const res2 = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bypass-auth': 'true'
      },
      body: JSON.stringify(payload2)
    });
    
    const data2 = (await res2.json()) as { reply: string };
    console.log('Respuesta del Chatbot (Debería rechazar por saturación de citas):');
    console.log(data2.reply);

    console.log('\n--- PRUEBAS COMPLETADAS ---');
  } catch (error) {
    console.error('Error durante la ejecución de la prueba:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
