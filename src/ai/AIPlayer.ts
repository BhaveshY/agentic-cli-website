import {
  Age, BuildingType, ResourceType, UnitState, UnitType,
  type Building, type Unit,
} from '../types';
import {
  BUILDING_DEFS, MAP_SIZE, TICK_RATE, UNIT_DEFS, AI_TAUNTS,
} from '../config';
import { GameWorld } from '../core/GameState';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class AIPlayer {
  private world: GameWorld;
  private playerId: number;
  private lastAttackTick = 0;
  private attackWaveSize = 3;
  private hasTaunted = false;
  private lastTauntTick = 0;

  constructor(world: GameWorld, playerId: number) {
    this.world = world;
    this.playerId = playerId;
  }

  update(): void {
    const tick = this.world.state.tick;
    if (tick % TICK_RATE !== 0) return;

    const player = this.world.state.players[this.playerId];
    if (player.defeated) return;

    const units = this.world.getPlayerUnits(this.playerId);
    const buildings = this.world.getPlayerBuildings(this.playerId);
    const workers = units.filter((u) => u.type === UnitType.WORKER);
    const military = units.filter((u) => u.type !== UnitType.WORKER);

    this.manageWorkers(workers, buildings);
    this.manageBuildings(buildings, workers, player.age);
    this.manageProduction(buildings, workers, military, player);
    this.manageArmy(military);
    this.manageAgeUp(player, buildings);
    this.manageTaunts(tick, military, buildings);
  }

  private manageWorkers(workers: Unit[], buildings: Building[]): void {
    const idleWorkers = workers.filter((w) => w.state === UnitState.IDLE);

    for (const worker of idleWorkers) {
      const aetherNode = this.world.map.findNearestResource(
        Math.round(worker.x), Math.round(worker.z), ResourceType.AETHER
      );
      if (aetherNode && Math.random() < 0.5) {
        this.world.commandGather([worker.id], aetherNode.x, aetherNode.z);
        continue;
      }

      const forest = this.world.map.findNearestForest(
        Math.round(worker.x), Math.round(worker.z)
      );
      if (forest) {
        this.world.commandGather([worker.id], forest.x, forest.z);
      }
    }
  }

  private manageBuildings(buildings: Building[], workers: Unit[], age: Age): void {
    const player = this.world.state.players[this.playerId];
    const hasCitadel = buildings.some((b) => b.type === BuildingType.CITADEL);
    if (!hasCitadel) return;

    const citadel = buildings.find((b) => b.type === BuildingType.CITADEL)!;
    const hasBarracks = buildings.some((b) => b.type === BuildingType.BARRACKS && b.isComplete);
    const hasFarm = buildings.some((b) => b.type === BuildingType.FARM && b.isComplete);
    const hasArmory = buildings.some((b) => b.type === BuildingType.ARMORY && b.isComplete);
    const farmCount = buildings.filter((b) => b.type === BuildingType.FARM).length;
    const towerCount = buildings.filter((b) => b.type === BuildingType.TOWER).length;

    const builderWorker = workers.find((w) =>
      w.state === UnitState.IDLE || w.state === UnitState.GATHERING
    );
    if (!builderWorker) return;

    if (!hasBarracks && player.resources[ResourceType.AETHER] >= 100 && player.resources[ResourceType.TIMBER] >= 80) {
      const pos = this.findBuildSpot(citadel.tileX, citadel.tileZ, 2);
      if (pos) this.world.commandBuild(builderWorker.id, BuildingType.BARRACKS, pos.x, pos.z);
      return;
    }

    if (!hasFarm && player.resources[ResourceType.TIMBER] >= 60) {
      const pos = this.findBuildSpot(citadel.tileX, citadel.tileZ, 2);
      if (pos) this.world.commandBuild(builderWorker.id, BuildingType.FARM, pos.x, pos.z);
      return;
    }

    if (farmCount < 2 && player.population >= player.maxPopulation - 2 && player.resources[ResourceType.TIMBER] >= 60) {
      const pos = this.findBuildSpot(citadel.tileX, citadel.tileZ, 2);
      if (pos) this.world.commandBuild(builderWorker.id, BuildingType.FARM, pos.x, pos.z);
      return;
    }

    if (towerCount < 2 && player.resources[ResourceType.TIMBER] >= 50 && player.resources[ResourceType.STONE] >= 30) {
      const pos = this.findBuildSpot(citadel.tileX, citadel.tileZ, 2);
      if (pos) this.world.commandBuild(builderWorker.id, BuildingType.TOWER, pos.x, pos.z);
      return;
    }

    if (!hasArmory && age >= Age.RISE && player.resources[ResourceType.AETHER] >= 200) {
      const pos = this.findBuildSpot(citadel.tileX, citadel.tileZ, 2);
      if (pos) this.world.commandBuild(builderWorker.id, BuildingType.ARMORY, pos.x, pos.z);
    }
  }

  private manageProduction(buildings: Building[], workers: Unit[], military: Unit[], player: typeof this.world.state.players[0]): void {
    if (workers.length < 5 && player.resources[ResourceType.AETHER] >= 50) {
      const citadel = buildings.find((b) => b.type === BuildingType.CITADEL && b.isComplete);
      if (citadel && citadel.productionQueue.length === 0) {
        this.world.trainUnit(citadel.id, UnitType.WORKER);
      }
    }

    const barracks = buildings.filter((b) => b.type === BuildingType.BARRACKS && b.isComplete);
    for (const b of barracks) {
      if (b.productionQueue.length > 0) continue;
      if (military.length < this.attackWaveSize + 3) {
        if (player.age >= Age.RISE && Math.random() < 0.4 && player.resources[ResourceType.TIMBER] >= 40) {
          this.world.trainUnit(b.id, UnitType.ARCHER);
        } else if (player.resources[ResourceType.AETHER] >= 60) {
          this.world.trainUnit(b.id, UnitType.SWORDSMAN);
        }
      }
    }

    if (player.age >= Age.ZENITH) {
      const armory = buildings.find((b) => b.type === BuildingType.ARMORY && b.isComplete);
      if (armory && armory.productionQueue.length === 0 && player.resources[ResourceType.AETHER] >= 100) {
        this.world.trainUnit(armory.id, UnitType.KNIGHT);
      }
    }
  }

  private manageArmy(military: Unit[]): void {
    const tick = this.world.state.tick;
    const idleMilitary = military.filter((u) => u.state === UnitState.IDLE);

    if (idleMilitary.length >= this.attackWaveSize && tick - this.lastAttackTick > TICK_RATE * 20) {
      this.lastAttackTick = tick;
      this.attackWaveSize = Math.min(15, this.attackWaveSize + 2);

      const enemyBuildings = this.world.getPlayerBuildings(0);
      const enemyUnits = this.world.getPlayerUnits(0);

      let target: { x: number; z: number } | null = null;
      if (enemyBuildings.length > 0) {
        const b = enemyBuildings[0];
        const def = BUILDING_DEFS[b.type];
        target = { x: b.tileX + def.size / 2, z: b.tileZ + def.size / 2 };
      } else if (enemyUnits.length > 0) {
        target = { x: enemyUnits[0].x, z: enemyUnits[0].z };
      }

      if (target) {
        const ids = idleMilitary.map((u) => u.id);
        this.world.commandMove(ids, target.x, target.z);

        if (!this.hasTaunted) {
          this.hasTaunted = true;
          this.world.addNotification(pickRandom(AI_TAUNTS.firstAttack), 'combat');
        }
      }
    }

    for (const unit of military) {
      if (unit.state === UnitState.IDLE) {
        let nearestEnemy: Unit | null = null;
        let nearestDist = 8;
        for (const other of this.world.state.units.values()) {
          if (other.owner === this.playerId || other.state === UnitState.DEAD) continue;
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
    }
  }

  private manageAgeUp(player: typeof this.world.state.players[0], buildings: Building[]): void {
    if (player.age < Age.ZENITH && this.world.state.tick > TICK_RATE * 60 * (player.age)) {
      this.world.advanceAge(this.playerId);
    }
  }

  private manageTaunts(tick: number, military: Unit[], buildings: Building[]): void {
    if (tick - this.lastTauntTick < TICK_RATE * 45) return;

    const playerUnits = this.world.getPlayerUnits(0);
    const myHp = military.reduce((sum, u) => sum + u.hp, 0);
    const enemyHp = playerUnits.reduce((sum, u) => sum + u.hp, 0);

    if (myHp > enemyHp * 1.5 && military.length > 5) {
      this.world.addNotification(pickRandom(AI_TAUNTS.winning), 'combat');
      this.lastTauntTick = tick;
    } else if (enemyHp > myHp * 1.5) {
      this.world.addNotification(pickRandom(AI_TAUNTS.losing), 'combat');
      this.lastTauntTick = tick;
    }
  }

  private findBuildSpot(nearX: number, nearZ: number, size: number): { x: number; z: number } | null {
    for (let r = 3; r < 12; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const x = nearX + dx;
          const z = nearZ + dz;
          if (this.world.map.canPlaceBuilding(x, z, size)) {
            return { x, z };
          }
        }
      }
    }
    return null;
  }
}
