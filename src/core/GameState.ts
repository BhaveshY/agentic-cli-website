import {
  Age, BuildingType, Faction, GamePhase, ResourceType, TerrainType,
  UnitState, UnitType,
  type Building, type GameState, type Notification, type Player, type Resources, type Unit, type Vec2,
} from '../types';
import {
  AGGRO_RANGE, BUILDING_DEFS, MAP_SIZE, STARTING_RESOURCES,
  TICK_RATE, TILE_SIZE, UNIT_DEFS, WORKER_CARRY_CAPACITY, WORKER_GATHER_RATE,
  AGE_COSTS,
} from '../config';
import { GameMap } from './GameMap';

export type GameEventCb = (event: string, data?: unknown) => void;

export class GameWorld {
  state: GameState;
  map: GameMap;
  private listeners: GameEventCb[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.map = new GameMap(Math.floor(Math.random() * 100000));
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    const state: GameState = {
      phase: GamePhase.MENU,
      tick: 0,
      mapWidth: MAP_SIZE,
      mapHeight: MAP_SIZE,
      tiles: this.map.tiles,
      players: [],
      units: new Map(),
      buildings: new Map(),
      nextEntityId: 1,
      selectedIds: new Set(),
      buildPlacementType: null,
      notifications: [],
    };
    return state;
  }

  on(cb: GameEventCb): void {
    this.listeners.push(cb);
  }

  emit(event: string, data?: unknown): void {
    for (const cb of this.listeners) cb(event, data);
  }

  startGame(playerFaction: Faction): void {
    this.map = new GameMap(Math.floor(Math.random() * 100000));
    this.state = this.createInitialState();

    const aiFaction = playerFaction === Faction.SOLARI ? Faction.IRONROOT : Faction.SOLARI;
    this.state.players = [
      this.createPlayer(0, playerFaction, false),
      this.createPlayer(1, aiFaction, true),
    ];

    this.spawnStartingBase(0, 5, 5);
    this.spawnStartingBase(1, MAP_SIZE - 6, MAP_SIZE - 6);

    this.state.phase = GamePhase.PLAYING;
    this.emit('game_start');
    this.startTicking();
  }

  private createPlayer(id: number, faction: Faction, isAI: boolean): Player {
    return {
      id,
      faction,
      resources: { ...STARTING_RESOURCES } as Resources,
      population: 0,
      maxPopulation: 0,
      age: Age.DAWN,
      isAI,
      defeated: false,
    };
  }

  private spawnStartingBase(playerId: number, cx: number, cz: number): void {
    this.createBuilding(BuildingType.CITADEL, playerId, cx - 1, cz - 1, true);

    const workerPositions: Vec2[] = [
      { x: cx - 2, z: cz + 2 },
      { x: cx, z: cz + 2 },
      { x: cx + 2, z: cz + 2 },
    ];
    for (const pos of workerPositions) {
      this.createUnit(UnitType.WORKER, playerId, pos.x, pos.z);
    }
  }

  createBuilding(
    type: BuildingType,
    owner: number,
    tileX: number,
    tileZ: number,
    instant = false
  ): Building | null {
    const def = BUILDING_DEFS[type];

    if (!this.map.canPlaceBuilding(tileX, tileZ, def.size)) return null;

    const id = this.state.nextEntityId++;
    const building: Building = {
      id,
      type,
      owner,
      tileX,
      tileZ,
      hp: instant ? def.hp : 1,
      maxHp: def.hp,
      buildProgress: instant ? 100 : 0,
      isComplete: instant,
      productionQueue: [],
      productionProgress: 0,
      rallyX: tileX + def.size / 2,
      rallyZ: tileZ + def.size + 1,
      attackCooldown: 0,
    };

    for (let dx = 0; dx < def.size; dx++) {
      for (let dz = 0; dz < def.size; dz++) {
        this.map.tiles[tileX + dx][tileZ + dz].buildingId = id;
        this.map.tiles[tileX + dx][tileZ + dz].passable = false;
      }
    }

    this.state.buildings.set(id, building);

    if (instant && def.popProvided > 0) {
      this.state.players[owner].maxPopulation += def.popProvided;
    }

    this.emit('building_created', building);
    return building;
  }

