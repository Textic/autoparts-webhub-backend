import { Request, Response } from 'express';
import pool from '../config/db';

export const getBrands = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT brand FROM vehicles ORDER BY brand ASC');
    const brands = (rows as any[]).map(row => row.brand);
    res.status(200).json(brands);
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || error
    });
  }
};
