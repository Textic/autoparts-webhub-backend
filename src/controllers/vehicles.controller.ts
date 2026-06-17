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

export const getModelsByBrand = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = req.query.brand as string;
    if (!brand) {
      res.status(400).json({ error: 'Missing required query parameter: brand' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT DISTINCT model FROM vehicles WHERE brand = ? ORDER BY model ASC',
      [brand]
    );
    const models = (rows as any[]).map(row => row.model);
    res.status(200).json(models);
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || error
    });
  }
};

export const getYearsByModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const brand = req.query.brand as string;
    const model = req.query.model as string;

    if (!brand || !model) {
      res.status(400).json({ error: 'Missing required query parameters: brand and model' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT DISTINCT manufacturing_year FROM vehicles WHERE brand = ? AND model = ? ORDER BY manufacturing_year DESC',
      [brand, model]
    );
    const years = (rows as any[]).map(row => row.manufacturing_year);
    res.status(200).json(years);
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || error
    });
  }
};
