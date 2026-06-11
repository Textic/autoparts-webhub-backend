import { Request, Response } from 'express';
import pool from '../config/db';

// Obtener todos los repuestos (opcionalmente filtrados por categoría)
export const getRepuestos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoria } = req.query;
    let query = 'SELECT * FROM repuestos';
    const queryParams: any[] = [];

    if (categoria) {
      query += ' WHERE categoria = ?';
      queryParams.push(categoria);
    }

    const [rows] = await pool.query(query, queryParams);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error al obtener los repuestos',
      message: error.message || error
    });
  }
};

// Obtener un repuesto por su ID
export const getRepuestoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM repuestos WHERE id_repuesto = ?', [id]);
    const repuestos = rows as any[];

    if (repuestos.length === 0) {
      res.status(404).json({ error: 'Repuesto no encontrado' });
      return;
    }

    res.status(200).json(repuestos[0]);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error al obtener el repuesto',
      message: error.message || error
    });
  }
};
