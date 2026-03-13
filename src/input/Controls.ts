import * as THREE from 'three';
import { BuildingType, TerrainType, UnitState } from '../types';
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
  private canvas: HTMLCanvasElement;

  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private keys = new Set<string>();
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private mouseX = 0;
  private mouseY = 0;
  private selectionBox: HTMLDivElement | null = null;
  private lastClickTime = 0;
  private lastClickId: number | null = null;

  private panSpeed = 0.8;
  private zoomSpeed = 2;
  private rotateSpeed = 0.02;
  private edgePanMargin = 30;
  private readonly mouseDownHandler = (e: MouseEvent): void => this.onMouseDown(e);
  private readonly mouseMoveHandler = (e: MouseEvent): void => this.onMouseMove(e);
  private readonly mouseUpHandler = (e: MouseEvent): void => this.onMouseUp(e);
  private readonly contextMenuHandler = (e: Event): void => e.preventDefault();
  private readonly wheelHandler = (e: WheelEvent): void => this.onWheel(e);
  private readonly keyDownHandler = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
    this.handleKeyDown(e);
  };
  private readonly keyUpHandler = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  constructor(scene: SceneSetup, world: GameWorld, entities: EntityRenderer, onEvent: ControlEvent) {
    this.scene = scene;
    this.world = world;
    this.entities = entities;
    this.onEvent = onEvent;
    this.canvas = this.scene.renderer.domElement;
    this.createSelectionBox();
    this.setupListeners();
  }

  private createSelectionBox(): void {
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'selection-box';
    document.body.appendChild(this.selectionBox);
  }

  private updateSelectionBoxVisual(e: MouseEvent): void {
    if (!this.selectionBox || !this.isDragging) return;
    const dx = Math.abs(e.clientX - this.dragStart.x);
    const dy = Math.abs(e.clientY - this.dragStart.y);
    if (dx > 5 || dy > 5) {
      const left = Math.min(this.dragStart.x, e.clientX);
      const top = Math.min(this.dragStart.y, e.clientY);
      const width = Math.abs(e.clientX - this.dragStart.x);
      const height = Math.abs(e.clientY - this.dragStart.y);
      this.selectionBox.style.left = left + 'px';
      this.selectionBox.style.top = top + 'px';
      this.selectionBox.style.width = width + 'px';
      this.selectionBox.style.height = height + 'px';
      this.selectionBox.style.display = 'block';
    }
  }

  private hideSelectionBox(): void {
    if (this.selectionBox) {
      this.selectionBox.style.display = 'none';
    }
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousedown', this.mouseDownHandler);
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
    this.canvas.addEventListener('mouseup', this.mouseUpHandler);
    this.canvas.addEventListener('contextmenu', this.contextMenuHandler);
    this.canvas.addEventListener('wheel', this.wheelHandler, { passive: true });

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
    this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
    this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
    this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    this.canvas.removeEventListener('wheel', this.wheelHandler);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);

    this.keys.clear();
    this.isDragging = false;
    this.hideSelectionBox();
    if (this.selectionBox && this.selectionBox.parentElement) {
      this.selectionBox.parentElement.removeChild(this.selectionBox);
      this.selectionBox = null;
    }
    this.world.state.buildPlacementType = null;
    this.entities.hideBuildGhost();
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

    if (this.isDragging && !this.world.state.buildPlacementType) {
      this.updateSelectionBoxVisual(e);
    }

    if (this.world.state.buildPlacementType) {
      this.updateBuildGhost(e);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button !== 0) return;

    this.hideSelectionBox();

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

    const now = performance.now();
    const isDoubleClick = clickedEntityId !== null &&
      clickedEntityId === this.lastClickId &&
      (now - this.lastClickTime) < 350;
    this.lastClickTime = now;
    this.lastClickId = clickedEntityId;

    if (isDoubleClick && clickedEntityId !== null) {
      const clickedUnit = this.world.state.units.get(clickedEntityId);
      if (clickedUnit && clickedUnit.owner === 0) {
        this.world.state.selectedIds.clear();
        for (const [id, unit] of this.world.state.units) {
          if (unit.owner === 0 && unit.type === clickedUnit.type && unit.state !== UnitState.DEAD) {
            const screenPos = new THREE.Vector3(unit.x * TILE_SIZE, 0.5, unit.z * TILE_SIZE);
            screenPos.project(this.scene.camera);
            const sx = (screenPos.x + 1) / 2 * window.innerWidth;
            const sy = (-screenPos.y + 1) / 2 * window.innerHeight;
            if (sx >= 0 && sx <= window.innerWidth && sy >= 0 && sy <= window.innerHeight) {
              this.world.state.selectedIds.add(id);
            }
          }
        }
        this.onEvent('selection_changed');
        return;
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

    if (e.key === 's' && !e.ctrlKey && !e.shiftKey) {
      for (const id of this.world.state.selectedIds) {
        const unit = this.world.state.units.get(id);
        if (unit) {
          unit.state = UnitState.IDLE;
          unit.path = [];
          unit.attackTargetId = null;
        }
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.world.state.selectedIds.clear();
      this.onEvent('selection_changed');
    }

    if (e.key === ' ') {
      e.preventDefault();
      const citadel = [...this.world.state.buildings.values()].find(
        b => b.owner === 0 && b.type === BuildingType.CITADEL && b.hp > 0
      );
      if (citadel) {
        const def = BUILDING_DEFS[citadel.type];
        this.scene.cameraTarget.set(
          (citadel.tileX + def.size / 2) * TILE_SIZE,
          0,
          (citadel.tileZ + def.size / 2) * TILE_SIZE
        );
        this.scene.updateCameraPosition();
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const ownUnits = [...this.world.state.units.entries()]
        .filter(([, u]) => u.owner === 0 && u.state !== UnitState.DEAD);
      if (ownUnits.length > 0) {
        const currentIds = [...this.world.state.selectedIds];
        const currentIdx = currentIds.length > 0
          ? ownUnits.findIndex(([id]) => id === currentIds[currentIds.length - 1])
          : -1;
        const nextIdx = (currentIdx + 1) % ownUnits.length;
        this.world.state.selectedIds.clear();
        this.world.state.selectedIds.add(ownUnits[nextIdx][0]);
        const unit = ownUnits[nextIdx][1];
        this.scene.cameraTarget.set(unit.x * TILE_SIZE, 0, unit.z * TILE_SIZE);
        this.scene.updateCameraPosition();
        this.onEvent('selection_changed');
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
    this.entities.showBuildGhost(type, tileX, tileZ, valid, this.world.map.tiles);
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
    if (workerId === null) {
      return;
    }

    const didPlaceBuilding = this.world.commandBuild(workerId, type, tileX, tileZ);
    if (!didPlaceBuilding) {
      return;
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

  update(): void {
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
