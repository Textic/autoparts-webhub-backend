import { Request, Response } from 'express';
import pool from '../config/db';
import { ResultSetHeader } from 'mysql2';

// Crear una nueva cita de retiro
export const crearCita = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id_usuario, id_repuesto, cantidad, fecha_cita, hora_cita, estado, creado_por_ia } = req.body;

    // Validación básica de campos requeridos
    if (!id_usuario || !id_repuesto || !fecha_cita || !hora_cita) {
      res.status(400).json({
        error: 'Faltan campos obligatorios: id_usuario, id_repuesto, fecha_cita o hora_cita'
      });
      return;
    }

    const sql = `
      INSERT INTO citas_retiro (id_usuario, id_repuesto, cantidad, fecha_cita, hora_cita, estado, creado_por_ia)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      id_usuario,
      id_repuesto,
      cantidad || 1,
      fecha_cita,
      hora_cita,
      estado || 'pendiente',
      creado_por_ia ? 1 : 0
    ];

    const [result] = await pool.query<ResultSetHeader>(sql, values);

    res.status(201).json({
      message: 'Cita agendada exitosamente',
      id_cita: result.insertId,
      id_usuario,
      id_repuesto,
      cantidad: cantidad || 1,
      fecha_cita,
      hora_cita,
      estado: estado || 'pendiente',
      creado_por_ia: creado_por_ia ? true : false
    });
  } catch (error: any) {
    // Manejar colisión de cita (fecha y hora únicas)
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'Ya existe una cita agendada para la fecha y hora seleccionadas'
      });
      return;
    }

    // Manejar errores de clave foránea
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({
        error: 'Error de integridad referencial',
        message: 'El id_usuario o id_repuesto no existe en el sistema'
      });
      return;
    }

    res.status(500).json({
      error: 'Error al agendar la cita',
      message: error.message || error
    });
  }
};
