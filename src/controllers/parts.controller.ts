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

// Create a new part
export const createPart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku, name, category, price, available_stock, warehouse_location, image_url } = req.body;

    if (!sku || !name || !category || price === undefined || available_stock === undefined || !warehouse_location) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const finalImageUrl = image_url && image_url.trim() ? image_url : '/images/repuesto_defecto.png';

    const sql = `
      INSERT INTO parts (sku, name, category, price, available_stock, warehouse_location, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [sku, name, category, Number(price), Number(available_stock), warehouse_location, finalImageUrl]);
    const insertId = (result as any).insertId;

    res.status(201).json({ id: insertId, sku, name, category, price, available_stock, warehouse_location, image_url: finalImageUrl });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error creating part',
      message: error.message || error
    });
  }
};

// Update an existing part
export const updatePart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { sku, name, category, price, available_stock, warehouse_location, image_url } = req.body;

    if (!sku || !name || !category || price === undefined || available_stock === undefined || !warehouse_location) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const finalImageUrl = image_url && image_url.trim() ? image_url : '/images/repuesto_defecto.png';

    const sql = `
      UPDATE parts
      SET sku = ?, name = ?, category = ?, price = ?, available_stock = ?, warehouse_location = ?, image_url = ?
      WHERE id = ?
    `;
    const [result] = await pool.query(sql, [sku, name, category, Number(price), Number(available_stock), warehouse_location, finalImageUrl, Number(id)]);
    
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.status(200).json({ id: Number(id), sku, name, category, price, available_stock, warehouse_location, image_url: finalImageUrl });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error updating part',
      message: error.message || error
    });
  }
};

// Delete a part by ID
export const deletePart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM parts WHERE id = ?', [Number(id)]);

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Part not found' });
      return;
    }

    res.status(200).json({ message: 'Part deleted successfully' });
  } catch (error: any) {
    res.status(500).json({
      error: 'Error deleting part',
      message: error.message || error
    });
  }
};
