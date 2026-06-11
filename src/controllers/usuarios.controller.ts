import { Request, Response } from 'express';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2';

// Registrar un nuevo usuario
export const crearUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, email, password_hash, rol } = req.body;

    // Validación básica de campos obligatorios
    if (!nombre || !email || !password_hash) {
      res.status(400).json({ error: 'Faltan campos obligatorios: nombre, email o password_hash' });
      return;
    }

    // Insertar el usuario en la base de datos
    // rol tiene ENUM('cliente_particular', 'mecanico_independiente', 'administrador') con default 'cliente_particular'
    const sql = 'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)';
    const values = [nombre, email, password_hash, rol || 'cliente_particular'];

    const [result] = await pool.query<ResultSetHeader>(sql, values);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      id_usuario: result.insertId,
      nombre,
      email,
      rol: rol || 'cliente_particular'
    });
  } catch (error: any) {
    // Manejo de errores específicos (ej. correo duplicado)
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'El correo electrónico ya se encuentra registrado'
      });
      return;
    }

    res.status(500).json({
      error: 'Error al registrar el usuario',
      message: error.message || error
    });
  }
};
