import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import pool from '../config/db';

export const mcpServer = new McpServer({
  name: 'AutoParts-WebHub-MCP-Server',
  version: '1.0.0',
});

// Tool 1: check_part_stock
mcpServer.registerTool(
  'check_part_stock',
  {
    description: 'Searches for the available stock and price of a spare part using its SKU or name.',
    inputSchema: z.object({
      search_term: z.string().describe('The SKU or name of the spare part to search for.'),
    }),
  },
  async ({ search_term }) => {
    try {
      const sql = `
        SELECT sku, name, category, price, available_stock, warehouse_location 
        FROM parts 
        WHERE name LIKE ? OR sku = ?
      `;
      const [rows] = await pool.query(sql, [`%${search_term}%`, search_term]);
      const parts = rows as any[];

      if (parts.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No parts found matching search term "${search_term}".`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(parts, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error checking part stock: ${error.message || error}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 2: schedule_pickup_appointment
mcpServer.registerTool(
  'schedule_pickup_appointment',
  {
    description: 'Schedules a new appointment for a client to pick up a spare part in the physical store.',
    inputSchema: z.object({
      user_id: z.number().describe('The ID of the user/client making the pickup.'),
      part_id: z.number().describe('The ID of the spare part to be picked up.'),
      quantity: z.number().default(1).describe('The quantity of parts to pick up.'),
      date: z.string().describe('The date of the appointment in YYYY-MM-DD format.'),
      time: z.string().describe('The time of the appointment in HH:MM format.'),
    }),
  },
  async ({ user_id, part_id, quantity, date, time }) => {
    try {
      const sql = `
        INSERT INTO appointments (user_id, part_id, quantity, appointment_date, appointment_time, status, created_by_ia)
        VALUES (?, ?, ?, ?, ?, 'pending', 1)
      `;
      const [result] = await pool.query(sql, [user_id, part_id, quantity, date, time]);
      const insertId = (result as any).insertId;

      return {
        content: [
          {
            type: 'text',
            text: `Appointment scheduled successfully by IA. Appointment ID: ${insertId}.`,
          },
        ],
      };
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return {
          content: [
            {
              type: 'text',
              text: `Scheduling error: An appointment is already scheduled for date ${date} and time ${time}. Please suggest another slot.`,
            },
          ],
          isError: true,
        };
      }
      if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
        return {
          content: [
            {
              type: 'text',
              text: `Referential integrity error: User ID (${user_id}) or Part ID (${part_id}) does not exist.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Unexpected error scheduling appointment: ${error.message || error}`,
          },
        ],
        isError: true,
      };
    }
  }
);
