import './style.css';
import { Faction, GamePhase, BuildingType, UnitType } from './types';
import { BUILDING_DEFS, TICK_RATE } from './config';
import { GameWorld } from './core/GameState';
import { SceneSetup } from './render/SceneSetup';
import { TerrainRenderer } from './render/Terrain';
import { EntityRenderer } from './render/EntityModels';
import { InputControls } from './input/Controls';
import { GameUI } from './ui/GameUI';
import { AIPlayer } from './ai/AIPlayer';
import { GameAudio } from './audio/Sounds';

class AetheriaGame {
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

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const uiLayer = document.getElementById('ui-layer') as HTMLElement;

    this.scene = new SceneSetup(canvas);
    this.audio = new GameAudio();
    this.ui = new GameUI(uiLayer, (event, data) => this.handleUIEvent(event, data));
    this.ui.init();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.world) {
        this.startGame(Faction.SOLARI);
      }
    });

    this.scene.start();
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
        this.controls.startBuildPlacement(buildingType);
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

  private startGame(faction: Faction): void {
    if (this.world) {
      this.world.stopTicking();
    }

    if (this.terrain) {
      this.scene.scene.remove(this.terrain.group);
    }
    if (this.entities) {
      this.scene.scene.remove(this.entities.unitGroup);
      this.scene.scene.remove(this.entities.buildingGroup);
    }

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

  private setupWorldEvents(): void {
    this.world.on((event, data) => {
      switch (event) {
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

  private gameLoop(dt: number, t: number): void {
    if (this.world?.state.phase !== GamePhase.PLAYING) return;

    this.controls?.update(dt);
    this.terrain?.update(t);
    this.ai?.update();

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

  private returnToMenu(): void {
    this.world?.stopTicking();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AetheriaGame());
} else {
  new AetheriaGame();
}