  createUnit(type: UnitType, owner: number, x: number, z: number): Unit | null {
    const def = UNIT_DEFS[type];
    const player = this.state.players[owner];
    if (player.population + def.popCost > player.maxPopulation) return null;

    const id = this.state.nextEntityId++;
    const unit: Unit = {
      id, type, owner,
      x, z,
      hp: def.hp,
      maxHp: def.hp,
      state: UnitState.IDLE,
      targetX: x,
      targetZ: z,
      attackTargetId: null,
      path: [],
      pathIndex: 0,
      carryType: null,
      carryAmount: 0,
      gatherTargetX: -1,
      gatherTargetZ: -1,
      buildTargetId: null,
      attackCooldown: 0,
      moveProgress: 0,
      stateTimer: 0,
    };

    player.population += def.popCost;
    this.state.units.set(id, unit);
    this.emit('unit_created', unit);
    return unit;
  }

  commandMove(unitIds: number[], targetX: number, targetZ: number): void {
    for (const id of unitIds) {
      const unit = this.state.units.get(id);
      if (!unit || unit.owner !== 0) continue;

      unit.state = UnitState.MOVING;
      unit.targetX = targetX;
      unit.targetZ = targetZ;
      unit.attackTargetId = null;
      unit.buildTargetId = null;
      unit.path = this.map.findPath(unit.x, unit.z, targetX, targetZ);
      unit.pathIndex = 0;
    }
  }

  commandAttack(unitIds: number[], targetId: number): void {
    for (const id of unitIds) {
      const unit = this.state.units.get(id);
      if (!unit || unit.owner !== 0) continue;
      unit.state = UnitState.ATTACKING;
      unit.attackTargetId = targetId;
    }
  }

  commandGather(unitIds: number[], tileX: number, tileZ: number): void {
    for (const id of unitIds) {
      const unit = this.state.units.get(id);
      if (!unit || unit.owner !== 0) continue;
      const def = UNIT_DEFS[unit.type];
      if (!def.canGather) continue;

      unit.gatherTargetX = tileX;
      unit.gatherTargetZ = tileZ;
      unit.state = UnitState.MOVING;
      unit.targetX = tileX;
      unit.targetZ = tileZ;
      unit.path = this.map.findPath(unit.x, unit.z, tileX, tileZ);
      unit.pathIndex = 0;
    }
  }

  commandBuild(unitId: number, buildingType: BuildingType, tileX: number, tileZ: number): void {
    const unit = this.state.units.get(unitId);
    if (!unit) return;

    const def = BUILDING_DEFS[buildingType];
    const player = this.state.players[unit.owner];

    for (const [res, amount] of Object.entries(def.cost) as [ResourceType, number][]) {
      if ((player.resources[res] || 0) < amount) return;
    }

    if (!this.map.canPlaceBuilding(tileX, tileZ, def.size)) return;

    if (def.requiresResource) {
      let hasResource = false;
      for (let dx = -1; dx <= def.size; dx++) {
        for (let dz = -1; dz <= def.size; dz++) {
          const tx = tileX + dx;
          const tz = tileZ + dz;
          if (this.map.inBounds(tx, tz)) {
            const tile = this.map.tiles[tx][tz];
            if (tile.hasResource === def.requiresResource && tile.resourceAmount > 0) {
              hasResource = true;
            }
          }
        }
      }
      if (!hasResource) return;
    }

    for (const [res, amount] of Object.entries(def.cost) as [ResourceType, number][]) {
      player.resources[res] -= amount;
    }

    const building = this.createBuilding(buildingType, unit.owner, tileX, tileZ);
    if (building) {
      unit.buildTargetId = building.id;
      unit.state = UnitState.MOVING;
      unit.targetX = tileX;
      unit.targetZ = tileZ;
      unit.path = this.map.findPath(unit.x, unit.z, tileX, tileZ);
      unit.pathIndex = 0;
    }
  }

