import {
  Age, BuildingType, Faction, ResourceType, TerrainType, UnitType,
  type BuildingDef, type UnitDef,
} from './types';

export const MAP_SIZE = 40;
export const TILE_SIZE = 2;
export const TICK_RATE = 15;
export const TICKS_PER_SECOND = TICK_RATE;

export const STARTING_RESOURCES = {
  [ResourceType.AETHER]: 300,
  [ResourceType.TIMBER]: 300,
  [ResourceType.STONE]: 100,
};

export const WORKER_CARRY_CAPACITY = 15;
export const WORKER_GATHER_RATE = 2;
export const AGGRO_RANGE = 7;
export const UNIT_COLLISION_RADIUS = 0.4;

export const AGE_COSTS: Record<Age, Partial<Record<ResourceType, number>>> = {
  [Age.DAWN]: {},
  [Age.RISE]: { [ResourceType.AETHER]: 300, [ResourceType.TIMBER]: 200 },
  [Age.ZENITH]: { [ResourceType.AETHER]: 600, [ResourceType.TIMBER]: 400, [ResourceType.STONE]: 200 },
};

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  [UnitType.WORKER]: {
    type: UnitType.WORKER,
    name: 'Worker',
    hp: 30,
    damage: 3,
    range: 1.5,
    speed: 3.5,
    attackSpeed: 15,
    cost: { [ResourceType.AETHER]: 50 },
    trainTime: 15,
    popCost: 1,
    minAge: Age.DAWN,
    canGather: true,
    canBuild: true,
    sightRange: 8,
  },
  [UnitType.SWORDSMAN]: {
    type: UnitType.SWORDSMAN,
    name: 'Swordsman',
    hp: 60,
    damage: 8,
    range: 1.8,
    speed: 3.5,
    attackSpeed: 10,
    cost: { [ResourceType.AETHER]: 60, [ResourceType.TIMBER]: 20 },
    trainTime: 12,
    popCost: 1,
    minAge: Age.DAWN,
    canGather: false,
    canBuild: false,
    sightRange: 7,
  },
  [UnitType.ARCHER]: {
    type: UnitType.ARCHER,
    name: 'Archer',
    hp: 35,
    damage: 7,
    range: 7,
    speed: 3.2,
    attackSpeed: 12,
    cost: { [ResourceType.AETHER]: 40, [ResourceType.TIMBER]: 40 },
    trainTime: 14,
    popCost: 1,
    minAge: Age.RISE,
    canGather: false,
    canBuild: false,
    sightRange: 9,
  },
  [UnitType.KNIGHT]: {
    type: UnitType.KNIGHT,
    name: 'Knight',
    hp: 120,
    damage: 14,
    range: 1.8,
    speed: 4.0,
    attackSpeed: 10,
    cost: { [ResourceType.AETHER]: 100, [ResourceType.STONE]: 50 },
    trainTime: 20,
    popCost: 2,
    minAge: Age.ZENITH,
    canGather: false,
    canBuild: false,
    sightRange: 7,
  },
};

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  [BuildingType.CITADEL]: {
    type: BuildingType.CITADEL,
    name: 'Citadel',
    hp: 500,
    size: 3,
    cost: {},
    buildTime: 1,
    minAge: Age.DAWN,
    popProvided: 5,
    canTrain: [UnitType.WORKER],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: null,
  },
  [BuildingType.AETHER_WELL]: {
    type: BuildingType.AETHER_WELL,
    name: 'Aether Well',
    hp: 150,
    size: 2,
    cost: { [ResourceType.TIMBER]: 75 },
    buildTime: 40,
    minAge: Age.DAWN,
    popProvided: 0,
    canTrain: [],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: ResourceType.AETHER,
  },
  [BuildingType.LUMBER_CAMP]: {
    type: BuildingType.LUMBER_CAMP,
    name: 'Lumber Camp',
    hp: 150,
    size: 2,
    cost: { [ResourceType.AETHER]: 50 },
    buildTime: 35,
    minAge: Age.DAWN,
    popProvided: 0,
    canTrain: [],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: null,
  },
  [BuildingType.QUARRY]: {
    type: BuildingType.QUARRY,
    name: 'Quarry',
    hp: 200,
    size: 2,
    cost: { [ResourceType.AETHER]: 75, [ResourceType.TIMBER]: 50 },
    buildTime: 50,
    minAge: Age.DAWN,
    popProvided: 0,
    canTrain: [],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: ResourceType.STONE,
  },
  [BuildingType.BARRACKS]: {
    type: BuildingType.BARRACKS,
    name: 'Barracks',
    hp: 250,
    size: 2,
    cost: { [ResourceType.AETHER]: 100, [ResourceType.TIMBER]: 80 },
    buildTime: 50,
    minAge: Age.DAWN,
    popProvided: 0,
    canTrain: [UnitType.SWORDSMAN, UnitType.ARCHER],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: null,
  },
  [BuildingType.ARMORY]: {
    type: BuildingType.ARMORY,
    name: 'Armory',
    hp: 300,
    size: 2,
    cost: { [ResourceType.AETHER]: 200, [ResourceType.TIMBER]: 100, [ResourceType.STONE]: 100 },
    buildTime: 70,
    minAge: Age.RISE,
    popProvided: 0,
    canTrain: [UnitType.KNIGHT],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: null,
  },
  [BuildingType.TOWER]: {
    type: BuildingType.TOWER,
    name: 'Watch Tower',
    hp: 200,
    size: 1,
    cost: { [ResourceType.TIMBER]: 50, [ResourceType.STONE]: 30 },
    buildTime: 40,
    minAge: Age.DAWN,
    popProvided: 0,
    canTrain: [],
    attackDamage: 10,
    attackRange: 7,
    requiresTerrain: null,
    requiresResource: null,
  },
  [BuildingType.FARM]: {
    type: BuildingType.FARM,
    name: 'Farm',
    hp: 100,
    size: 2,
    cost: { [ResourceType.TIMBER]: 60 },
    buildTime: 30,
    minAge: Age.DAWN,
    popProvided: 5,
    canTrain: [],
    attackDamage: 0,
    attackRange: 0,
    requiresTerrain: null,
    requiresResource: null,
  },
};

