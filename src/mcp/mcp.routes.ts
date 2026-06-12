import { Router } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { mcpServer } from './mcp.server';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
const transports = new Map<string, SSEServerTransport>();

// Iniciar la conexión de Server-Sent Events (SSE)
router.get('/sse', requireAuth, async (req, res) => {
  const transport = new SSEServerTransport('/api/mcp/messages', res);
  
  transports.set(transport.sessionId, transport);
  
  res.on('close', () => {
    transports.delete(transport.sessionId);
  });
  
  await mcpServer.connect(transport);
});

// Recibir mensajes JSON-RPC del cliente
router.post('/messages', requireAuth, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('SSE connection not established or sessionId invalid');
  }
});

export default router;
