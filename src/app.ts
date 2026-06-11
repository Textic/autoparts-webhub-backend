import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db';
import vehiculosRoutes from './routes/vehiculos.routes';
import repuestosRoutes from './routes/repuestos.routes';
import usuariosRoutes from './routes/usuarios.routes';
import citasRoutes from './routes/citas.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck endpoint
app.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Perform a simple query to verify database connection
    const [rows] = await pool.query('SELECT 1 as connection_status');
    res.status(200).json({
      status: 'ok',
      service: 'AutoParts WebHub API',
      database: {
        status: 'connected',
        verification: rows
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      service: 'AutoParts WebHub API',
      database: {
        status: 'disconnected',
        error: error.message || error
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/repuestos', repuestosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/citas', citasRoutes);

// Fallback for undefined routes (JSON only)
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`
  });
});

app.listen(PORT, () => {
  console.log(`[Server]: AutoParts WebHub API is running on port ${PORT}`);
  console.log(`[Server]: Environment: ${process.env.NODE_ENV || 'development'}`);
});
