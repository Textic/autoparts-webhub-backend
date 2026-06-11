import { Request, Response } from 'express';
import pool from '../config/db';

// Get all parts (optionally filtered by category)
export const getParts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM parts';
    const queryParams: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      queryParams.push(category);
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
