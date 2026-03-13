import './style.css';
import { Faction, GamePhase, BuildingType, UnitState, UnitType } from './types';
import { BUILDING_DEFS, TILE_SIZE, UNIT_DEFS } from './config';
import { GameWorld } from './core/GameState';
import { SceneSetup } from './render/SceneSetup';
import { TerrainRenderer } from './render/Terrain';
import { EntityRenderer } from './render/EntityModels';
import { InputControls } from './input/Controls';
import { GameUI } from './ui/GameUI';
import { AIPlayer } from './ai/AIPlayer';
import { GameAudio } from './audio/Sounds';
import { installAgentBridge } from './agent/AgentBridge';
import { readAgentModeConfig } from './agent/AgentMode';
import { AgentSessionClient } from './agent/AgentSessionClient';
import type { AgentModeConfig, AgentSnapshot } from './agent/AgentProtocol';
import type { AgentController } from './agent/AgentRuntime';

class AetheriaGame implements AgentController {
  private world!: GameWorld;
  private scene: SceneSetup;
  private terrain!: TerrainRenderer;
  private entities!: EntityRenderer;
  private controls!: InputControls;
  private ui: GameUI;
  private ai!: AIPlayer;
  private audio: GameAudio;
  private uiUpdateCounter = 0;
  private gameLoopBound: ((dt: number, t: number) => void) | null = null;
  private lastSimulationTime = 0;
  private agentConfig: AgentModeConfig;
  private sessionClient: AgentSessionClient | null = null;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const uiLayer = document.getElementById('ui-layer') as HTMLElement;
    this.agentConfig = readAgentModeConfig();

