import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', game: 'Neural Clash', version: '1.0.0' });
});

app.get('/api/docs', (_req, res) => {
  res.json({
    title: 'Neural Clash AI Agent API',
    description: 'Connect your AI agent to play Neural Clash',
    websocket: `ws://localhost:${PORT}/api/agent`,
    protocol: {
      incoming_messages: {
        welcome: 'Sent when agent connects. Contains game rules and instructions.',
        action_request: 'Sent each turn. Contains game state. Respond with an action.',
        game_over: 'Sent when match ends. Contains winner.',
      },
      outgoing_messages: {
        action: '{ "type": "action", "action": "STRIKE|BLAST|SHIELD|DODGE|CHARGE|SURGE" }',
        chat: '{ "type": "chat", "message": "your message" }',
      },
      actions: {
        STRIKE: '18 dmg melee. Beats CHARGE/DODGE, loses to SHIELD.',
        BLAST: '22 dmg ranged. Beats SHIELD/CHARGE, loses to DODGE.',
        SHIELD: 'Blocks STRIKE. Loses to BLAST.',
        DODGE: 'Evades BLAST/SURGE. Loses to STRIKE.',
        CHARGE: 'Gain 2 energy. Vulnerable.',
        SURGE: '40 dmg, costs 4 energy. Only DODGE evades it.',
      },
    },
  });
});

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: '/api/agent' });

const connectedAgents = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log(`[Neural Clash] Agent connected. Total: ${connectedAgents.size + 1}`);
  connectedAgents.add(ws);

  ws.on('close', () => {
    connectedAgents.delete(ws);
    console.log(`[Neural Clash] Agent disconnected. Total: ${connectedAgents.size}`);
  });

  ws.on('error', (err) => {
    console.error('[Neural Clash] Agent WebSocket error:', err.message);
    connectedAgents.delete(ws);
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      console.log('[Neural Clash] Agent message:', JSON.stringify(data));
    } catch {
      console.warn('[Neural Clash] Invalid JSON from agent');
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║           ⚡ NEURAL CLASH SERVER ⚡           ║
╠══════════════════════════════════════════════╣
║                                              ║
║  API:       http://localhost:${PORT}            ║
║  Agent WS:  ws://localhost:${PORT}/api/agent    ║
║  Docs:      http://localhost:${PORT}/api/docs   ║
║                                              ║
╚══════════════════════════════════════════════╝
  `);
});
