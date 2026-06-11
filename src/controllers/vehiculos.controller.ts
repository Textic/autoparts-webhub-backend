import { Request, Response } from 'express';
import pool from '../config/db';

export const getMarcas = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT marca FROM vehiculos ORDER BY marca ASC');
    const marcas = (rows as any[]).map(row => row.marca);
    res.status(200).json(marcas);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message || error
    });
  }
};
