import { BuildingType, Faction, GamePhase, ResourceType, UnitState, UnitType } from '../types';
import type { AgentModeConfig } from './AgentMode';

export interface AgentTileSnapshot {
  x: number;
  z: number;
  terrain: string;
  passable: boolean;
  hasResource: ResourceType | null;
  resourceAmount: number;
  buildingId: number | null;
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
  tiles?: AgentTileSnapshot[];
}

export interface AgentController {
  getAgentConfig(): AgentModeConfig;
  getSnapshot(options?: { includeTiles?: boolean }): AgentSnapshot;
  startGame(faction: Faction): void;
  returnToMenu(): void;
  setSelection(ids: number[]): number[];
  startBuildPlacement(buildingType: BuildingType): boolean;
  findBuildLocation(buildingType: BuildingType, owner?: number): { tileX: number; tileZ: number } | null;
  placeBuilding(buildingType: BuildingType, tileX?: number, tileZ?: number): boolean;
  trainUnit(unitType: UnitType, buildingId?: number): boolean;
  advanceAge(playerId?: number): boolean;
  moveUnits(x: number, z: number, unitIds?: number[]): boolean;
  gatherUnits(tileX: number, tileZ: number, unitIds?: number[]): boolean;
  attackUnits(targetId: number, unitIds?: number[]): boolean;
  stopUnits(unitIds?: number[]): number[];
}

function buildJoinUrl(config: AgentModeConfig): string {
  const params = new URLSearchParams();
  params.set('agent', '1');
  params.set('faction', config.faction);
  if (config.autostart) {
    params.set('autostart', '1');
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export function installAgentBridge(controller: AgentController): void {
  const getMode = (): AgentModeConfig => controller.getAgentConfig();

  window.__AETHERIA_AGENT__ = {
    version: '1.0',
    get mode(): AgentModeConfig {
      return getMode();
    },
    getHelp(): Record<string, unknown> {
      const mode = getMode();

      return {
        description: 'Browser agent bridge for the local single-player Aetheria match.',
        joinUrl: buildJoinUrl(mode),
        urlParams: {
          agent: 'Enable the browser agent bridge.',
          autostart: 'Start the match immediately when the page loads.',
          faction: 'Choose SOLARI or IRONROOT as the player faction.',
        },
        actions: [
          'getSnapshot({ includeTiles?: boolean })',
          'startGame(faction)',
          'returnToMenu()',
          'setSelection(ids)',
          'startBuildPlacement(buildingType)',
          'findBuildLocation(buildingType)',
          'placeBuilding(buildingType, tileX?, tileZ?)',
          'trainUnit(unitType, buildingId?)',
          'advanceAge(playerId?)',
          'moveUnits(x, z, unitIds?)',
          'gatherUnits(tileX, tileZ, unitIds?)',
          'attackUnits(targetId, unitIds?)',
          'stopUnits(unitIds?)',
        ],
        notes: [
          'This bridge controls the local player slot in the existing single-player match.',
          'No multiplayer join server exists in this repository; the URL enables agent mode on the local game client.',
        ],
      };
    },
    getSnapshot(options?: { includeTiles?: boolean }): AgentSnapshot {
      return controller.getSnapshot(options);
    },
    startGame(faction?: Faction): void {
      controller.startGame(faction ?? getMode().faction);
    },
    returnToMenu(): void {
      controller.returnToMenu();
    },
    setSelection(ids: number[]): number[] {
      return controller.setSelection(ids);
    },
    startBuildPlacement(buildingType: BuildingType): boolean {
      return controller.startBuildPlacement(buildingType);
    },
    findBuildLocation(buildingType: BuildingType, owner = 0): { tileX: number; tileZ: number } | null {
      return controller.findBuildLocation(buildingType, owner);
    },
    placeBuilding(buildingType: BuildingType, tileX?: number, tileZ?: number): boolean {
      return controller.placeBuilding(buildingType, tileX, tileZ);
    },
    trainUnit(unitType: UnitType, buildingId?: number): boolean {
      return controller.trainUnit(unitType, buildingId);
    },
    advanceAge(playerId = 0): boolean {
      return controller.advanceAge(playerId);
    },
    moveUnits(x: number, z: number, unitIds?: number[]): boolean {
      return controller.moveUnits(x, z, unitIds);
    },
    gatherUnits(tileX: number, tileZ: number, unitIds?: number[]): boolean {
      return controller.gatherUnits(tileX, tileZ, unitIds);
    },
    attackUnits(targetId: number, unitIds?: number[]): boolean {
      return controller.attackUnits(targetId, unitIds);
    },
    stopUnits(unitIds?: number[]): number[] {
      return controller.stopUnits(unitIds);
    },
  };
}

declare global {
  interface Window {
    __AETHERIA_AGENT__?: {
      version: string;
      mode: AgentModeConfig;
      getHelp(): Record<string, unknown>;
      getSnapshot(options?: { includeTiles?: boolean }): AgentSnapshot;
      startGame(faction?: Faction): void;
      returnToMenu(): void;
      setSelection(ids: number[]): number[];
      startBuildPlacement(buildingType: BuildingType): boolean;
      findBuildLocation(buildingType: BuildingType, owner?: number): { tileX: number; tileZ: number } | null;
      placeBuilding(buildingType: BuildingType, tileX?: number, tileZ?: number): boolean;
      trainUnit(unitType: UnitType, buildingId?: number): boolean;
      advanceAge(playerId?: number): boolean;
      moveUnits(x: number, z: number, unitIds?: number[]): boolean;
      gatherUnits(tileX: number, tileZ: number, unitIds?: number[]): boolean;
      attackUnits(targetId: number, unitIds?: number[]): boolean;
      stopUnits(unitIds?: number[]): number[];
    };
  }
}
