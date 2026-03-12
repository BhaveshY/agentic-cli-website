import * as THREE from 'three';
import { TerrainType, ResourceType, type Tile } from '../types';
import { MAP_SIZE, TILE_SIZE, TERRAIN_COLORS } from '../config';
import { GameMap } from '../core/GameMap';

export class TerrainRenderer {
  readonly group = new THREE.Group();
  private treeMeshes: THREE.InstancedMesh[] = [];
  private resourceMarkers: THREE.Mesh[] = [];
  private waterMesh!: THREE.Mesh;

  constructor(map: GameMap) {
    this.buildTerrain(map);
    this.buildWater();
    this.buildTrees(map);
    this.buildResources(map);
  }

  private buildTerrain(map: GameMap): void {
    const geo = new THREE.PlaneGeometry(
      MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE,
      MAP_SIZE, MAP_SIZE
    );
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const pz = positions.getZ(i);

      const tileX = Math.floor((px / TILE_SIZE) + MAP_SIZE / 2);
      const tileZ = Math.floor((pz / TILE_SIZE) + MAP_SIZE / 2);

      const clampedX = Math.max(0, Math.min(MAP_SIZE - 1, tileX));
      const clampedZ = Math.max(0, Math.min(MAP_SIZE - 1, tileZ));
      const tile = map.tiles[clampedX][clampedZ];

      const height = tile.terrain === TerrainType.WATER
        ? -0.3
        : tile.elevation * 4;
      positions.setY(i, height);

      const color = new THREE.Color(TERRAIN_COLORS[tile.terrain]);
      const variation = 0.9 + Math.random() * 0.2;
      colors[i * 3] = color.r * variation;
      colors[i * 3 + 1] = color.g * variation;
      colors[i * 3 + 2] = color.b * variation;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.position.set(MAP_SIZE * TILE_SIZE / 2, 0, MAP_SIZE * TILE_SIZE / 2);
    this.group.add(mesh);
  }

  private buildWater(): void {
    const geo = new THREE.PlaneGeometry(MAP_SIZE * TILE_SIZE * 1.5, MAP_SIZE * TILE_SIZE * 1.5);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a7ab5,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.3,
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.position.set(MAP_SIZE * TILE_SIZE / 2, -0.1, MAP_SIZE * TILE_SIZE / 2);
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);
  }

  private buildTrees(map: GameMap): void {
    let forestCount = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        if (map.tiles[x][z].terrain === TerrainType.FOREST) forestCount++;
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, forestCount);
    trunkInstanced.castShadow = true;

    const leafGeo = new THREE.ConeGeometry(0.6, 1.5, 6);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2e, roughness: 0.8, flatShading: true });
    const leafInstanced = new THREE.InstancedMesh(leafGeo, leafMat, forestCount);
    leafInstanced.castShadow = true;
    leafInstanced.receiveShadow = true;

    const tempPos = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    let idx = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if (tile.terrain !== TerrainType.FOREST) continue;

        const wx = x * TILE_SIZE + TILE_SIZE / 2 + (tile.treeVariant - 2) * 0.15;
        const wz = z * TILE_SIZE + TILE_SIZE / 2 + (tile.treeVariant - 1) * 0.15;
        const wy = tile.elevation * 4;

        const s = 0.9 + (tile.treeVariant % 3) * 0.25;

        tempPos.set(wx, wy + 0.6 * s, wz);
        tempScale.set(s, s, s);
        matrix.compose(tempPos, tempQuat, tempScale);
        trunkInstanced.setMatrixAt(idx, matrix);

        tempPos.set(wx, wy + 1.6 * s, wz);
        tempScale.set(s, s * 1.2, s);
        matrix.compose(tempPos, tempQuat, tempScale);
        leafInstanced.setMatrixAt(idx, matrix);

        idx++;
      }
    }

    trunkInstanced.instanceMatrix.needsUpdate = true;
    leafInstanced.instanceMatrix.needsUpdate = true;
    trunkInstanced.computeBoundingSphere();
    leafInstanced.computeBoundingSphere();

    this.group.add(trunkInstanced);
    this.group.add(leafInstanced);
    this.treeMeshes = [trunkInstanced, leafInstanced];
  }

  private buildResources(map: GameMap): void {
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if (!tile.hasResource) continue;

        const wx = x * TILE_SIZE + TILE_SIZE / 2;
        const wz = z * TILE_SIZE + TILE_SIZE / 2;
        const wy = tile.elevation * 4;

        if (tile.hasResource === ResourceType.AETHER) {
          const crystal = this.createAetherCrystal();
          crystal.position.set(wx, wy + 0.5, wz);
          this.group.add(crystal);
          this.resourceMarkers.push(crystal);
        } else if (tile.hasResource === ResourceType.STONE) {
          const rocks = this.createStoneDeposit();
          rocks.position.set(wx, wy, wz);
          this.group.add(rocks);
          this.resourceMarkers.push(rocks);
        }
      }
    }
  }

  private createAetherCrystal(): THREE.Mesh {
    const group = new THREE.Group() as unknown as THREE.Mesh;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7b68ee,
      emissive: 0x5533cc,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });

    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), mat);
    main.position.y = 0.8;
    main.castShadow = true;
    (group as unknown as THREE.Group).add(main);

    for (let i = 0; i < 3; i++) {
      const small = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), mat);
      const angle = (i / 3) * Math.PI * 2;
      small.position.set(Math.cos(angle) * 0.5, 0.3, Math.sin(angle) * 0.5);
      small.castShadow = true;
      (group as unknown as THREE.Group).add(small);
    }

    const glow = new THREE.PointLight(0x7b68ee, 1.0, 6);
    glow.position.y = 0.8;
    (group as unknown as THREE.Group).add(glow);

    return group;
  }

  private createStoneDeposit(): THREE.Mesh {
    const group = new THREE.Group() as unknown as THREE.Mesh;
    for (let i = 0; i < 3; i++) {
      const size = 0.3 + Math.random() * 0.3;
      const geo = new THREE.DodecahedronGeometry(size, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x888880,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
      });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(
        (Math.random() - 0.5) * 0.5,
        size * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      (group as unknown as THREE.Group).add(rock);
    }
    return group;
  }

  update(t: number): void {
    for (const marker of this.resourceMarkers) {
      marker.rotation.y = t * 0.5;
      if (marker.children[0] instanceof THREE.PointLight) {
        (marker.children[0] as THREE.PointLight).intensity = 0.3 + Math.sin(t * 2) * 0.2;
      }
    }

    if (this.waterMesh) {
      (this.waterMesh.material as THREE.MeshStandardMaterial).opacity =
        0.6 + Math.sin(t * 0.5) * 0.1;
    }
  }
}
