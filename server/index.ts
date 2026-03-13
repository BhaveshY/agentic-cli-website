import express from 'express';
import { randomUUID } from 'node:crypto';
import { Faction, GamePhase } from '../src/types';
import {
  buildAgentStateSummary,
  type AgentCommand,
  type AgentHeartbeatResponse,
  type AgentQueuedCommand,
  type AgentSessionInfo,
  type AgentSessionStateEnvelope,
  type AgentSnapshot,
  type AgentStateSummary,
} from '../src/agent/AgentProtocol';

type SessionView = 'summary' | 'units' | 'buildings' | 'notifications' | 'full';

interface SessionRecord extends AgentSessionInfo {
  latestState: AgentSnapshot | null;
  latestSummary: AgentStateSummary | null;
  lastHeartbeatAt: number | null;
  nextCommandId: number;
  commands: AgentQueuedCommand[];
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const sessions = new Map<string, SessionRecord>();
const port = Number(process.env.PORT || 3001);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/agent/sessions', (req, res) => {
  const faction = req.body?.faction === Faction.IRONROOT ? Faction.IRONROOT : Faction.SOLARI;
  const autostart = req.body?.autostart !== false;
  const host = req.body?.host && typeof req.body.host === 'string'
    ? req.body.host
    : 'http://localhost:3000';
  const sessionId = randomUUID();

  const record: SessionRecord = {
    sessionId,
    faction,
    autostart,
    joinUrl: `${host}/?agent=1&autostart=${autostart ? '1' : '0'}&faction=${faction}&session=${sessionId}`,
    createdAt: Date.now(),
    latestState: null,
    latestSummary: null,
    lastHeartbeatAt: null,
    nextCommandId: 1,
    commands: [],
  };

  sessions.set(sessionId, record);
  res.status(201).json(record);
});

app.get('/api/agent/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  res.json({
    sessionId: session.sessionId,
    faction: session.faction,
    autostart: session.autostart,
    joinUrl: session.joinUrl,
    createdAt: session.createdAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    phase: session.latestSummary?.phase ?? GamePhase.MENU,
    tick: session.latestSummary?.tick ?? 0,
  });
});

app.post('/api/agent/sessions/:sessionId/heartbeat', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  const body = req.body as AgentSessionStateEnvelope;
  if (!body?.state) {
    res.status(400).json({ error: 'Missing state payload' });
    return;
  }

  session.latestState = body.state;
  session.latestSummary = buildAgentStateSummary(body.state);
  session.lastHeartbeatAt = Date.now();

  const pendingCommands = session.commands.filter((command) => command.status === 'pending').slice(0, 5);
  const response: AgentHeartbeatResponse = { commands: pendingCommands };
  res.json(response);
});

app.get('/api/agent/sessions/:sessionId/state', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  const view = ((req.query.view as SessionView | undefined) ?? 'summary');
  if (!session.latestState || !session.latestSummary) {
    res.status(202).json({
      sessionId: session.sessionId,
      status: 'waiting_for_browser',
      joinUrl: session.joinUrl,
    });
    return;
  }

  switch (view) {
    case 'summary':
      res.json(session.latestSummary);
      return;
    case 'units':
      res.json({ tick: session.latestState.tick, phase: session.latestState.phase, units: session.latestState.units });
      return;
    case 'buildings':
      res.json({ tick: session.latestState.tick, phase: session.latestState.phase, buildings: session.latestState.buildings });
      return;
    case 'notifications':
      res.json({ tick: session.latestState.tick, phase: session.latestState.phase, notifications: session.latestState.notifications });
      return;
    case 'full':
      res.json(session.latestState);
      return;
    default:
      res.status(400).json({ error: `Unsupported state view: ${view}` });
  }
});

app.post('/api/agent/sessions/:sessionId/commands', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  const command = req.body as AgentCommand;
  if (!command?.type) {
    res.status(400).json({ error: 'Missing command type' });
    return;
  }

  const queuedCommand: AgentQueuedCommand = {
    id: session.nextCommandId++,
    command,
    createdAt: Date.now(),
    status: 'pending',
  };

  session.commands.push(queuedCommand);
  res.status(201).json(queuedCommand);
});

app.get('/api/agent/sessions/:sessionId/commands/:commandId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  const commandId = Number(req.params.commandId);
  const command = session.commands.find((entry) => entry.id === commandId);
  if (!command) {
    res.status(404).json({ error: 'Unknown command' });
    return;
  }

  res.json(command);
});

app.post('/api/agent/sessions/:sessionId/commands/:commandId/result', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }

  const commandId = Number(req.params.commandId);
  const command = session.commands.find((entry) => entry.id === commandId);
  if (!command) {
    res.status(404).json({ error: 'Unknown command' });
    return;
  }

  const ok = req.body?.ok !== false;
  command.status = ok ? 'completed' : 'failed';
  command.result = req.body?.result;
  command.error = req.body?.error;
  res.json(command);
});

app.listen(port, () => {
  console.log(`Aetheria agent server listening on http://localhost:${port}`);
});
