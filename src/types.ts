export enum Faction {
  SOLARI = 'SOLARI',
  IRONROOT = 'IRONROOT',
}

export enum TerrainType {
  GRASS = 'GRASS',
  FOREST = 'FOREST',
  WATER = 'WATER',
  MOUNTAIN = 'MOUNTAIN',
  SAND = 'SAND',
}

export enum ResourceType {
  AETHER = 'AETHER',
  TIMBER = 'TIMBER',
  STONE = 'STONE',
}

export enum BuildingType {
  CITADEL = 'CITADEL',
  AETHER_WELL = 'AETHER_WELL',
  LUMBER_CAMP = 'LUMBER_CAMP',
  QUARRY = 'QUARRY',
  BARRACKS = 'BARRACKS',
  ARMORY = 'ARMORY',
  TOWER = 'TOWER',
  FARM = 'FARM',
}

export enum UnitType {
  WORKER = 'WORKER',
  SWORDSMAN = 'SWORDSMAN',
  ARCHER = 'ARCHER',
  KNIGHT = 'KNIGHT',
}

export enum UnitState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  ATTACKING = 'ATTACKING',
  GATHERING = 'GATHERING',
  BUILDING = 'BUILDING',
  RETURNING = 'RETURNING',
  DEAD = 'DEAD',
}

export enum Age {
  DAWN = 1,
  RISE = 2,
  ZENITH = 3,
}

export enum GamePhase {
  MENU = 'MENU',
  STORY_INTRO = 'STORY_INTRO',
  PLAYING = 'PLAYING',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT',
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Tile {
  x: number;
  z: number;
  elevation: number;
  terrain: TerrainType;
  passable: boolean;
  hasResource: ResourceType | null;
  resourceAmount: number;
  buildingId: number | null;
  treeVariant: number;
}

export interface Resources {
  [ResourceType.AETHER]: number;
  [ResourceType.TIMBER]: number;
  [ResourceType.STONE]: number;
}

export interface UnitDef {
  type: UnitType;
  name: string;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  attackSpeed: number;
  cost: Partial<Resources>;
  trainTime: number;
  popCost: number;
  minAge: Age;
  canGather: boolean;
  canBuild: boolean;
  sightRange: number;
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  hp: number;
  size: number;
  cost: Partial<Resources>;
  buildTime: number;
  minAge: Age;
  popProvided: number;
  canTrain: UnitType[];
  attackDamage: number;
  attackRange: number;
  requiresTerrain: TerrainType | null;
  requiresResource: ResourceType | null;
}

export interface Unit {
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
  path: Vec2[];
  pathIndex: number;
  carryType: ResourceType | null;
  carryAmount: number;
  gatherTargetX: number;
  gatherTargetZ: number;
  buildTargetId: number | null;
  attackCooldown: number;
  moveProgress: number;
  stateTimer: number;
}

export interface Building {
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
  attackCooldown: number;
}

export interface Player {
  id: number;
  faction: Faction;
  resources: Resources;
  population: number;
  maxPopulation: number;
  age: Age;
  isAI: boolean;
  defeated: boolean;
}

export interface GameState {
  phase: GamePhase;
  tick: number;
  mapWidth: number;
  mapHeight: number;
  tiles: Tile[][];
  players: Player[];
  units: Map<number, Unit>;
  buildings: Map<number, Building>;
  nextEntityId: number;
  selectedIds: Set<number>;
  buildPlacementType: BuildingType | null;
  notifications: Notification[];
}

export interface Notification {
  text: string;
  time: number;
  type: 'info' | 'warning' | 'combat' | 'age';
}
