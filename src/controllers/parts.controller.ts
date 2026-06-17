import { Request, Response } from 'express';
import pool from '../config/db';

// Get all parts (optionally filtered by category and/or vehicle compatibility)
export const getParts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, vehicle_id } = req.query;
    let query = 'SELECT p.* FROM parts p';
    const queryParams: any[] = [];
    const whereClauses: string[] = [];

    if (vehicle_id) {
      query = 'SELECT p.* FROM parts p INNER JOIN part_compatibilities pc ON p.id = pc.part_id';
      whereClauses.push('pc.vehicle_id = ?');
      queryParams.push(Number(vehicle_id));
    }

    if (category) {
      whereClauses.push('p.category = ?');
      queryParams.push(category);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const [rows] = await pool.query(query, queryParams);
    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error retrieving parts',
      message: error.message || error
    });
  }
};

// Get a single part by ID
export const getPartById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM parts WHERE id = ?', [id]);
    const parts = rows as any[];

    if (parts.length === 0) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.status(200).json(parts[0]);
  } catch (error: any) {
    res.status(500).json({
      error: 'Error retrieving part',
      message: error.message || error
    });
  }
};
