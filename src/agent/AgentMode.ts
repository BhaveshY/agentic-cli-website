import { Faction } from '../types';
import type { AgentModeConfig } from './AgentProtocol';

function readBooleanParam(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function readFactionParam(value: string | null): Faction {
  return value === Faction.IRONROOT ? Faction.IRONROOT : Faction.SOLARI;
}

export function readAgentModeConfig(search: string = window.location.search): AgentModeConfig {
  const params = new URLSearchParams(search);

  return {
    enabled: readBooleanParam(params.get('agent')),
    autostart: readBooleanParam(params.get('autostart')),
    faction: readFactionParam(params.get('faction')),
    sessionId: params.get('session'),
  };
}