export const FACTION_COLORS: Record<Faction, { primary: number; secondary: number; accent: number }> = {
  [Faction.SOLARI]: { primary: 0xf0a030, secondary: 0xd4841e, accent: 0xffd700 },
  [Faction.IRONROOT]: { primary: 0x2d8a4e, secondary: 0x1a5c33, accent: 0x7ec850 },
};

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.GRASS]: 0x5a8a3c,
  [TerrainType.FOREST]: 0x3d6b2e,
  [TerrainType.WATER]: 0x2a6496,
  [TerrainType.MOUNTAIN]: 0x8a8a7a,
  [TerrainType.SAND]: 0xc8b87a,
};

export const LORE = {
  worldName: 'Aetheria',
  intro: `In the shattered realm of Aetheria, floating islands drift through an endless sky, bound together by veins of raw magical energy called Aether. Two great civilizations have risen from the ancient ruins — the Solari Dominion, children of the sun who forge crystal towers and golden citadels, and the Ironroot Collective, guardians of the living forests who grow their cities from ancient sentient trees.\n\nFor centuries, an uneasy peace held. But the Aether is fading, and both factions now race to claim the remaining wells of power. War is inevitable. The only question is: who will shape the future of Aetheria?`,
  factions: {
    [Faction.SOLARI]: {
      name: 'The Solari Dominion',
      motto: 'In Light, We Conquer',
      description: 'An empire of radiant crystal and golden steel. The Solari believe in order, progress, and the divine right of illumination. Their cities gleam with reflected sunlight, and their warriors carry the fire of stars into battle.',
      leader: 'Empress Aurelia the Radiant',
      leaderQuote: '"The darkness fears us for good reason."',
    },
    [Faction.IRONROOT]: {
      name: 'The Ironroot Collective',
      motto: 'From Root to Crown, We Endure',
      description: 'A civilization grown from the living heart of the ancient forests. The Ironroot shape trees into towers, weave roots into walls, and commune with the deep magic of the earth. Patient and resilient, they fight not for conquest but for the balance of all living things.',
      leader: 'Elder Thorn of the Deep Grove',
      leaderQuote: '"The forest remembers what empires forget."',
    },
  },
  ageDescriptions: {
    [Age.DAWN]: 'The Age of Dawn — Your settlement takes its first breath. Gather resources, train workers, and lay the foundations of your empire.',
    [Age.RISE]: 'The Age of Rise — Your civilization grows. Train archers, build towers, and prepare for the conflicts ahead.',
    [Age.ZENITH]: 'The Age of Zenith — Your empire reaches its peak. Unleash knights, siege engines, and the full might of your faction.',
  },
};

export const AI_TAUNTS = {
  gameStart: [
    "Your little settlement is adorable. Enjoy it while it lasts.",
    "I've already planned three attacks while you were reading this.",
    "May the best civilization win. Spoiler: it's mine.",
  ],
  firstAttack: [
    "Surprise! Hope you built some towers. Oh wait...",
    "My army says hello. Your workers say goodbye.",
    "Consider this a... aggressive negotiation.",
  ],
  underAttack: [
    "Ouch! Okay, that one actually hurt.",
    "Bold move. My reinforcements disagree, though.",
    "You dare strike at MY empire?!",
  ],
  ageUp: [
    "I've advanced. You should be worried.",
    "New age, new toys. This is going to be fun.",
  ],
  winning: [
    "Your empire crumbles. Poetic, isn't it?",
    "I'd offer surrender terms, but where's the fun in that?",
  ],
  losing: [
    "This is... a temporary setback.",
    "I'm not retreating. I'm advancing in a different direction.",
    "Okay, you're better than I expected. Don't let it go to your head.",
  ],
  defeated: [
    "Well played. My empire falls, but at least I had great architecture.",
  ],
  victory: [
    "Another kingdom falls. The history books will remember my name.",
  ],
};