  trainUnit(buildingId: number, unitType: UnitType): boolean {
    const building = this.state.buildings.get(buildingId);
    if (!building || !building.isComplete) return false;

    const bDef = BUILDING_DEFS[building.type];
    if (!bDef.canTrain.includes(unitType)) return false;

    const uDef = UNIT_DEFS[unitType];
    const player = this.state.players[building.owner];

    if (uDef.minAge > player.age) return false;

    for (const [res, amount] of Object.entries(uDef.cost) as [ResourceType, number][]) {
      if ((player.resources[res] || 0) < amount) return false;
    }

    for (const [res, amount] of Object.entries(uDef.cost) as [ResourceType, number][]) {
      player.resources[res] -= amount;
    }

    building.productionQueue.push(unitType);
    return true;
  }

  advanceAge(playerId: number): boolean {
    const player = this.state.players[playerId];
    if (player.age >= Age.ZENITH) return false;

    const nextAge = (player.age + 1) as Age;
    const costs = AGE_COSTS[nextAge];

    for (const [res, amount] of Object.entries(costs) as [ResourceType, number][]) {
      if ((player.resources[res] || 0) < (amount || 0)) return false;
    }

    for (const [res, amount] of Object.entries(costs) as [ResourceType, number][]) {
      player.resources[res] -= amount || 0;
    }

    player.age = nextAge;
    this.addNotification(
      `${player.isAI ? 'Enemy' : 'You'} advanced to Age ${nextAge}!`,
      'age'
    );
    this.emit('age_advance', { playerId, age: nextAge });
    return true;
  }

