import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ExpressAuth } from '@auth/express';
import pool from './config/db';
import { authConfig } from './config/auth.config';
import vehiclesRoutes from './routes/vehicles.routes';
import partsRoutes from './routes/parts.routes';
import usersRoutes from './routes/users.routes';
import appointmentsRoutes from './routes/appointments.routes';
import mcpRoutes from './mcp/mcp.routes';
import chatRoutes from './routes/chat.routes';
import settingsRoutes from './routes/settings.routes';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for secure cookies when running behind proxies
app.set('trust proxy', true);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth.js handler
app.use('/api/auth', ExpressAuth(authConfig));

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

// Root endpoint
app.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    message: 'Welcome to the AutoParts WebHub API',
    description: 'This is a backend-only REST API.',
    endpoints: {
      health: '/health',
      session: '/api/auth/session',
      signin: '/api/auth/signin',
      vehicles: '/api/vehicles/brands',
      parts: '/api/parts',
      chat: '/api/chat'
    }
  });
});

// Routers
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/parts', partsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);


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
