import { TerrainType, ResourceType, type Tile, type Vec2 } from '../types';
import { MAP_SIZE } from '../config';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function smoothNoise(grid: number[][], x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const w = grid.length;

  const g = (gx: number, gz: number) => grid[((gx % w) + w) % w][((gz % w) + w) % w];

  const n00 = g(ix, iz);
  const n10 = g(ix + 1, iz);
  const n01 = g(ix, iz + 1);
  const n11 = g(ix + 1, iz + 1);

  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sz * (nx1 - nx0);
}

function generateNoiseGrid(size: number, rand: () => number): number[][] {
  const grid: number[][] = [];
  for (let x = 0; x < size; x++) {
    grid[x] = [];
    for (let z = 0; z < size; z++) {
      grid[x][z] = rand();
    }
  }
  return grid;
}

function fractalNoise(
  grids: number[][][],
  x: number,
  z: number,
  octaves: number[],
  weights: number[]
): number {
  let value = 0;
  let totalWeight = 0;
  for (let i = 0; i < octaves.length; i++) {
    value += smoothNoise(grids[i], x * octaves[i], z * octaves[i]) * weights[i];
    totalWeight += weights[i];
  }
  return value / totalWeight;
}

export class GameMap {
  tiles: Tile[][] = [];
  width: number;
  height: number;

  constructor(seed = 42) {
    this.width = MAP_SIZE;
    this.height = MAP_SIZE;
    this.generate(seed);
  }

  private generate(seed: number): void {
    const rand = seededRandom(seed);
    const noiseGrids = [
      generateNoiseGrid(64, rand),
      generateNoiseGrid(64, rand),
      generateNoiseGrid(64, rand),
    ];

    for (let x = 0; x < this.width; x++) {
      this.tiles[x] = [];
      for (let z = 0; z < this.height; z++) {
        const elevation = fractalNoise(
          noiseGrids, x / this.width, z / this.height,
          [2, 5, 10], [1, 0.5, 0.25]
        );

        const distFromCenter = Math.sqrt(
          Math.pow((x - this.width / 2) / (this.width / 2), 2) +
          Math.pow((z - this.height / 2) / (this.height / 2), 2)
        );
        const islandFalloff = Math.max(0, 1 - distFromCenter * 0.65);
        const finalElevation = elevation * islandFalloff;

        let terrain: TerrainType;
        let passable = true;

        if (finalElevation < 0.1) {
          terrain = TerrainType.WATER;
          passable = false;
        } else if (finalElevation < 0.16) {
          terrain = TerrainType.SAND;
        } else if (finalElevation > 0.75) {
          terrain = TerrainType.MOUNTAIN;
          passable = false;
        } else if (finalElevation > 0.38 && rand() < 0.25) {
          terrain = TerrainType.FOREST;
        } else {
          terrain = TerrainType.GRASS;
        }

        this.tiles[x][z] = {
          x, z,
          elevation: finalElevation,
          terrain,
          passable,
          hasResource: null,
          resourceAmount: 0,
          buildingId: null,
          treeVariant: Math.floor(rand() * 4),
        };
      }
    }

    this.clearStartingAreas();
    this.placeForests();
    this.placeResources(rand);
  }

