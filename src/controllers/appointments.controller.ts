import { Request, Response } from 'express';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2';

// Create a new pickup appointment
export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia } = req.body;

    // Basic validation
    if (!user_id || !part_id || !appointment_date || !appointment_time) {
      res.status(400).json({
        error: 'Missing required fields: user_id, part_id, appointment_date, or appointment_time'
      });
      return;
    }

    const sql = `
      INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      user_id,
      part_id,
      quantity || 1,
      appointment_date,
      appointment_time,
      status || 'pending',
      created_by_ia ? 1 : 0
    ];

    const [result] = await pool.query<ResultSetHeader>(sql, values);

    res.status(201).json({
      message: 'Appointment scheduled successfully',
      id: result.insertId,
      user_id,
      part_id,
      quantity: quantity || 1,
      appointment_date,
      appointment_time,
      status: status || 'pending',
      created_by_ia: created_by_ia ? true : false
    });
  } catch (error: any) {
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
  }
};

export const getAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT a.id, a.user_id, a.part_id, a.quantity, a.appointment_date, a.appointment_time, a.status, a.created_by_ia,
             u.name as user_name, u.email as user_email,
             p.name as part_name, p.sku as part_sku, p.price as part_price
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      JOIN parts p ON a.part_id = p.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;
    const [rows] = await pool.query(sql);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error retrieving appointments',
      message: error.message || error
    });
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

