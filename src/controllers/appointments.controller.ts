import { Request, Response } from 'express';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2';

// Create a new pickup appointment
export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    const { user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia, items } = req.body;

    // Resolve user ID securely from session or request body fallback
    const session = res.locals.session;
    const resolvedUserId = session?.user?.id ? Number(session.user.id) : Number(user_id);

    let itemsList = items;
    if (!itemsList && part_id) {
      itemsList = [{ part_id, quantity: quantity || 1 }];
    }

    if (!resolvedUserId || !appointment_date || !appointment_time || !Array.isArray(itemsList) || itemsList.length === 0) {
      res.status(400).json({
        error: 'Missing required fields: user_id, appointment_date, appointment_time, or items'
      });
      conn.release();
      return;
    }

    // 1. Fetch system settings from DB
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

    // 2. Validate time range
    const parts = appointment_time.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const timeInMinutes = hour * 60 + minute;

    if (isNaN(timeInMinutes) || timeInMinutes < minTime || timeInMinutes > maxTime) {
      res.status(400).json({
        error: `El horario de retiro permitido es únicamente entre las ${startTimeStr} y las ${endTimeStr}.`
      });
      conn.release();
      return;
    }

    // 3. Validate hourly limit
    const countSql = `
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE appointment_date = ? 
        AND HOUR(appointment_time) = ?
    `;
    const [countRows] = await pool.query(countSql, [appointment_date, hour]);
    const currentCount = (countRows as any)[0]?.count || 0;

    if (currentCount >= maxAllowed) {
      res.status(409).json({
        error: `Lo sentimos, el cupo de retiro para el bloque de las ${hour}:00 a las ${hour}:59 está completo (límite de ${maxAllowed} citas por hora).`
      });
      conn.release();
      return;
    }

    await conn.beginTransaction();

    const firstItem = itemsList[0];
    const sql = `
      INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      resolvedUserId,
      firstItem.part_id,
      firstItem.quantity,
      appointment_date,
      appointment_time,
      status || 'pending',
      created_by_ia ? 1 : 0
    ];

    const [result] = await conn.query<ResultSetHeader>(sql, values);
    const appointmentId = result.insertId;

    // Insert remaining items (the first item is automatically inserted by database trigger `after_appointment_insert_compat`)
    for (let i = 1; i < itemsList.length; i++) {
      const item = itemsList[i];
      const itemSql = `
        INSERT INTO appointment_items (appointment_id, part_id, quantity)
        VALUES (?, ?, ?)
      `;
      await conn.query(itemSql, [appointmentId, item.part_id, item.quantity]);
    }

    await conn.commit();

    res.status(201).json({
      message: 'Appointment scheduled successfully',
      id: appointmentId,
      user_id: resolvedUserId,
      part_id: firstItem.part_id,
      quantity: firstItem.quantity,
      appointment_date,
      appointment_time,
      status: status || 'pending',
      created_by_ia: created_by_ia ? true : false
    });
  } catch (error: any) {
    await conn.rollback();

    // Handle unique schedule collision
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'An appointment is already scheduled for the selected date and time'
      });
      return;
    }

    // Handle foreign key errors
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({
        error: 'Referential integrity error',
        message: 'The user_id or part_id does not exist'
      });
      return;
    }

    res.status(500).json({
      error: 'Error scheduling appointment',
      message: error.message || error
    });
  } finally {
    conn.release();
  }
};

export const getAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT a.id, a.user_id, a.appointment_date, a.appointment_time, a.status, a.created_by_ia,
             u.name as user_name, u.email as user_email
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;
    const [rows] = await pool.query(sql);
    const appointments = rows as any[];

    if (appointments.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Fetch items
    const [itemRows] = await pool.query(`
      SELECT ai.appointment_id, ai.part_id, ai.quantity,
             p.name as part_name, p.sku as part_sku, p.price as part_price
      FROM appointment_items ai
      JOIN parts p ON ai.part_id = p.id
    `);
    const items = itemRows as any[];

    // Map items to appointments
    const itemsMap: { [key: number]: any[] } = {};
    items.forEach(item => {
      if (!itemsMap[item.appointment_id]) {
        itemsMap[item.appointment_id] = [];
      }
      itemsMap[item.appointment_id].push(item);
    });

    appointments.forEach(appt => {
      appt.items = itemsMap[appt.id] || [];
      if (appt.items.length > 0) {
        appt.part_id = appt.items[0].part_id;
        appt.part_name = appt.items[0].part_name;
        appt.part_sku = appt.items[0].part_sku;
        appt.part_price = appt.items[0].part_price;
        appt.quantity = appt.items[0].quantity;
      } else {
        appt.part_id = null;
        appt.part_name = 'Sin repuestos';
        appt.part_sku = '—';
        appt.part_price = 0;
        appt.quantity = 0;
      }
    });

    res.status(200).json(appointments);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error retrieving appointments',
      message: error.message || error
    });
  }
};

export const updateAppointmentItems = async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { items } = req.body; // array of { part_id, quantity }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Missing or empty required field: items' });
      conn.release();
      return;
    }

    await conn.beginTransaction();

    // Delete existing items (this triggers stock restoration)
    await conn.query('DELETE FROM appointment_items WHERE appointment_id = ?', [id]);

    // Insert new items (this triggers stock deduction)
    for (const item of items) {
      await conn.query(
        'INSERT INTO appointment_items (appointment_id, part_id, quantity) VALUES (?, ?, ?)',
        [id, item.part_id, item.quantity]
      );
    }

    // Update parent appointment columns for compatibility
    const firstItem = items[0];
    await conn.query(
      'UPDATE appointments SET part_id = ?, quantity = ? WHERE id = ?',
      [firstItem.part_id, firstItem.quantity, id]
    );

    await conn.commit();
    res.status(200).json({ message: 'Appointment items updated successfully' });
  } catch (error: any) {
    await conn.rollback();
    res.status(500).json({
      error: 'Error updating appointment items',
      message: error.message || error
    });
  } finally {
    conn.release();
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Missing required field: status' });
      return;
    }

    const sql = `UPDATE appointments SET status = ? WHERE id = ?`;
    const [result] = await pool.query<ResultSetHeader>(sql, [status, id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    res.status(200).json({ message: 'Appointment status updated successfully', id, status });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error updating appointment status',
      message: error.message || error
    });
  }
};

