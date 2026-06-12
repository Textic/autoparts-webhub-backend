import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2';

// Register a new user
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password_hash } = req.body;

    // Basic validation
    if (!name || !email || !password_hash) {
      res.status(400).json({ error: 'Missing required fields: name, email, or password_hash' });
      return;
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_hash, salt);

    const sql = `
      INSERT INTO users (name, email, password_hash, role_id) 
      VALUES (?, ?, ?, 1)
    `;
    const values = [name, email, hashedPassword];

    const [result] = await pool.query<ResultSetHeader>(sql, values);

    res.status(201).json({
      message: 'User registered successfully',
      id: result.insertId,
      name,
      email
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'Email already exists'
      });
      return;
    }

    res.status(500).json({
      error: 'Error registering user',
      message: error.message || error
    });
  }
};
