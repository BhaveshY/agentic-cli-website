import process from 'node:process';
import { BuildingType, Faction, UnitType } from '../src/types';
import type { AgentCommand } from '../src/agent/AgentProtocol';

const serverBaseUrl = process.env.AETHERIA_AGENT_SERVER_URL ?? 'http://localhost:3001';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'create-session':
      await createSession(args);
      return;
    case 'state':
      await getState(args);
      return;
    case 'command':
      await sendCommand(args);
      return;
    case 'command-status':
      await getCommandStatus(args);
      return;
    case 'help':
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown agent CLI command: ${command}`);
  }
}

async function createSession(args: string[]): Promise<void> {
  const faction = readOption(args, '--faction') === Faction.IRONROOT ? Faction.IRONROOT : Faction.SOLARI;
  const autostart = readOption(args, '--autostart') !== 'false';
  const host = readOption(args, '--host') ?? 'http://localhost:3000';

  const response = await fetchJson('/api/agent/sessions', {
    method: 'POST',
    body: JSON.stringify({ faction, autostart, host }),
  });

  printJson(response);
}

async function getState(args: string[]): Promise<void> {
  const sessionId = requireArgument(args, 0, 'sessionId');
  const view = readOption(args, '--view') ?? 'summary';
  const response = await fetchJson(`/api/agent/sessions/${sessionId}/state?view=${encodeURIComponent(view)}`);
  printJson(response);
}

async function sendCommand(args: string[]): Promise<void> {
  const sessionId = requireArgument(args, 0, 'sessionId');
  const action = requireArgument(args, 1, 'action');
  const command = parseCommand(action, args.slice(2));

  const response = await fetchJson(`/api/agent/sessions/${sessionId}/commands`, {
    method: 'POST',
    body: JSON.stringify(command),
  });

  printJson(response);
}

async function getCommandStatus(args: string[]): Promise<void> {
  const sessionId = requireArgument(args, 0, 'sessionId');
  const commandId = requireArgument(args, 1, 'commandId');
  const response = await fetchJson(`/api/agent/sessions/${sessionId}/commands/${commandId}`);
  printJson(response);
}

function parseCommand(action: string, args: string[]): AgentCommand {
  switch (action) {
    case 'start-game':
      return { type: 'START_GAME', faction: (readOption(args, '--faction') as Faction | null) ?? Faction.SOLARI };
    case 'return-to-menu':
      return { type: 'RETURN_TO_MENU' };
    case 'set-selection':
      return { type: 'SET_SELECTION', ids: readNumberList(readOption(args, '--ids')) };
    case 'place-building':
      return {
        type: 'PLACE_BUILDING',
        buildingType: readBuildingType(readOption(args, '--building') ?? requireArgument(args, 0, 'buildingType')),
        tileX: readOptionalNumber(readOption(args, '--x')),
        tileZ: readOptionalNumber(readOption(args, '--z')),
      };
    case 'train-unit':
      return {
        type: 'TRAIN_UNIT',
        unitType: readUnitType(readOption(args, '--unit') ?? requireArgument(args, 0, 'unitType')),
        buildingId: readOptionalNumber(readOption(args, '--building-id')),
      };
    case 'advance-age':
      return { type: 'ADVANCE_AGE', playerId: readOptionalNumber(readOption(args, '--player-id')) };
    case 'move-units':
      return {
        type: 'MOVE_UNITS',
        x: readNumber(readOption(args, '--x') ?? requireOptionValue(action, '--x')),
        z: readNumber(readOption(args, '--z') ?? requireOptionValue(action, '--z')),
        unitIds: readOptionalNumberList(readOption(args, '--ids')),
      };
    case 'gather-units':
      return {
        type: 'GATHER_UNITS',
        tileX: readNumber(readOption(args, '--x') ?? requireOptionValue(action, '--x')),
        tileZ: readNumber(readOption(args, '--z') ?? requireOptionValue(action, '--z')),
        unitIds: readOptionalNumberList(readOption(args, '--ids')),
      };
    case 'attack-units':
      return {
        type: 'ATTACK_UNITS',
        targetId: readNumber(readOption(args, '--target-id') ?? requireOptionValue(action, '--target-id')),
        unitIds: readOptionalNumberList(readOption(args, '--ids')),
      };
    case 'stop-units':
      return { type: 'STOP_UNITS', unitIds: readOptionalNumberList(readOption(args, '--ids')) };
    default:
      throw new Error(`Unsupported agent action: ${action}`);
  }
}

function readOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1];
}

function requireArgument(args: string[], index: number, label: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`Missing required argument: ${label}`);
  }
  return value;
}

function requireOptionValue(action: string, name: string): string {
  throw new Error(`Missing required option ${name} for action ${action}`);
}

function readNumber(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric value, received: ${value}`);
  }
  return parsed;
}

function readOptionalNumber(value: string | null): number | undefined {
  return value === null ? undefined : readNumber(value);
}

function readNumberList(value: string | null): number[] {
  if (!value) return [];
  return value.split(',').filter(Boolean).map(readNumber);
}

function readOptionalNumberList(value: string | null): number[] | undefined {
  return value ? readNumberList(value) : undefined;
}

function readBuildingType(value: string): BuildingType {
  if (!(value in BuildingType)) {
    throw new Error(`Unsupported building type: ${value}`);
  }
  return value as BuildingType;
}

function readUnitType(value: string): UnitType {
  if (!(value in UnitType)) {
    throw new Error(`Unsupported unit type: ${value}`);
  }
  return value as UnitType;
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`Aetheria agent CLI

Usage:
  tsx scripts/agent-cli.ts create-session [--faction SOLARI|IRONROOT] [--autostart true|false] [--host http://localhost:3000]
  tsx scripts/agent-cli.ts state <sessionId> [--view summary|units|buildings|notifications|full]
  tsx scripts/agent-cli.ts command <sessionId> <action> [options]
  tsx scripts/agent-cli.ts command-status <sessionId> <commandId>

Actions:
  start-game --faction IRONROOT
  return-to-menu
  set-selection --ids 1,2,3
  place-building --building FARM [--x 4 --z 7]
  train-unit --unit WORKER [--building-id 1]
  advance-age [--player-id 0]
  move-units --x 10 --z 12 [--ids 4,5]
  gather-units --x 8 --z 8 [--ids 2]
  attack-units --target-id 42 [--ids 4,5]
  stop-units [--ids 4,5]
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