    this.scene = new SceneSetup(canvas);
    this.audio = new GameAudio();
    this.ui = new GameUI(uiLayer, (event, data) => this.handleUIEvent(event, data));
    this.ui.init();
    installAgentBridge(this);
    document.body.dataset.agentMode = this.agentConfig.enabled ? 'true' : 'false';
    if (this.agentConfig.enabled) {
      this.ui.setSelectedFaction(this.agentConfig.faction);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.world) {
        this.startGame(Faction.SOLARI);
      }
    });

    this.scene.start();

    if (this.agentConfig.enabled && this.agentConfig.autostart) {
      this.startGame(this.agentConfig.faction);
    }

    if (this.agentConfig.enabled && this.agentConfig.sessionId) {
      this.sessionClient = new AgentSessionClient(this.agentConfig.sessionId, this);
      this.sessionClient.start();
    }
  }

  private handleUIEvent(event: string, data?: unknown): void {
    switch (event) {
      case 'start_game':
        this.startGame(data as Faction);
        break;
      case 'return_menu':
        this.returnToMenu();
        break;
      case 'train_unit': {
        const { unitType, buildingId } = data as { unitType: UnitType; buildingId: number };
        if (this.world.trainUnit(buildingId, unitType)) {
          this.audio.playTrain();
        }
        this.ui.updateSelection(this.world.state);
        break;
      }
      case 'start_build': {
        const buildingType = data as BuildingType;
        this.startBuildPlacement(buildingType);
        break;
      }
      case 'age_up':
        if (this.world.advanceAge(0)) {
          this.audio.playAgeUp();
        }
        break;
      case 'selection_changed':
        this.ui.updateSelection(this.world.state);
        break;
      case 'command_move':
      case 'command_attack':
      case 'command_gather':
        this.audio.playClick();
        break;
      case 'building_placed':
        this.audio.playBuild();
        break;
    }
  }

  getAgentConfig(): AgentModeConfig {
    return this.agentConfig;
  }

  getSnapshot(): AgentSnapshot {
    const state = this.world?.state;
    const players = state?.players ?? [];

    return {
      phase: state?.phase ?? GamePhase.MENU,
      tick: state?.tick ?? 0,
      selectedIds: state ? [...state.selectedIds] : [],
      buildPlacementType: state?.buildPlacementType ?? null,
      player: players[0]
        ? {
            id: players[0].id,
            faction: players[0].faction,
            resources: { ...players[0].resources },
            population: players[0].population,
            maxPopulation: players[0].maxPopulation,
            age: players[0].age,
            isAI: players[0].isAI,
            defeated: players[0].defeated,
          }
        : null,
      opponent: players[1]
        ? {
            id: players[1].id,
            faction: players[1].faction,
            resources: { ...players[1].resources },
            population: players[1].population,
            maxPopulation: players[1].maxPopulation,
            age: players[1].age,
            isAI: players[1].isAI,
            defeated: players[1].defeated,
          }
        : null,
      units: state
        ? [...state.units.values()].map((unit) => ({
            id: unit.id,
            type: unit.type,
            owner: unit.owner,
            x: unit.x,
            z: unit.z,
            hp: unit.hp,
            maxHp: unit.maxHp,
            state: unit.state,
            targetX: unit.targetX,
            targetZ: unit.targetZ,
            attackTargetId: unit.attackTargetId,
            carryType: unit.carryType,
            carryAmount: unit.carryAmount,
            gatherTargetX: unit.gatherTargetX,
            gatherTargetZ: unit.gatherTargetZ,
            buildTargetId: unit.buildTargetId,
          }))
        : [],
      buildings: state
        ? [...state.buildings.values()].map((building) => ({
            id: building.id,
            type: building.type,
            owner: building.owner,
            tileX: building.tileX,
            tileZ: building.tileZ,
            hp: building.hp,
            maxHp: building.maxHp,
            buildProgress: building.buildProgress,
            isComplete: building.isComplete,
            productionQueue: [...building.productionQueue],
            productionProgress: building.productionProgress,
            rallyX: building.rallyX,
            rallyZ: building.rallyZ,
          }))
        : [],
      notifications: state
        ? state.notifications.map((notification) => ({
            text: notification.text,
            type: notification.type,
            time: notification.time,
          }))
        : [],
    };
  }

  public startGame(faction: Faction): void {
    if (this.world) {
      this.controls?.dispose();
      this.world.stopTicking();
      this.world.state.phase = GamePhase.MENU;
    }

    if (this.terrain) {
      this.scene.scene.remove(this.terrain.group);
    }
    if (this.entities) {
      this.scene.scene.remove(this.entities.unitGroup);
      this.scene.scene.remove(this.entities.buildingGroup);
    }

    this.uiUpdateCounter = 0;
    this.world = new GameWorld();
    this.entities = new EntityRenderer();
    this.scene.scene.add(this.entities.unitGroup);
    this.scene.scene.add(this.entities.buildingGroup);

    this.world.startGame(faction);

    this.terrain = new TerrainRenderer(this.world.map);
    this.scene.scene.add(this.terrain.group);

    this.controls = new InputControls(
      this.scene, this.world, this.entities,
      (event, data) => this.handleUIEvent(event, data)
    );

    this.ai = new AIPlayer(this.world, 1);
    this.lastSimulationTime = 0;

    this.setupWorldEvents();

    for (const unit of this.world.state.units.values()) {
      const player = this.world.state.players[unit.owner];
      this.entities.createUnitVisual(unit, player.faction);
    }
    for (const building of this.world.state.buildings.values()) {
      const player = this.world.state.players[building.owner];
      this.entities.createBuildingVisual(building, player.faction);
    }

    if (!this.gameLoopBound) {
      this.gameLoopBound = (dt: number, t: number) => this.gameLoop(dt, t);
      this.scene.onAnimate(this.gameLoopBound);
    }
    this.ui.showScreen('hud');

    const citadel = [...this.world.state.buildings.values()].find(
      (b) => b.owner === 0 && b.type === BuildingType.CITADEL
    );
    if (citadel) {
      const def = BUILDING_DEFS[citadel.type];
      this.scene.cameraTarget.set(
        (citadel.tileX + def.size / 2) * 2,
        0,
        (citadel.tileZ + def.size / 2) * 2
      );
      this.scene.updateCameraPosition();
    }
  }

  setSelection(ids: number[]): number[] {
    if (!this.world) return [];

    const validIds = ids.filter((id) => this.world.state.units.has(id) || this.world.state.buildings.has(id));
    this.world.state.selectedIds.clear();
    for (const id of validIds) {
      this.world.state.selectedIds.add(id);
    }
    this.ui.updateSelection(this.world.state);
    return [...this.world.state.selectedIds];
  }

  startBuildPlacement(buildingType: BuildingType): boolean {
    if (!this.world || this.world.state.phase !== GamePhase.PLAYING || !this.controls) {
      return false;
    }
    this.controls.startBuildPlacement(buildingType);
    this.ui.updateSelection(this.world.state);
    return true;
  }

  private canPlaceBuildingForAgent(buildingType: BuildingType, tileX: number, tileZ: number): boolean {
    if (!this.world) return false;

    const def = BUILDING_DEFS[buildingType];
    if (!this.world.map.canPlaceBuilding(tileX, tileZ, def.size)) {
      return false;
    }

    if (!def.requiresResource) {
      return true;
    }

    for (let dx = -1; dx <= def.size; dx++) {
      for (let dz = -1; dz <= def.size; dz++) {
        const tx = tileX + dx;
        const tz = tileZ + dz;
        if (!this.world.map.inBounds(tx, tz)) {
          continue;
        }

        const tile = this.world.map.tiles[tx][tz];
        if (tile.hasResource === def.requiresResource && tile.resourceAmount > 0) {
          return true;
        }
      }
    }

    return false;
  }

  findBuildLocation(buildingType: BuildingType, owner = 0): { tileX: number; tileZ: number } | null {
    if (!this.world) return null;

    const anchor = [...this.world.state.buildings.values()].find(
      (building) => building.owner === owner && building.type === BuildingType.CITADEL
    ) ?? [...this.world.state.buildings.values()].find((building) => building.owner === owner);

    const anchorX = anchor ? anchor.tileX : Math.floor(this.world.state.mapWidth / 2);
    const anchorZ = anchor ? anchor.tileZ : Math.floor(this.world.state.mapHeight / 2);

    for (let radius = 2; radius < 12; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;

          const tileX = anchorX + dx;
          const tileZ = anchorZ + dz;
          if (!this.world.map.inBounds(tileX, tileZ)) continue;
          if (this.canPlaceBuildingForAgent(buildingType, tileX, tileZ)) {
            return { tileX, tileZ };
          }
        }
      }
    }

    for (let tileX = 0; tileX < this.world.state.mapWidth; tileX++) {
      for (let tileZ = 0; tileZ < this.world.state.mapHeight; tileZ++) {
        if (this.canPlaceBuildingForAgent(buildingType, tileX, tileZ)) {
          return { tileX, tileZ };
        }
      }
    }

    return null;
  }

  private findNearestBuilder(tileX: number, tileZ: number): number | null {
    if (!this.world) return null;

    let bestId: number | null = null;
    let bestDistance = Infinity;

    for (const [id, unit] of this.world.state.units) {
      if (unit.owner !== 0 || unit.state === UnitState.DEAD) continue;
      if (!UNIT_DEFS[unit.type].canBuild) continue;

      const distance = Math.hypot(unit.x - tileX, unit.z - tileZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }

    return bestId;
  }

  placeBuilding(buildingType: BuildingType, tileX?: number, tileZ?: number): boolean {
    if (!this.world || this.world.state.phase !== GamePhase.PLAYING) {
      return false;
    }

    const location = tileX !== undefined && tileZ !== undefined
      ? { tileX, tileZ }
      : this.findBuildLocation(buildingType, 0);
    if (!location) {
      return false;
    }

    const selectedBuilder = [...this.world.state.selectedIds].find((id) => {
      const unit = this.world.state.units.get(id);
      return unit && unit.owner === 0 && UNIT_DEFS[unit.type].canBuild;
    });
    const workerId = selectedBuilder ?? this.findNearestBuilder(location.tileX, location.tileZ);
    if (workerId === null) {
      return false;
    }

    const didPlace = this.world.commandBuild(workerId, buildingType, location.tileX, location.tileZ);
    if (!didPlace) {
      return false;
    }

    this.world.state.buildPlacementType = null;
    this.entities.hideBuildGhost();
    this.ui.updateResources(this.world.state);
    this.ui.updateSelection(this.world.state);
    this.ui.updateMinimap(this.world.state);
    return true;
  }

  trainUnit(unitType: UnitType, buildingId?: number): boolean {
    if (!this.world) return false;

    const resolvedBuildingId = buildingId ?? [...this.world.state.buildings.values()].find(
      (building) => building.owner === 0 && building.isComplete && BUILDING_DEFS[building.type].canTrain.includes(unitType)
    )?.id;
    if (!resolvedBuildingId) {
      return false;
    }

    const didTrain = this.world.trainUnit(resolvedBuildingId, unitType);
    if (didTrain) {
      this.ui.updateResources(this.world.state);
      this.ui.updateSelection(this.world.state);
    }
    return didTrain;
  }

  advanceAge(playerId = 0): boolean {
    if (!this.world) return false;

    const didAdvance = this.world.advanceAge(playerId);
    if (didAdvance) {
      this.ui.updateResources(this.world.state);
      this.ui.updateSelection(this.world.state);
    }
    return didAdvance;
  }

  private resolveOwnUnitIds(unitIds?: number[]): number[] {
    if (!this.world) return [];

    const candidateIds = unitIds ?? [...this.world.state.selectedIds];
    return candidateIds.filter((id) => {
      const unit = this.world.state.units.get(id);
      return Boolean(unit && unit.owner === 0);
    });
  }

  moveUnits(x: number, z: number, unitIds?: number[]): boolean {
    if (!this.world) return false;

    const ids = this.resolveOwnUnitIds(unitIds);
    if (ids.length === 0) return false;

    this.world.commandMove(ids, x, z, 0);
    this.entities.showMoveMarker(x * TILE_SIZE, z * TILE_SIZE);
    return true;
  }

  gatherUnits(tileX: number, tileZ: number, unitIds?: number[]): boolean {
    if (!this.world) return false;

    const ids = this.resolveOwnUnitIds(unitIds);
    if (ids.length === 0) return false;

    this.world.commandGather(ids, tileX, tileZ, 0);
    return true;
  }

  attackUnits(targetId: number, unitIds?: number[]): boolean {
    if (!this.world) return false;

    const ids = this.resolveOwnUnitIds(unitIds);
    if (ids.length === 0) return false;

    this.world.commandAttack(ids, targetId, 0);
    return true;
  }

  stopUnits(unitIds?: number[]): number[] {
    if (!this.world) return [];

    const ids = this.resolveOwnUnitIds(unitIds);
    for (const id of ids) {
      const unit = this.world.state.units.get(id);
      if (!unit) continue;
      unit.state = UnitState.IDLE;
      unit.path = [];
      unit.attackTargetId = null;
      unit.buildTargetId = null;
    }
    this.ui.updateSelection(this.world.state);
    return ids;
  }

  private setupWorldEvents(): void {
    this.world.on((event, data) => {
      switch (event) {
        case 'tick':
          this.ai?.update();
          break;
        case 'unit_created': {
          const unit = data as import('./types').Unit;
          const player = this.world.state.players[unit.owner];
          this.entities.createUnitVisual(unit, player.faction);
          break;
        }
        case 'building_created': {
          const building = data as import('./types').Building;
          const player = this.world.state.players[building.owner];
          this.entities.createBuildingVisual(building, player.faction);
          break;
        }
        case 'unit_died': {
          const unit = data as import('./types').Unit;
          this.entities.removeEntity(unit.id);
          break;
        }
        case 'building_destroyed': {
          const building = data as import('./types').Building;
          this.entities.removeEntity(building.id);
          break;
        }
        case 'attack':
          this.audio.playSword();
          break;
        case 'notification': {
          const { text, type } = data as { text: string; type: string };
          this.ui.addNotification(text, type);
          break;
        }
        case 'game_over': {
          const result = data as string;
          if (result === 'victory') {
            this.audio.playVictory();
            this.ui.showResult('victory', this.world.state);
          } else {
            this.audio.playDefeat();
            this.ui.showResult('defeat', this.world.state);
          }
          break;
        }
        case 'building_complete':
          this.audio.playBuild();
          break;
        case 'age_advance':
          this.audio.playAgeUp();
          break;
      }
    });
  }

  private gameLoop(_dt: number, t: number): void {
    if (this.world?.state.phase !== GamePhase.PLAYING) return;

    const elapsedSeconds = this.lastSimulationTime > 0
      ? Math.min(1, Math.max(0, t - this.lastSimulationTime))
      : 0;
    this.lastSimulationTime = t;
    this.world.advance(elapsedSeconds);

    this.controls?.update();
    this.terrain?.update(t);

    const tiles = this.world?.map.tiles;
    this.entities?.updateUnits(this.world.state.units, this.world.state.selectedIds, t, this.scene.camera, tiles);
    this.entities?.updateBuildings(this.world.state.buildings, this.world.state.selectedIds, t, tiles);

    this.uiUpdateCounter++;
    if (this.uiUpdateCounter % 6 === 0) {
      this.ui.updateResources(this.world.state);
      this.ui.updateSelection(this.world.state);
      this.ui.updateMinimap(this.world.state);
    }
  }

  public returnToMenu(): void {
    this.controls?.dispose();
    if (!this.world) return;

    this.world.state.selectedIds.clear();
    this.world.state.buildPlacementType = null;
    this.world.state.phase = GamePhase.MENU;
    this.world.stopTicking();
    this.uiUpdateCounter = 0;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AetheriaGame());
} else {
  new AetheriaGame();
}