  private placeForests(): void {
    const forestZones = [
      { cx: 15, cz: 5 }, { cx: 5, cz: 15 },
      { cx: this.width - 16, cz: this.height - 6 },
      { cx: this.width - 6, cz: this.height - 16 },
      { cx: Math.floor(this.width / 2) - 6, cz: Math.floor(this.height / 2) + 2 },
      { cx: Math.floor(this.width / 2) + 6, cz: Math.floor(this.height / 2) - 2 },
    ];
    for (const { cx, cz } of forestZones) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (!this.inBounds(x, z)) continue;
          const tile = this.tiles[x][z];
          if (tile.terrain === TerrainType.GRASS && tile.buildingId === null) {
            tile.terrain = TerrainType.FOREST;
            tile.passable = true;
            tile.elevation = Math.max(0.3, tile.elevation);
          }
        }
      }
    }
  }

  private clearStartingAreas(): void {
    const zones = [
      { cx: 8, cz: 8 },
      { cx: this.width - 9, cz: this.height - 9 },
    ];
    for (const { cx, cz } of zones) {
      for (let dx = -6; dx <= 6; dx++) {
        for (let dz = -6; dz <= 6; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (x >= 0 && x < this.width && z >= 0 && z < this.height) {
            this.tiles[x][z].terrain = TerrainType.GRASS;
            this.tiles[x][z].passable = true;
            this.tiles[x][z].elevation = Math.max(0.3, this.tiles[x][z].elevation);
          }
        }
      }
    }
  }

  private placeResources(rand: () => number): void {
    const aetherPositions = [
      { x: 8, z: 8 }, { x: 12, z: 3 }, { x: 3, z: 12 },
      { x: this.width - 9, z: this.height - 9 },
      { x: this.width - 13, z: this.height - 4 },
      { x: this.width - 4, z: this.height - 13 },
      { x: Math.floor(this.width / 2), z: Math.floor(this.height / 2) },
      { x: Math.floor(this.width / 2) - 5, z: Math.floor(this.height / 2) + 5 },
      { x: Math.floor(this.width / 2) + 5, z: Math.floor(this.height / 2) - 5 },
    ];

    for (const pos of aetherPositions) {
      if (this.inBounds(pos.x, pos.z) && this.tiles[pos.x][pos.z].passable) {
        this.tiles[pos.x][pos.z].hasResource = ResourceType.AETHER;
        this.tiles[pos.x][pos.z].resourceAmount = 800;
        this.tiles[pos.x][pos.z].terrain = TerrainType.GRASS;
      }
    }

    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.height; z++) {
        const tile = this.tiles[x][z];
        if (tile.terrain === TerrainType.MOUNTAIN && rand() < 0.15) {
          const neighbors = this.getNeighbors(x, z);
          const hasGrass = neighbors.some(
            (n) => this.tiles[n.x][n.z].terrain === TerrainType.GRASS
          );
          if (hasGrass) {
            const grassN = neighbors.find(
              (n) => this.tiles[n.x][n.z].terrain === TerrainType.GRASS
            )!;
            this.tiles[grassN.x][grassN.z].hasResource = ResourceType.STONE;
            this.tiles[grassN.x][grassN.z].resourceAmount = 600;
          }
        }
      }
    }
  }

  inBounds(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.height;
  }

  getTile(x: number, z: number): Tile | null {
    if (!this.inBounds(x, z)) return null;
    return this.tiles[x][z];
  }

  isPassable(x: number, z: number): boolean {
    if (!this.inBounds(x, z)) return false;
    return this.tiles[x][z].passable;
  }

  getNeighbors(x: number, z: number): Vec2[] {
    const dirs = [
      { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 },
      { x: -1, z: -1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: 1, z: 1 },
    ];
    return dirs
      .map((d) => ({ x: x + d.x, z: z + d.z }))
      .filter((p) => this.inBounds(p.x, p.z));
  }

  findPath(startX: number, startZ: number, endX: number, endZ: number): Vec2[] {
    const sx = Math.round(startX);
    const sz = Math.round(startZ);
    const ex = Math.round(endX);
    const ez = Math.round(endZ);

    if (!this.inBounds(ex, ez) || !this.isPassable(ex, ez)) {
      const nearest = this.findNearestPassable(ex, ez);
      if (!nearest) return [];
      return this.findPath(startX, startZ, nearest.x, nearest.z);
    }

    const openSet = new Map<string, { x: number; z: number; g: number; f: number }>();
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, string>();

    const key = (x: number, z: number) => `${x},${z}`;
    const heuristic = (ax: number, az: number, bx: number, bz: number) =>
      Math.abs(ax - bx) + Math.abs(az - bz);

    const startKey = key(sx, sz);
    openSet.set(startKey, { x: sx, z: sz, g: 0, f: heuristic(sx, sz, ex, ez) });

    let iterations = 0;
    const maxIterations = 2000;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      let currentKey = '';
      let currentF = Infinity;
      for (const [k, node] of openSet) {
        if (node.f < currentF) {
          currentF = node.f;
          currentKey = k;
        }
      }

      const current = openSet.get(currentKey)!;
      if (current.x === ex && current.z === ez) {
        const path: Vec2[] = [];
        let ck: string | undefined = currentKey;
        while (ck) {
          const [px, pz] = ck.split(',').map(Number);
          path.unshift({ x: px, z: pz });
          ck = cameFrom.get(ck);
        }
        return path;
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      for (const neighbor of this.getNeighbors(current.x, current.z)) {
        const nk = key(neighbor.x, neighbor.z);
        if (closedSet.has(nk)) continue;
        if (!this.isPassable(neighbor.x, neighbor.z) && !(neighbor.x === ex && neighbor.z === ez))
          continue;

        const isDiagonal =
          neighbor.x !== current.x && neighbor.z !== current.z;
        const moveCost = isDiagonal ? 1.414 : 1;
        const tentativeG = current.g + moveCost;

        const existing = openSet.get(nk);
        if (existing && tentativeG >= existing.g) continue;

        cameFrom.set(nk, currentKey);
        openSet.set(nk, {
          x: neighbor.x,
          z: neighbor.z,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor.x, neighbor.z, ex, ez),
        });
      }
    }

    return [];
  }

  findNearestPassable(x: number, z: number): Vec2 | null {
    for (let r = 1; r < 10; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = x + dx;
          const nz = z + dz;
          if (this.inBounds(nx, nz) && this.isPassable(nx, nz)) {
            return { x: nx, z: nz };
          }
        }
      }
    }
    return null;
  }

  findNearestResource(x: number, z: number, type: ResourceType, maxRange = 15): Vec2 | null {
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      for (let dz = -maxRange; dz <= maxRange; dz++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.inBounds(nx, nz)) continue;
        const tile = this.tiles[nx][nz];
        if (tile.hasResource === type && tile.resourceAmount > 0) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if (dist < bestDist) {
            bestDist = dist;
            best = { x: nx, z: nz };
          }
        }
      }
    }
    return best;
  }

  findNearestForest(x: number, z: number, maxRange = 15): Vec2 | null {
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      for (let dz = -maxRange; dz <= maxRange; dz++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.inBounds(nx, nz)) continue;
        if (this.tiles[nx][nz].terrain === TerrainType.FOREST) {
          const dist = Math.abs(dx) + Math.abs(dz);
          if (dist < bestDist) {
            bestDist = dist;
            best = { x: nx, z: nz };
          }
        }
      }
    }
    return best;
  }

  canPlaceBuilding(tileX: number, tileZ: number, size: number): boolean {
    for (let dx = 0; dx < size; dx++) {
      for (let dz = 0; dz < size; dz++) {
        const x = tileX + dx;
        const z = tileZ + dz;
        if (!this.inBounds(x, z)) return false;
        const tile = this.tiles[x][z];
        if (!tile.passable || tile.buildingId !== null) return false;
        if (tile.terrain === TerrainType.WATER || tile.terrain === TerrainType.MOUNTAIN || tile.terrain === TerrainType.FOREST)
          return false;
      }
    }
    return true;
  }
}
