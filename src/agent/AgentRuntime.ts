import { BuildingType, Faction, UnitType } from '../types';
import type { AgentModeConfig, AgentSnapshot } from './AgentProtocol';

export interface AgentController {
  getAgentConfig(): AgentModeConfig;
  getSnapshot(): AgentSnapshot;
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