  private startTicking(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  stopTicking(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick(): void {
    if (this.state.phase !== GamePhase.PLAYING) return;
    this.state.tick++;

    this.updateUnits();
    this.updateBuildings();
    this.updateCombat();
    this.checkVictory();
    this.cleanupNotifications();

    this.emit('tick', this.state.tick);
  }

  private updateUnits(): void {
    for (const unit of this.state.units.values()) {
      if (unit.state === UnitState.DEAD) continue;
      if (unit.hp <= 0) {
        unit.state = UnitState.DEAD;
        this.state.players[unit.owner].population -= UNIT_DEFS[unit.type].popCost;
        this.emit('unit_died', unit);
        continue;
      }

      unit.attackCooldown = Math.max(0, unit.attackCooldown - 1);

      switch (unit.state) {
        case UnitState.IDLE:
          this.autoAggro(unit);
          break;
        case UnitState.MOVING:
          this.moveUnit(unit);
          break;
        case UnitState.ATTACKING:
          this.unitAttack(unit);
          break;
        case UnitState.GATHERING:
          this.unitGather(unit);
          break;
        case UnitState.BUILDING:
          this.unitBuild(unit);
          break;
        case UnitState.RETURNING:
          this.unitReturn(unit);
          break;
      }
    }

    for (const [id, unit] of this.state.units) {
      if (unit.state === UnitState.DEAD) {
        this.state.units.delete(id);
        this.state.selectedIds.delete(id);
      }
    }
  }

  private moveUnit(unit: Unit): void {
    if (unit.path.length === 0 || unit.pathIndex >= unit.path.length) {
      if (unit.buildTargetId) {
        const building = this.state.buildings.get(unit.buildTargetId);
        if (building && !building.isComplete) {
          unit.state = UnitState.BUILDING;
          return;
        }
      }
      if (unit.gatherTargetX >= 0) {
        const dist = Math.hypot(unit.x - unit.gatherTargetX, unit.z - unit.gatherTargetZ);
        if (dist < 2) {
          unit.state = UnitState.GATHERING;
          return;
        }
      }
      unit.state = UnitState.IDLE;
      return;
    }

    const target = unit.path[unit.pathIndex];
    const dx = target.x - unit.x;
    const dz = target.z - unit.z;
    const dist = Math.hypot(dx, dz);
    const speed = UNIT_DEFS[unit.type].speed / TICK_RATE;

    if (dist < speed) {
      unit.x = target.x;
      unit.z = target.z;
      unit.pathIndex++;
    } else {
      unit.x += (dx / dist) * speed;
      unit.z += (dz / dist) * speed;
    }
  }

  private unitAttack(unit: Unit): void {
    if (!unit.attackTargetId) {
      unit.state = UnitState.IDLE;
      return;
    }

    const targetUnit = this.state.units.get(unit.attackTargetId);
    const targetBuilding = this.state.buildings.get(unit.attackTargetId);
    let targetX: number, targetZ: number, targetAlive: boolean;

    if (targetUnit) {
      targetX = targetUnit.x;
      targetZ = targetUnit.z;
      targetAlive = targetUnit.hp > 0;
    } else if (targetBuilding) {
      targetX = targetBuilding.tileX + BUILDING_DEFS[targetBuilding.type].size / 2;
      targetZ = targetBuilding.tileZ + BUILDING_DEFS[targetBuilding.type].size / 2;
      targetAlive = targetBuilding.hp > 0;
    } else {
      unit.attackTargetId = null;
      unit.state = UnitState.IDLE;
      return;
    }

    if (!targetAlive) {
      unit.attackTargetId = null;
      unit.state = UnitState.IDLE;
      return;
    }

    const dist = Math.hypot(unit.x - targetX, unit.z - targetZ);
    const def = UNIT_DEFS[unit.type];

    if (dist > def.range) {
      const dx = targetX - unit.x;
      const dz = targetZ - unit.z;
      const speed = def.speed / TICK_RATE;
      unit.x += (dx / dist) * speed;
      unit.z += (dz / dist) * speed;
    } else if (unit.attackCooldown <= 0) {
      if (targetUnit) {
        targetUnit.hp -= def.damage;
        this.emit('attack', { attacker: unit, target: targetUnit });
      } else if (targetBuilding) {
        targetBuilding.hp -= def.damage;
        this.emit('attack', { attacker: unit, target: targetBuilding });
        if (targetBuilding.hp <= 0) {
          this.destroyBuilding(targetBuilding);
        }
      }
      unit.attackCooldown = def.attackSpeed;
    }
  }

  private unitGather(unit: Unit): void {
    const tile = this.map.getTile(
      Math.round(unit.gatherTargetX),
      Math.round(unit.gatherTargetZ)
    );

    if (!tile) {
      unit.state = UnitState.IDLE;
      return;
    }

    const isForest = tile.terrain === TerrainType.FOREST;
    const isResource = tile.hasResource && tile.resourceAmount > 0;

    if (!isForest && !isResource) {
      unit.state = UnitState.IDLE;
      return;
    }

    unit.stateTimer++;
    if (unit.stateTimer >= TICK_RATE / WORKER_GATHER_RATE) {
      unit.stateTimer = 0;

      if (isResource && tile.hasResource) {
        unit.carryType = tile.hasResource;
        unit.carryAmount = Math.min(
          unit.carryAmount + 5,
          WORKER_CARRY_CAPACITY
        );
        tile.resourceAmount = Math.max(0, tile.resourceAmount - 5);
      } else if (isForest) {
        unit.carryType = ResourceType.TIMBER;
        unit.carryAmount = Math.min(
          unit.carryAmount + 5,
          WORKER_CARRY_CAPACITY
        );
      }

      if (unit.carryAmount >= WORKER_CARRY_CAPACITY) {
        unit.state = UnitState.RETURNING;
        const dropoff = this.findNearestDropoff(unit);
        if (dropoff) {
          unit.targetX = dropoff.x;
          unit.targetZ = dropoff.z;
          unit.path = this.map.findPath(unit.x, unit.z, dropoff.x, dropoff.z);
          unit.pathIndex = 0;
        }
      }
    }
  }

  private unitReturn(unit: Unit): void {
    if (unit.path.length === 0 || unit.pathIndex >= unit.path.length) {
      const player = this.state.players[unit.owner];
      if (unit.carryType) {
        player.resources[unit.carryType] += unit.carryAmount;
        this.emit('resource_delivered', {
          player: unit.owner,
          type: unit.carryType,
          amount: unit.carryAmount,
        });
      }
      unit.carryAmount = 0;
      unit.carryType = null;

      if (unit.gatherTargetX >= 0) {
        unit.state = UnitState.MOVING;
        unit.targetX = unit.gatherTargetX;
        unit.targetZ = unit.gatherTargetZ;
        unit.path = this.map.findPath(unit.x, unit.z, unit.gatherTargetX, unit.gatherTargetZ);
        unit.pathIndex = 0;
      } else {
        unit.state = UnitState.IDLE;
      }
      return;
    }
    this.moveUnit(unit);
  }

  private unitBuild(unit: Unit): void {
    if (!unit.buildTargetId) {
      unit.state = UnitState.IDLE;
      return;
    }

    const building = this.state.buildings.get(unit.buildTargetId);
    if (!building || building.isComplete) {
      unit.buildTargetId = null;
      unit.state = UnitState.IDLE;
      return;
    }

    const def = BUILDING_DEFS[building.type];
    const dist = Math.hypot(
      unit.x - (building.tileX + def.size / 2),
      unit.z - (building.tileZ + def.size / 2)
    );

    if (dist > def.size + 1) {
      unit.state = UnitState.MOVING;
      unit.targetX = building.tileX;
      unit.targetZ = building.tileZ;
      unit.path = this.map.findPath(unit.x, unit.z, building.tileX, building.tileZ + def.size);
      unit.pathIndex = 0;
      return;
    }

    building.buildProgress += 100 / (def.buildTime);
    building.hp = Math.min(def.hp, Math.floor((building.buildProgress / 100) * def.hp));

    if (building.buildProgress >= 100) {
      building.buildProgress = 100;
      building.isComplete = true;
      building.hp = def.hp;

      if (def.popProvided > 0) {
        this.state.players[building.owner].maxPopulation += def.popProvided;
      }

      this.emit('building_complete', building);
      this.addNotification(
        `${def.name} construction complete!`,
        'info'
      );

      unit.buildTargetId = null;
      unit.state = UnitState.IDLE;
    }
  }

  private autoAggro(unit: Unit): void {
    const def = UNIT_DEFS[unit.type];
    if (def.canGather && !def.canBuild) return;

    let nearestEnemy: Unit | null = null;
    let nearestDist = AGGRO_RANGE;

    for (const other of this.state.units.values()) {
      if (other.owner === unit.owner || other.state === UnitState.DEAD) continue;
      const dist = Math.hypot(unit.x - other.x, unit.z - other.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = other;
      }
    }

    if (nearestEnemy) {
      unit.state = UnitState.ATTACKING;
      unit.attackTargetId = nearestEnemy.id;
    }
  }

  private updateBuildings(): void {
    for (const building of this.state.buildings.values()) {
      if (!building.isComplete) continue;
      if (building.hp <= 0) continue;

      if (building.productionQueue.length > 0) {
        const unitType = building.productionQueue[0];
        const uDef = UNIT_DEFS[unitType];
        building.productionProgress += 100 / uDef.trainTime;

        if (building.productionProgress >= 100) {
          building.productionProgress = 0;
          building.productionQueue.shift();

          const bDef = BUILDING_DEFS[building.type];
          const spawnX = building.rallyX;
          const spawnZ = building.rallyZ;
          const newUnit = this.createUnit(unitType, building.owner, spawnX, spawnZ);
          if (newUnit) {
            this.emit('unit_trained', { building, unit: newUnit });
          }
        }
      }

      const bDef = BUILDING_DEFS[building.type];
      if (bDef.attackDamage > 0 && building.attackCooldown <= 0) {
        this.towerAttack(building);
      }
      building.attackCooldown = Math.max(0, building.attackCooldown - 1);
    }
  }

  private towerAttack(building: Building): void {
    const bDef = BUILDING_DEFS[building.type];
    const cx = building.tileX + bDef.size / 2;
    const cz = building.tileZ + bDef.size / 2;

    let nearestEnemy: Unit | null = null;
    let nearestDist = bDef.attackRange;

    for (const unit of this.state.units.values()) {
      if (unit.owner === building.owner || unit.state === UnitState.DEAD) continue;
      const dist = Math.hypot(unit.x - cx, unit.z - cz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = unit;
      }
    }

    if (nearestEnemy) {
      nearestEnemy.hp -= bDef.attackDamage;
      building.attackCooldown = 15;
      this.emit('tower_attack', { building, target: nearestEnemy });
    }
  }

  private updateCombat(): void {
    // Handled inline in unit update
  }

  private destroyBuilding(building: Building): void {
    const def = BUILDING_DEFS[building.type];
    for (let dx = 0; dx < def.size; dx++) {
      for (let dz = 0; dz < def.size; dz++) {
        const tile = this.map.tiles[building.tileX + dx][building.tileZ + dz];
        tile.buildingId = null;
        tile.passable = true;
      }
    }

    if (def.popProvided > 0) {
      this.state.players[building.owner].maxPopulation -= def.popProvided;
    }

    this.state.buildings.delete(building.id);
    this.state.selectedIds.delete(building.id);
    this.emit('building_destroyed', building);

    if (building.type === BuildingType.CITADEL) {
      this.addNotification(
        building.owner === 0 ? 'Your Citadel has fallen!' : 'Enemy Citadel destroyed!',
        'combat'
      );
    }
  }

  private findNearestDropoff(unit: Unit): Vec2 | null {
    let best: Vec2 | null = null;
    let bestDist = Infinity;

    for (const building of this.state.buildings.values()) {
      if (building.owner !== unit.owner || !building.isComplete) continue;
      const bDef = BUILDING_DEFS[building.type];
      if (
        building.type === BuildingType.CITADEL ||
        building.type === BuildingType.LUMBER_CAMP ||
        building.type === BuildingType.AETHER_WELL ||
        building.type === BuildingType.QUARRY
      ) {
        const bx = building.tileX + bDef.size / 2;
        const bz = building.tileZ + bDef.size + 0.5;
        const dist = Math.hypot(unit.x - bx, unit.z - bz);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: bx, z: bz };
        }
      }
    }
    return best;
  }

