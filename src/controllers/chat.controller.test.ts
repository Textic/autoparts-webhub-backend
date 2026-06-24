import { handleChat } from './chat.controller';
import { Request, Response } from 'express';
import pool from '../config/db';

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockImplementation((...args: any[]) => {
            return (global as any).mockGenerateContent(...args);
          }),
        },
      };
    }),
  };
});

(global as any).mockGenerateContent = jest.fn();
const mockGenerateContent = (global as any).mockGenerateContent;

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('Chat Controller - Unit Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let currentMockCount = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    res = {
      status: statusMock,
      json: jsonMock,
    };
    currentMockCount = 0;

    // Configurar mock inteligente de pool.query
    (pool.query as jest.Mock).mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('system_settings')) {
        return Promise.resolve([
          [
            { setting_key: 'hourly_appointment_limit', setting_value: '20' },
            { setting_key: 'allow_start_time', setting_value: '09:00' },
            { setting_key: 'allow_end_time', setting_value: '17:30' }
          ]
        ]);
      }
      if (sql.includes('SELECT COUNT(*)')) {
        return Promise.resolve([[{ count: currentMockCount }]]);
      }
      if (sql.includes('INSERT INTO appointments')) {
        return Promise.resolve([{ insertId: 99 }]);
      }
      return Promise.resolve([[]]);
    });
  });

  test('should return 400 if message is missing', async () => {
    req = { body: {} };
    await handleChat(req as Request, res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing required field: message' });
  });

  test('should reject appointment if out of hours (08:30)', async () => {
    req = {
      body: {
        message: 'Quiero agendar a las 08:30',
        history: [],
      },
    };

    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'schedule_pickup_appointment',
          args: {
            user_id: 1,
            part_id: 3,
            quantity: 1,
            date: '2026-06-25',
            time: '08:30',
          },
        },
      ],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: 'Lo siento, el horario de retiro es únicamente entre las 09:00 y las 17:30.',
      functionCalls: [],
    });

    await handleChat(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      reply: 'Lo siento, el horario de retiro es únicamente entre las 09:00 y las 17:30.',
    });
    expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO appointments'), expect.any(Array));
  });

  test('should reject appointment if hourly limit is exceeded (currentCount = 20)', async () => {
    req = {
      body: {
        message: 'Quiero agendar a las 14:00',
        history: [],
      },
    };

    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'schedule_pickup_appointment',
          args: {
            user_id: 1,
            part_id: 3,
            quantity: 1,
            date: '2026-06-25',
            time: '14:00',
          },
        },
      ],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    currentMockCount = 20;

    mockGenerateContent.mockResolvedValueOnce({
      text: 'Lo sentimos, el cupo de retiro para el bloque de las 14:00 a las 14:59 está completo.',
      functionCalls: [],
    });

    await handleChat(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      reply: 'Lo sentimos, el cupo de retiro para el bloque de las 14:00 a las 14:59 está completo.',
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), expect.any(Array));
    expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO appointments'), expect.any(Array));
  });

  test('should schedule appointment successfully under normal conditions', async () => {
    req = {
      body: {
        message: 'Quiero agendar a las 14:00',
        history: [],
      },
    };

    mockGenerateContent.mockResolvedValueOnce({
      functionCalls: [
        {
          name: 'schedule_pickup_appointment',
          args: {
            user_id: 1,
            part_id: 3,
            quantity: 1,
            date: '2026-06-25',
            time: '14:00',
          },
        },
      ],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    currentMockCount = 5;

    mockGenerateContent.mockResolvedValueOnce({
      text: 'Cita agendada con éxito. ID: 99.',
      functionCalls: [],
    });

    await handleChat(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      reply: 'Cita agendada con éxito. ID: 99.',
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), expect.any(Array));
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO appointments'), expect.any(Array));
  });
});
