import * as THREE from 'three';
import { BuildingType, ResourceType, TerrainType, UnitState, UnitType, type Unit, type Vec2 } from '../types';
import { BUILDING_DEFS, MAP_SIZE, TILE_SIZE, UNIT_DEFS } from '../config';
import { SceneSetup } from '../render/SceneSetup';
import { GameWorld } from '../core/GameState';
import { EntityRenderer } from '../render/EntityModels';

export type ControlEvent = (event: string, data?: unknown) => void;

export class InputControls {
  private scene: SceneSetup;
  private world: GameWorld;
  private entities: EntityRenderer;
  private onEvent: ControlEvent;

  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private keys = new Set<string>();
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private mouseX = 0;
  private mouseY = 0;

  private panSpeed = 0.8;
  private zoomSpeed = 2;
  private rotateSpeed = 0.02;
  private edgePanMargin = 30;

  constructor(scene: SceneSetup, world: GameWorld, entities: EntityRenderer, onEvent: ControlEvent) {
    this.scene = scene;
    this.world = world;
    this.entities = entities;
    this.onEvent = onEvent;
    this.setupListeners();
  }

  private setupListeners(): void {
    const canvas = this.scene.renderer.domElement;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      this.handleKeyDown(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
    }

    if (e.button === 2) {
      this.handleRightClick(e);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (this.world.state.buildPlacementType) {
      this.updateBuildGhost(e);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button !== 0) return;

    const dx = Math.abs(e.clientX - this.dragStart.x);
    const dy = Math.abs(e.clientY - this.dragStart.y);

    if (dx < 5 && dy < 5) {
      if (this.world.state.buildPlacementType) {
        this.handleBuildPlacement(e);
      } else {
        this.handleLeftClick(e);
      }
    } else if (dx > 10 || dy > 10) {
      this.handleBoxSelect(this.dragStart, { x: e.clientX, y: e.clientY });
    }

    this.isDragging = false;
  }

  private onWheel(e: WheelEvent): void {
    this.scene.cameraDistance += (e.deltaY > 0 ? 1 : -1) * this.zoomSpeed;
    this.scene.cameraDistance = Math.max(10, Math.min(60, this.scene.cameraDistance));
    this.scene.updateCameraPosition();
  }

  private handleLeftClick(e: MouseEvent): void {
    const worldPos = this.scene.getWorldPositionFromMouse(e.clientX, e.clientY, this.groundPlane);
    if (!worldPos) return;

    const tileX = Math.floor(worldPos.x / TILE_SIZE);
    const tileZ = Math.floor(worldPos.z / TILE_SIZE);

    let clickedEntityId: number | null = null;

    for (const [id, unit] of this.world.state.units) {
      if (unit.state === UnitState.DEAD) continue;
      const ux = unit.x * TILE_SIZE;
      const uz = unit.z * TILE_SIZE;
      const dist = Math.hypot(worldPos.x - ux, worldPos.z - uz);
      if (dist < TILE_SIZE * 0.9) {
        clickedEntityId = id;
        break;
      }
    }

    if (!clickedEntityId) {
      for (const [id, building] of this.world.state.buildings) {
        if (building.hp <= 0) continue;
        const def = BUILDING_DEFS[building.type];
        const bx = (building.tileX + def.size / 2) * TILE_SIZE;
        const bz = (building.tileZ + def.size / 2) * TILE_SIZE;
        const dist = Math.hypot(worldPos.x - bx, worldPos.z - bz);
        if (dist < def.size * TILE_SIZE * 0.6) {
          clickedEntityId = id;
          break;
        }
      }
    }

    if (!e.shiftKey) {
      this.world.state.selectedIds.clear();
    }

    if (clickedEntityId !== null) {
      this.world.state.selectedIds.add(clickedEntityId);
    }

    this.onEvent('selection_changed');
  }

  private handleRightClick(e: MouseEvent): void {
    const worldPos = this.scene.getWorldPositionFromMouse(e.clientX, e.clientY, this.groundPlane);
    if (!worldPos) return;

    const selected = this.world.state.selectedIds;
    if (selected.size === 0) return;

    const tileX = Math.floor(worldPos.x / TILE_SIZE);
    const tileZ = Math.floor(worldPos.z / TILE_SIZE);
    const targetX = worldPos.x / TILE_SIZE;
    const targetZ = worldPos.z / TILE_SIZE;

    let clickedEnemyId: number | null = null;
    for (const [id, unit] of this.world.state.units) {
      if (unit.owner === 0 || unit.state === UnitState.DEAD) continue;
      const dist = Math.hypot(unit.x - targetX, unit.z - targetZ);
      if (dist < 1) {
        clickedEnemyId = id;
        break;
      }
    }
    if (!clickedEnemyId) {
      for (const [id, building] of this.world.state.buildings) {
        if (building.owner === 0 || building.hp <= 0) continue;
        const def = BUILDING_DEFS[building.type];
        const bx = building.tileX + def.size / 2;
        const bz = building.tileZ + def.size / 2;
        if (Math.hypot(targetX - bx, targetZ - bz) < def.size) {
          clickedEnemyId = id;
          break;
        }
      }
    }

    if (clickedEnemyId) {
      this.world.commandAttack([...selected], clickedEnemyId, 0);
      this.onEvent('command_attack');
      return;
    }

    const tile = this.world.map.getTile(tileX, tileZ);
    if (tile) {
      const unitIds = [...selected].filter((id) => this.world.state.units.has(id));
      const hasWorkers = unitIds.some((id) => {
        const u = this.world.state.units.get(id);
        return u && UNIT_DEFS[u.type].canGather;
      });

      if (hasWorkers && (tile.terrain === TerrainType.FOREST ||
        (tile.hasResource && tile.resourceAmount > 0))) {
        const workerIds = unitIds.filter((id) => {
          const u = this.world.state.units.get(id);
          return u && UNIT_DEFS[u.type].canGather;
        });
        this.world.commandGather(workerIds, tileX, tileZ, 0);
        const nonWorkerIds = unitIds.filter((id) => {
          const u = this.world.state.units.get(id);
          return u && !UNIT_DEFS[u.type].canGather;
        });
        if (nonWorkerIds.length > 0) {
          this.world.commandMove(nonWorkerIds, targetX, targetZ, 0);
        }
        this.onEvent('command_gather');
        return;
      }

      this.world.commandMove(unitIds, targetX, targetZ, 0);
      this.entities.showMoveMarker(worldPos.x, worldPos.z);
      this.onEvent('command_move');
    }
  }

  private handleBoxSelect(start: { x: number; y: number }, end: { x: number; y: number }): void {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    this.world.state.selectedIds.clear();

    for (const [id, unit] of this.world.state.units) {
      if (unit.owner !== 0 || unit.state === UnitState.DEAD) continue;

      const worldPos = new THREE.Vector3(unit.x * TILE_SIZE, 0.5, unit.z * TILE_SIZE);
      worldPos.project(this.scene.camera);

      const screenX = (worldPos.x + 1) / 2 * window.innerWidth;
      const screenY = (-worldPos.y + 1) / 2 * window.innerHeight;

      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
        this.world.state.selectedIds.add(id);
      }
    }

    this.onEvent('selection_changed');
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.world.state.buildPlacementType) {
        this.world.state.buildPlacementType = null;
        this.entities.hideBuildGhost();
      } else {
        this.world.state.selectedIds.clear();
        this.onEvent('selection_changed');
      }
    }

    if (e.key === 's' && !e.ctrlKey) {
      for (const id of this.world.state.selectedIds) {
        const unit = this.world.state.units.get(id);
        if (unit) {
          unit.state = UnitState.IDLE;
          unit.path = [];
          unit.attackTargetId = null;
        }
      }
    }
  }

  startBuildPlacement(type: BuildingType): void {
    this.world.state.buildPlacementType = type;
  }

  private updateBuildGhost(e: MouseEvent): void {
    const type = this.world.state.buildPlacementType;
    if (!type) return;

    const worldPos = this.scene.getWorldPositionFromMouse(e.clientX, e.clientY, this.groundPlane);
    if (!worldPos) return;

    const def = BUILDING_DEFS[type];
    const tileX = Math.floor(worldPos.x / TILE_SIZE);
    const tileZ = Math.floor(worldPos.z / TILE_SIZE);
    const valid = this.world.map.canPlaceBuilding(tileX, tileZ, def.size);
    this.entities.showBuildGhost(type, tileX, tileZ, valid);
  }

  private handleBuildPlacement(e: MouseEvent): void {
    const type = this.world.state.buildPlacementType;
    if (!type) return;

    const worldPos = this.scene.getWorldPositionFromMouse(e.clientX, e.clientY, this.groundPlane);
    if (!worldPos) return;

    const tileX = Math.floor(worldPos.x / TILE_SIZE);
    const tileZ = Math.floor(worldPos.z / TILE_SIZE);

    const workers = [...this.world.state.selectedIds].filter((id) => {
      const u = this.world.state.units.get(id);
      return u && u.owner === 0 && UNIT_DEFS[u.type].canBuild;
    });

    const workerId = workers.length > 0 ? workers[0] : this.findNearestWorker(tileX, tileZ);
    if (workerId !== null) {
      this.world.commandBuild(workerId, type, tileX, tileZ);
    }

    this.world.state.buildPlacementType = null;
    this.entities.hideBuildGhost();
    this.onEvent('building_placed');
  }

  private findNearestWorker(tileX: number, tileZ: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const [id, unit] of this.world.state.units) {
      if (unit.owner !== 0 || !UNIT_DEFS[unit.type].canBuild || unit.state === UnitState.DEAD) continue;
      const dist = Math.hypot(unit.x - tileX, unit.z - tileZ);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    return best;
  }

  update(dt: number): void {
    let dx = 0;
    let dz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup') || this.mouseY < this.edgePanMargin) dx -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown') || this.mouseY > window.innerHeight - this.edgePanMargin) dx += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft') || this.mouseX < this.edgePanMargin) dz -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright') || this.mouseX > window.innerWidth - this.edgePanMargin) dz += 1;

    if (dx !== 0 || dz !== 0) {
      const angle = this.scene.cameraAngle;
      this.scene.cameraTarget.x += (Math.sin(angle) * dx + Math.cos(angle) * dz) * this.panSpeed;
      this.scene.cameraTarget.z += (Math.cos(angle) * dx - Math.sin(angle) * dz) * this.panSpeed;

      const max = MAP_SIZE * TILE_SIZE;
      this.scene.cameraTarget.x = Math.max(0, Math.min(max, this.scene.cameraTarget.x));
      this.scene.cameraTarget.z = Math.max(0, Math.min(max, this.scene.cameraTarget.z));
      this.scene.updateCameraPosition();
    }

    if (this.keys.has('q')) {
      this.scene.cameraAngle += this.rotateSpeed;
      this.scene.updateCameraPosition();
    }
    if (this.keys.has('e')) {
      this.scene.cameraAngle -= this.rotateSpeed;
      this.scene.updateCameraPosition();
    }
  }
}