  private checkVictory(): void {
    for (const player of this.state.players) {
      const hasCitadel = [...this.state.buildings.values()].some(
        (b) => b.owner === player.id && b.type === BuildingType.CITADEL && b.hp > 0
      );
      if (!hasCitadel && !player.defeated) {
        player.defeated = true;
        if (player.id === 0) {
          this.state.phase = GamePhase.DEFEAT;
          this.stopTicking();
          this.emit('game_over', 'defeat');
        } else {
          this.state.phase = GamePhase.VICTORY;
          this.stopTicking();
          this.emit('game_over', 'victory');
        }
      }
    }
  }

  addNotification(text: string, type: Notification['type']): void {
    this.state.notifications.push({ text, time: this.state.tick, type });
    this.emit('notification', { text, type });
  }

  private cleanupNotifications(): void {
    this.state.notifications = this.state.notifications.filter(
      (n) => this.state.tick - n.time < TICK_RATE * 8
    );
  }

  getPlayerUnits(playerId: number): Unit[] {
    return [...this.state.units.values()].filter((u) => u.owner === playerId && u.state !== UnitState.DEAD);
  }

  getPlayerBuildings(playerId: number): Building[] {
    return [...this.state.buildings.values()].filter((b) => b.owner === playerId && b.hp > 0);
  }
}
