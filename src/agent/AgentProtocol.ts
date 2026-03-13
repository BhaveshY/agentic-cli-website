import { BuildingType, Faction, GamePhase, ResourceType, UnitState, UnitType } from '../types';

export interface AgentModeConfig {
  enabled: boolean;
  autostart: boolean;
  faction: Faction;
  sessionId: string | null;
}

export interface AgentUnitSnapshot {
  id: number;
  type: UnitType;
  owner: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  targetX: number;
  targetZ: number;
  attackTargetId: number | null;
  carryType: ResourceType | null;
  carryAmount: number;
  gatherTargetX: number;
  gatherTargetZ: number;
  buildTargetId: number | null;
}

export interface AgentBuildingSnapshot {
  id: number;
  type: BuildingType;
  owner: number;
  tileX: number;
  tileZ: number;
  hp: number;
  maxHp: number;
  buildProgress: number;
  isComplete: boolean;
  productionQueue: UnitType[];
  productionProgress: number;
  rallyX: number;
  rallyZ: number;
}

export interface AgentPlayerSnapshot {
  id: number;
  faction: Faction;
  resources: Record<ResourceType, number>;
  population: number;
  maxPopulation: number;
  age: number;
  isAI: boolean;
  defeated: boolean;
}

export interface AgentSnapshot {
  phase: GamePhase;
  tick: number;
  selectedIds: number[];
  buildPlacementType: BuildingType | null;
  player: AgentPlayerSnapshot | null;
  opponent: AgentPlayerSnapshot | null;
  units: AgentUnitSnapshot[];
  buildings: AgentBuildingSnapshot[];
  notifications: Array<{ text: string; type: string; time: number }>;
}

export interface AgentStateSummary {
  phase: GamePhase;
  tick: number;
  buildPlacementType: BuildingType | null;
  player: AgentPlayerSnapshot | null;
  opponent: AgentPlayerSnapshot | null;
  ownUnitCounts: Partial<Record<UnitType, number>>;
  enemyUnitCounts: Partial<Record<UnitType, number>>;
  ownBuildingCounts: Partial<Record<BuildingType, number>>;
  enemyBuildingCounts: Partial<Record<BuildingType, number>>;
  selectedIds: number[];
  notifications: Array<{ text: string; type: string; time: number }>;
}

export type AgentCommand =
  | { type: 'START_GAME'; faction?: Faction }
  | { type: 'RETURN_TO_MENU' }
  | { type: 'SET_SELECTION'; ids: number[] }
  | { type: 'PLACE_BUILDING'; buildingType: BuildingType; tileX?: number; tileZ?: number }
  | { type: 'TRAIN_UNIT'; unitType: UnitType; buildingId?: number }
  | { type: 'ADVANCE_AGE'; playerId?: number }
  | { type: 'MOVE_UNITS'; x: number; z: number; unitIds?: number[] }
  | { type: 'GATHER_UNITS'; tileX: number; tileZ: number; unitIds?: number[] }
  | { type: 'ATTACK_UNITS'; targetId: number; unitIds?: number[] }
  | { type: 'STOP_UNITS'; unitIds?: number[] };

export interface AgentQueuedCommand {
  id: number;
  command: AgentCommand;
  createdAt: number;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface AgentSessionStateEnvelope {
  sessionId: string;
  clientVersion: string;
  state: AgentSnapshot;
}

export interface AgentHeartbeatResponse {
  commands: AgentQueuedCommand[];
}

export interface AgentSessionInfo {
  sessionId: string;
  faction: Faction;
  autostart: boolean;
  joinUrl: string;
  createdAt: number;
}

export function buildAgentStateSummary(snapshot: AgentSnapshot): AgentStateSummary {
  const ownUnitCounts: Partial<Record<UnitType, number>> = {};
  const enemyUnitCounts: Partial<Record<UnitType, number>> = {};
  const ownBuildingCounts: Partial<Record<BuildingType, number>> = {};
  const enemyBuildingCounts: Partial<Record<BuildingType, number>> = {};

  for (const unit of snapshot.units) {
    const target = unit.owner === 0 ? ownUnitCounts : enemyUnitCounts;
    target[unit.type] = (target[unit.type] ?? 0) + 1;
  }

  for (const building of snapshot.buildings) {
    const target = building.owner === 0 ? ownBuildingCounts : enemyBuildingCounts;
    target[building.type] = (target[building.type] ?? 0) + 1;
  }

  return {
    phase: snapshot.phase,
    tick: snapshot.tick,
    buildPlacementType: snapshot.buildPlacementType,
    player: snapshot.player,
    opponent: snapshot.opponent,
    ownUnitCounts,
    enemyUnitCounts,
    ownBuildingCounts,
    enemyBuildingCounts,
    selectedIds: snapshot.selectedIds,
    notifications: snapshot.notifications.slice(-5),
  };
}
