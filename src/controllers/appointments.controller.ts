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
