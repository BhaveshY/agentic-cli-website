import * as THREE from 'three';
import { TerrainType, ResourceType } from '../types';
import { MAP_SIZE, TILE_SIZE, TERRAIN_COLORS } from '../config';
import { GameMap } from '../core/GameMap';

export class TerrainRenderer {
  readonly group = new THREE.Group();
  private treeMeshes: THREE.InstancedMesh[] = [];
  private resourceMarkers: THREE.Group[] = [];
  private waterMesh!: THREE.Mesh;
  private grassPatches: THREE.InstancedMesh | null = null;

  private dustParticles!: THREE.Points;

  constructor(map: GameMap) {
    this.buildTerrain(map);
    this.buildWater();
    this.buildShoreFoam(map);
    this.buildTrees(map);
    this.buildScatteredRocks(map);
    this.buildGrassDetails(map);
    this.buildResources(map);
    this.buildDustParticles();
  }

  private buildTerrain(map: GameMap): void {
    const res = MAP_SIZE * 3;
    const geo = new THREE.PlaneGeometry(MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE, res, res);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const tempColor = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const pz = positions.getZ(i);

      const tileXf = (px / TILE_SIZE) + MAP_SIZE / 2;
      const tileZf = (pz / TILE_SIZE) + MAP_SIZE / 2;
      const tileX = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(tileXf)));
      const tileZ = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(tileZf)));

      const tile = map.tiles[tileX][tileZ];
      let height: number;

      if (tile.terrain === TerrainType.WATER) {
        height = -0.2;
      } else {
        height = tile.elevation * 5.5;
        if (tile.terrain === TerrainType.MOUNTAIN) height = tile.elevation * 7;
      }
      positions.setY(i, height);

      const baseColor = new THREE.Color(TERRAIN_COLORS[tile.terrain]);

      const heightFactor = Math.min(1, tile.elevation * 1.5);
      if (tile.terrain === TerrainType.GRASS) {
        const variation = 0.92 + Math.sin(tileXf * 3.7 + tileZf * 2.3) * 0.08;
        tempColor.set(baseColor).multiplyScalar(variation);
        tempColor.lerp(new THREE.Color(0x8bc34a), heightFactor * 0.15);
      } else if (tile.terrain === TerrainType.FOREST) {
        const variation = 0.88 + Math.sin(tileXf * 5.1 + tileZf * 4.3) * 0.12;
        tempColor.set(baseColor).multiplyScalar(variation);
      } else if (tile.terrain === TerrainType.MOUNTAIN) {
        tempColor.set(baseColor);
        if (tile.elevation > 0.65) {
          tempColor.lerp(new THREE.Color(0xeeeeee), (tile.elevation - 0.65) * 2.5);
        }
      } else if (tile.terrain === TerrainType.SAND) {
        const variation = 0.95 + Math.sin(tileXf * 7 + tileZf * 5) * 0.05;
        tempColor.set(baseColor).multiplyScalar(variation);
      } else {
        tempColor.set(baseColor);
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.position.set(MAP_SIZE * TILE_SIZE / 2, 0, MAP_SIZE * TILE_SIZE / 2);
    this.group.add(mesh);
  }

  private buildWater(): void {
    const size = MAP_SIZE * TILE_SIZE * 1.8;
    const geo = new THREE.PlaneGeometry(size, size, 40, 40);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1a6fa0,
      transparent: true,
      opacity: 0.78,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.position.set(MAP_SIZE * TILE_SIZE / 2, -0.05, MAP_SIZE * TILE_SIZE / 2);
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);
  }

  private buildShoreFoam(map: GameMap): void {
    const foamPositions: number[] = [];
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      for (let z = 1; z < MAP_SIZE - 1; z++) {
        const tile = map.tiles[x][z];
        if (tile.terrain === TerrainType.WATER) continue;
        const neighbors = [
          map.tiles[x - 1]?.[z], map.tiles[x + 1]?.[z],
          map.tiles[x]?.[z - 1], map.tiles[x]?.[z + 1],
        ];
        const nearWater = neighbors.some((n) => n && n.terrain === TerrainType.WATER);
        if (nearWater) {
          const wx = x * TILE_SIZE + TILE_SIZE / 2;
          const wz = z * TILE_SIZE + TILE_SIZE / 2;
          foamPositions.push(wx, 0.08, wz);
        }
      }
    }
    if (foamPositions.length === 0) return;

    const count = foamPositions.length / 3;
    const foamGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < count; i++) {
      const foam = new THREE.Mesh(foamGeo, foamMat);
      foam.position.set(foamPositions[i * 3], foamPositions[i * 3 + 1], foamPositions[i * 3 + 2]);
      this.group.add(foam);
    }
  }

  private buildTrees(map: GameMap): void {
    let forestCount = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        if (map.tiles[x][z].terrain === TerrainType.FOREST) forestCount++;
      }
    }
    if (forestCount === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.8, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, forestCount);
    trunkInst.castShadow = true;

    const leafLowerGeo = new THREE.ConeGeometry(0.8, 1.2, 7);
    const leafLowerMat = new THREE.MeshStandardMaterial({ color: 0x2e8b38, roughness: 0.75, flatShading: true });
    const leafLowerInst = new THREE.InstancedMesh(leafLowerGeo, leafLowerMat, forestCount);
    leafLowerInst.castShadow = true;
    leafLowerInst.receiveShadow = true;

    const leafUpperGeo = new THREE.ConeGeometry(0.55, 1.0, 7);
    const leafUpperMat = new THREE.MeshStandardMaterial({ color: 0x3ca848, roughness: 0.7, flatShading: true });
    const leafUpperInst = new THREE.InstancedMesh(leafUpperGeo, leafUpperMat, forestCount);
    leafUpperInst.castShadow = true;

    const leafTopGeo = new THREE.ConeGeometry(0.32, 0.7, 6);
    const leafTopMat = new THREE.MeshStandardMaterial({ color: 0x4bc058, roughness: 0.65, flatShading: true });
    const leafTopInst = new THREE.InstancedMesh(leafTopGeo, leafTopMat, forestCount);
    leafTopInst.castShadow = true;

    const tempPos = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    const mat = new THREE.Matrix4();
    let idx = 0;

    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if (tile.terrain !== TerrainType.FOREST) continue;

        const offsetX = (tile.treeVariant - 2) * 0.18;
        const offsetZ = ((tile.treeVariant * 7) % 5 - 2) * 0.15;
        const wx = x * TILE_SIZE + TILE_SIZE / 2 + offsetX;
        const wz = z * TILE_SIZE + TILE_SIZE / 2 + offsetZ;
        const wy = tile.elevation * 5.5;
        const s = 0.85 + (tile.treeVariant % 4) * 0.15;

        tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tile.treeVariant * 1.3);

        tempPos.set(wx, wy + 0.9 * s, wz);
        tempScale.set(s, s, s);
        mat.compose(tempPos, tempQuat, tempScale);
        trunkInst.setMatrixAt(idx, mat);

        tempPos.set(wx, wy + 1.8 * s, wz);
        tempScale.set(s, s * 1.1, s);
        mat.compose(tempPos, tempQuat, tempScale);
        leafLowerInst.setMatrixAt(idx, mat);

        tempPos.set(wx, wy + 2.6 * s, wz);
        tempScale.set(s * 0.85, s * 1.0, s * 0.85);
        mat.compose(tempPos, tempQuat, tempScale);
        leafUpperInst.setMatrixAt(idx, mat);

        tempPos.set(wx, wy + 3.3 * s, wz);
        tempScale.set(s * 0.7, s * 0.9, s * 0.7);
        mat.compose(tempPos, tempQuat, tempScale);
        leafTopInst.setMatrixAt(idx, mat);

        idx++;
      }
    }

    for (const inst of [trunkInst, leafLowerInst, leafUpperInst, leafTopInst]) {
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.group.add(inst);
    }
    this.treeMeshes = [trunkInst, leafLowerInst, leafUpperInst, leafTopInst];
  }

  private buildGrassDetails(map: GameMap): void {
    let grassCount = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        if (map.tiles[x][z].terrain === TerrainType.GRASS && Math.random() < 0.12) grassCount++;
      }
    }
    if (grassCount === 0) return;

    const bladeGeo = new THREE.ConeGeometry(0.04, 0.25, 3);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x7ec850,
      roughness: 0.8,
      flatShading: true,
    });
    const grassInst = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    grassInst.receiveShadow = true;

    const tempPos = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    const mat4 = new THREE.Matrix4();
    let idx = 0;

    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if (tile.terrain !== TerrainType.GRASS || Math.random() >= 0.12) continue;

        const wx = x * TILE_SIZE + Math.random() * TILE_SIZE;
        const wz = z * TILE_SIZE + Math.random() * TILE_SIZE;
        const wy = tile.elevation * 5.5;
        const s = 0.6 + Math.random() * 0.8;

        tempPos.set(wx, wy + 0.1, wz);
        tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        tempScale.set(s, s, s);
        mat4.compose(tempPos, tempQuat, tempScale);
        grassInst.setMatrixAt(idx, mat4);
        idx++;
        if (idx >= grassCount) break;
      }
      if (idx >= grassCount) break;
    }

    grassInst.instanceMatrix.needsUpdate = true;
    grassInst.computeBoundingSphere();
    this.group.add(grassInst);
    this.grassPatches = grassInst;
  }

  private buildResources(map: GameMap): void {
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if (!tile.hasResource) continue;

        const wx = x * TILE_SIZE + TILE_SIZE / 2;
        const wz = z * TILE_SIZE + TILE_SIZE / 2;
        const wy = tile.elevation * 5.5;

        if (tile.hasResource === ResourceType.AETHER) {
          const crystal = this.createAetherCrystal();
          crystal.position.set(wx, wy, wz);
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

  private createAetherCrystal(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x8878ee,
      emissive: 0x6644dd,
      emissiveIntensity: 0.7,
      roughness: 0.05,
      metalness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.88,
    });

    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
    main.position.y = 1.0;
    main.castShadow = true;
    g.add(main);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.3;
      const small = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
      small.position.set(Math.cos(angle) * 0.55, 0.35 + Math.random() * 0.3, Math.sin(angle) * 0.55);
      small.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(small);
    }

    const glow = new THREE.PointLight(0x8878ee, 1.2, 8);
    glow.position.y = 1.0;
    g.add(glow);

    return g;
  }

  private createStoneDeposit(): THREE.Group {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a7e,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });

    for (let i = 0; i < 4; i++) {
      const size = 0.25 + Math.random() * 0.35;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stoneMat);
      rock.position.set(
        (Math.random() - 0.5) * 0.7,
        size * 0.4,
        (Math.random() - 0.5) * 0.7
      );
      rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      rock.castShadow = true;
      g.add(rock);
    }

    const sparkle = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ color: 0xccccbb, emissive: 0xaaaaaa, emissiveIntensity: 0.3, metalness: 0.8 })
    );
    sparkle.position.set(0, 0.5, 0);
    g.add(sparkle);

    return g;
  }

  private buildScatteredRocks(map: GameMap): void {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a70, roughness: 0.92, flatShading: true });
    let count = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if ((tile.terrain === TerrainType.GRASS || tile.terrain === TerrainType.SAND) && Math.random() < 0.03) count++;
      }
    }
    if (count === 0) return;

    const rockGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, count);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    let idx = 0;
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const tile = map.tiles[x][z];
        if ((tile.terrain !== TerrainType.GRASS && tile.terrain !== TerrainType.SAND) || Math.random() >= 0.03) continue;
        if (idx >= count) break;
        const wx = x * TILE_SIZE + Math.random() * TILE_SIZE;
        const wz = z * TILE_SIZE + Math.random() * TILE_SIZE;
        const wy = tile.elevation * 5.5;
        const s = 0.5 + Math.random() * 1.2;
        p.set(wx, wy + 0.05 * s, wz);
        q.setFromAxisAngle(new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), Math.random() * Math.PI);
        sc.set(s, s * (0.5 + Math.random() * 0.5), s);
        m.compose(p, q, sc);
        rockInst.setMatrixAt(idx, m);
        idx++;
      }
    }
    rockInst.instanceMatrix.needsUpdate = true;
    rockInst.computeBoundingSphere();
    this.group.add(rockInst);
  }

  private buildDustParticles(): void {
    const count = 300;
    const positions = new Float32Array(count * 3);
    const center = MAP_SIZE * TILE_SIZE / 2;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = center + (Math.random() - 0.5) * MAP_SIZE * TILE_SIZE * 0.8;
      positions[i * 3 + 1] = 1 + Math.random() * 8;
      positions[i * 3 + 2] = center + (Math.random() - 0.5) * MAP_SIZE * TILE_SIZE * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.35, sizeAttenuation: true });
    this.dustParticles = new THREE.Points(geo, mat);
    this.group.add(this.dustParticles);
  }

  update(t: number): void {
    for (const marker of this.resourceMarkers) {
      if (marker.children[0] instanceof THREE.Mesh) {
        marker.children[0].rotation.y = t * 0.6;
      }
      for (const child of marker.children) {
        if (child instanceof THREE.PointLight) {
          child.intensity = 0.8 + Math.sin(t * 2.5) * 0.4;
        }
      }
    }

    if (this.waterMesh) {
      const positions = this.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const y = Math.sin(x * 0.15 + t * 1.2) * 0.08 + Math.cos(z * 0.12 + t * 0.9) * 0.06;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
      this.waterMesh.geometry.computeVertexNormals();
    }

    if (this.dustParticles) {
      const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += 0.005;
        if (y > 10) y = 1;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t + i * 0.5) * 0.003);
      }
      pos.needsUpdate = true;
    }
  }
}
