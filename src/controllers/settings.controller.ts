import { Request, Response } from 'express';
import pool from '../config/db';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value, description FROM system_settings');
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Error retrieving system settings', message: error.message || error });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { settings } = req.body; // Array of { setting_key, setting_value }

    if (!settings || !Array.isArray(settings)) {
      res.status(400).json({ error: 'Invalid settings format. Expected an array of { setting_key, setting_value }.' });
      return;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of settings) {
        await connection.query(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [item.setting_value, item.setting_key]
        );
      }

      await connection.commit();
      res.status(200).json({ message: 'Settings updated successfully' });
    } catch (err: any) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Error updating system settings', message: error.message || error });
  }
};
