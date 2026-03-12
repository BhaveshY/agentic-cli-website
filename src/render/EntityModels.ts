import * as THREE from 'three';
import {
  BuildingType, Faction, UnitType, UnitState,
  type Building, type Unit,
} from '../types';
import { BUILDING_DEFS, FACTION_COLORS, TILE_SIZE, UNIT_DEFS } from '../config';

interface EntityVisual {
  group: THREE.Group;
  healthBar: THREE.Mesh;
  healthBg: THREE.Mesh;
  selectionRing: THREE.Mesh;
}

export class EntityRenderer {
  readonly unitGroup = new THREE.Group();
  readonly buildingGroup = new THREE.Group();

  private unitVisuals = new Map<number, EntityVisual>();
  private buildingVisuals = new Map<number, EntityVisual>();
  private buildGhostMesh: THREE.Mesh | null = null;

  private moveMarkers: THREE.Mesh[] = [];

  createUnitVisual(unit: Unit, faction: Faction): void {
    const group = new THREE.Group();
    const colors = FACTION_COLORS[faction];
    const mesh = this.buildUnitMesh(unit.type, colors);
    mesh.scale.set(1.6, 1.6, 1.6);
    group.add(mesh);

    const { healthBar, healthBg } = this.createHealthBar(1.0);
    healthBg.position.y = 2.4;
    healthBar.position.y = 2.4;
    group.add(healthBg);
    group.add(healthBar);

    const ringGeo = new THREE.RingGeometry(0.6, 0.75, 24);
    const selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.05;
    selectionRing.visible = false;
    group.add(selectionRing);

    group.position.set(unit.x * TILE_SIZE, 0, unit.z * TILE_SIZE);
    this.unitGroup.add(group);
    this.unitVisuals.set(unit.id, { group, healthBar, healthBg, selectionRing });
  }

  createBuildingVisual(building: Building, faction: Faction): void {
    const group = new THREE.Group();
    const colors = FACTION_COLORS[faction];
    const mesh = this.buildBuildingMesh(building.type, colors);
    group.add(mesh);

    const def = BUILDING_DEFS[building.type];
    const barWidth = def.size * TILE_SIZE * 0.8;
    const { healthBar, healthBg } = this.createHealthBar(barWidth);
    healthBg.position.y = this.getBuildingHeight(building.type) + 0.5;
    healthBar.position.y = this.getBuildingHeight(building.type) + 0.5;
    group.add(healthBg);
    group.add(healthBar);

    const ringGeo = new THREE.RingGeometry(def.size * TILE_SIZE * 0.5, def.size * TILE_SIZE * 0.55, 32);
    const selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.05;
    selectionRing.visible = false;
    group.add(selectionRing);

    const wx = (building.tileX + def.size / 2) * TILE_SIZE;
    const wz = (building.tileZ + def.size / 2) * TILE_SIZE;
    group.position.set(wx, 0, wz);
    this.buildingGroup.add(group);
    this.buildingVisuals.set(building.id, { group, healthBar, healthBg, selectionRing });
  }

  private addLegs(g: THREE.Group, mat: THREE.Material, y: number): void {
    const legGeo = new THREE.BoxGeometry(0.1, 0.35, 0.12);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-0.1, y, 0);
    g.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(0.1, y, 0);
    g.add(rightLeg);
  }

  private addArms(g: THREE.Group, mat: THREE.Material, y: number, w: number): void {
    const armGeo = new THREE.BoxGeometry(0.08, 0.3, 0.1);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-w, y, 0);
    g.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(w, y, 0);
    g.add(rightArm);
  }

  private buildUnitMesh(type: UnitType, colors: { primary: number; secondary: number; accent: number }): THREE.Group {
    const g = new THREE.Group();
    const pri = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.45, metalness: 0.2, flatShading: true });
    const sec = new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: 0.45, metalness: 0.2, flatShading: true });
    const acc = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.25, metalness: 0.4, flatShading: true });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.85, roughness: 0.2, flatShading: true });

    switch (type) {
      case UnitType.WORKER: {
        this.addLegs(g, sec, 0.18);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.22), pri);
        body.position.y = 0.55;
        body.castShadow = true;
        g.add(body);
        this.addArms(g, skin, 0.5, 0.24);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), skin);
        head.position.y = 0.88;
        g.add(head);
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.08, 6), sec);
        hat.position.y = 1.0;
        g.add(hat);
        const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x8B5A2B }));
        pickHandle.position.set(0.28, 0.6, 0);
        pickHandle.rotation.z = 0.5;
        g.add(pickHandle);
        const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.04), metal);
        pickHead.position.set(0.38, 0.82, 0);
        g.add(pickHead);
        break;
      }
      case UnitType.SWORDSMAN: {
        this.addLegs(g, sec, 0.18);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.24), pri);
        body.position.y = 0.58;
        body.castShadow = true;
        g.add(body);
        const armor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.26), acc);
        armor.position.y = 0.68;
        g.add(armor);
        this.addArms(g, pri, 0.55, 0.26);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), skin);
        head.position.y = 0.93;
        g.add(head);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4, 0, Math.PI * 2, 0, Math.PI / 2), acc);
        helmet.position.y = 0.93;
        g.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.16), acc);
        visor.position.set(0, 0.94, 0.04);
        g.add(visor);
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.06), metal);
        sword.position.set(0.32, 0.55, 0);
        g.add(sword);
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), acc);
        hilt.position.set(0.32, 0.3, 0);
        g.add(hilt);
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 6), acc);
        shield.position.set(-0.28, 0.55, 0.05);
        shield.rotation.z = Math.PI / 2;
        g.add(shield);
        break;
      }
      case UnitType.ARCHER: {
        this.addLegs(g, sec, 0.18);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.2), pri);
        body.position.y = 0.55;
        body.castShadow = true;
        g.add(body);
        this.addArms(g, pri, 0.5, 0.22);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), skin);
        head.position.y = 0.88;
        g.add(head);
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 5), pri);
        hood.position.y = 1.02;
        g.add(hood);
        const cape = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.03), pri);
        cape.position.set(0, 0.5, -0.13);
        g.add(cape);
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 4, 10, Math.PI * 1.2), acc);
        bow.position.set(0.26, 0.55, 0);
        bow.rotation.z = Math.PI / 2;
        g.add(bow);
        const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), sec);
        quiver.position.set(-0.05, 0.6, -0.15);
        quiver.rotation.x = 0.15;
        g.add(quiver);
        break;
      }
      case UnitType.KNIGHT: {
        this.addLegs(g, acc, 0.2);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.3), acc);
        body.position.y = 0.62;
        body.castShadow = true;
        g.add(body);
        const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), acc);
        shoulderL.position.set(-0.28, 0.82, 0);
        g.add(shoulderL);
        const shoulderR = shoulderL.clone();
        shoulderR.position.set(0.28, 0.82, 0);
        g.add(shoulderR);
        this.addArms(g, acc, 0.6, 0.3);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), acc);
        head.position.y = 1.0;
        g.add(head);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 }));
        visor.position.set(0, 1.0, 0.12);
        g.add(visor);
        const plume = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.18), pri);
        plume.position.y = 1.2;
        g.add(plume);
        const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.0, 5), metal);
        lance.position.set(0.38, 0.7, 0);
        lance.rotation.z = 0.1;
        g.add(lance);
        const lanceHead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), metal);
        lanceHead.position.set(0.4, 1.22, 0);
        g.add(lanceHead);
        break;
      }
    }
    return g;
  }

  private buildBuildingMesh(type: BuildingType, colors: { primary: number; secondary: number; accent: number }): THREE.Group {
    const g = new THREE.Group();
    const pri = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.6, metalness: 0.2, flatShading: true });
    const sec = new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: 0.6, metalness: 0.2, flatShading: true });
    const acc = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.3, metalness: 0.4, flatShading: true });
    const stone = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.8, flatShading: true });

    const s = TILE_SIZE;

    switch (type) {
      case BuildingType.CITADEL: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 2.5, 1.5, s * 2.5), stone);
        base.position.y = 0.75;
        base.castShadow = true;
        g.add(base);
        const tower1 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, 3.0, s * 0.6), pri);
        tower1.position.set(-s * 0.8, 2.25, -s * 0.8);
        tower1.castShadow = true;
        g.add(tower1);
        const tower2 = tower1.clone();
        tower2.position.set(s * 0.8, 2.25, -s * 0.8);
        g.add(tower2);
        const tower3 = tower1.clone();
        tower3.position.set(-s * 0.8, 2.25, s * 0.8);
        g.add(tower3);
        const tower4 = tower1.clone();
        tower4.position.set(s * 0.8, 2.25, s * 0.8);
        g.add(tower4);
        for (const tw of [tower1, tower2, tower3, tower4]) {
          const top = new THREE.Mesh(new THREE.ConeGeometry(s * 0.4, 0.8, 4), acc);
          top.position.set(tw.position.x, 4.0, tw.position.z);
          top.castShadow = true;
          g.add(top);
        }
        const mainTower = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, 4.0, s * 0.8), pri);
        mainTower.position.y = 3.5;
        mainTower.castShadow = true;
        g.add(mainTower);
        const mainTop = new THREE.Mesh(new THREE.ConeGeometry(s * 0.6, 1.2, 4), acc);
        mainTop.position.y = 6.0;
        mainTop.castShadow = true;
        g.add(mainTop);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.5), acc);
        banner.position.set(0, 6.8, 0);
        g.add(banner);
        break;
      }
      case BuildingType.BARRACKS: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.8, 1.2, s * 1.8), stone);
        base.position.y = 0.6;
        base.castShadow = true;
        g.add(base);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(s * 2.0, 0.15, s * 2.0), wood);
        roof.position.y = 1.25;
        roof.castShadow = true;
        g.add(roof);
        const roofTop = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, 0.8, s * 0.3), pri);
        roofTop.position.y = 1.7;
        roofTop.rotation.y = Math.PI / 4;
        g.add(roofTop);
        break;
      }
      case BuildingType.FARM: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, 0.3, s * 1.5), wood);
        base.position.y = 0.15;
        g.add(base);
        const fieldMat = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.9 });
        const field = new THREE.Mesh(new THREE.BoxGeometry(s * 1.8, 0.05, s * 1.8), fieldMat);
        field.position.y = 0.02;
        g.add(field);
        for (let i = 0; i < 4; i++) {
          const crop = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x66aa33 }));
          crop.position.set((i - 1.5) * 0.5, 0.25, (Math.random() - 0.5) * s);
          g.add(crop);
        }
        break;
      }
      case BuildingType.TOWER: {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.4, 2.5, 6), stone);
        base.position.y = 1.25;
        base.castShadow = true;
        g.add(base);
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.35, 0.3, 6), pri);
        platform.position.y = 2.65;
        g.add(platform);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.45, 1.0, 6), acc);
        roof.position.y = 3.3;
        roof.castShadow = true;
        g.add(roof);
        break;
      }
      case BuildingType.AETHER_WELL: {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.7, 0.5, 8), stone);
        base.position.y = 0.25;
        g.add(base);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 4), acc);
        pillar.position.set(s * 0.4, 1.0, 0);
        g.add(pillar);
        const pillar2 = pillar.clone();
        pillar2.position.set(-s * 0.4, 1.0, 0);
        g.add(pillar2);
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.3, 0),
          new THREE.MeshStandardMaterial({ color: 0x7b68ee, emissive: 0x5533cc, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
        );
        crystal.position.y = 1.5;
        g.add(crystal);
        const glow = new THREE.PointLight(0x7b68ee, 0.5, 5);
        glow.position.y = 1.5;
        g.add(glow);
        break;
      }
      case BuildingType.LUMBER_CAMP: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, 0.8, s * 1.2), wood);
        base.position.y = 0.4;
        base.castShadow = true;
        g.add(base);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(s * 1.7, 0.1, s * 1.4), pri);
        roof.position.y = 0.85;
        roof.rotation.z = 0.1;
        g.add(roof);
        for (let i = 0; i < 3; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 4), wood);
          log.rotation.z = Math.PI / 2;
          log.position.set(s * 0.8, 0.1 + i * 0.18, (i - 1) * 0.3);
          g.add(log);
        }
        break;
      }
      case BuildingType.QUARRY: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, 0.6, s * 1.5), stone);
        base.position.y = 0.3;
        base.castShadow = true;
        g.add(base);
        const crane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1), wood);
        crane.position.set(s * 0.5, 1.3, 0);
        g.add(crane);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), wood);
        arm.position.set(0, 2.3, 0);
        g.add(arm);
        break;
      }
      case BuildingType.ARMORY: {
        const base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.8, 1.5, s * 1.8), stone);
        base.position.y = 0.75;
        base.castShadow = true;
        g.add(base);
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 5), stone);
        chimney.position.set(s * 0.5, 2.0, -s * 0.3);
        g.add(chimney);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 1.0, 0.8, 4), pri);
        roof.position.y = 1.9;
        roof.castShadow = true;
        g.add(roof);
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9 }));
        anvil.position.set(0, 0.07, s * 0.9);
        g.add(anvil);
        break;
      }
    }
    return g;
  }

  private getBuildingHeight(type: BuildingType): number {
    switch (type) {
      case BuildingType.CITADEL: return 6.5;
      case BuildingType.TOWER: return 3.5;
      case BuildingType.BARRACKS: return 2.0;
      case BuildingType.ARMORY: return 2.5;
      case BuildingType.AETHER_WELL: return 2.0;
      case BuildingType.LUMBER_CAMP: return 1.2;
      case BuildingType.QUARRY: return 2.5;
      case BuildingType.FARM: return 0.6;
      default: return 1.5;
    }
  }

  private createHealthBar(width: number): { healthBar: THREE.Mesh; healthBg: THREE.Mesh } {
    const bgGeo = new THREE.PlaneGeometry(width, 0.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const healthBg = new THREE.Mesh(bgGeo, bgMat);
    healthBg.position.y = 1.3;
    healthBg.visible = false;

    const barGeo = new THREE.PlaneGeometry(width, 0.08);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
    const healthBar = new THREE.Mesh(barGeo, barMat);
    healthBar.position.y = 1.3;
    healthBar.visible = false;

    return { healthBar, healthBg };
  }

  showMoveMarker(worldX: number, worldZ: number): void {
    const geo = new THREE.RingGeometry(0.3, 0.5, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const marker = new THREE.Mesh(geo, mat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(worldX, 0.1, worldZ);
    this.unitGroup.add(marker);
    this.moveMarkers.push(marker);

    setTimeout(() => {
      this.unitGroup.remove(marker);
      this.moveMarkers = this.moveMarkers.filter((m) => m !== marker);
    }, 1200);
  }

  getTerrainHeight(x: number, z: number, tiles: { elevation: number }[][]): number {
    const tx = Math.max(0, Math.min(tiles.length - 1, Math.floor(x)));
    const tz = Math.max(0, Math.min((tiles[0]?.length || 1) - 1, Math.floor(z)));
    return (tiles[tx]?.[tz]?.elevation || 0.25) * 5.5;
  }

  updateUnits(units: Map<number, Unit>, selectedIds: Set<number>, t: number, camera?: THREE.Camera, tiles?: { elevation: number }[][]): void {
    for (const [id, unit] of units) {
      if (unit.state === UnitState.DEAD) {
        const vis = this.unitVisuals.get(id);
        if (vis) {
          this.unitGroup.remove(vis.group);
          this.unitVisuals.delete(id);
        }
        continue;
      }

      const vis = this.unitVisuals.get(id);
      if (!vis) continue;

      vis.group.position.x = unit.x * TILE_SIZE;
      vis.group.position.z = unit.z * TILE_SIZE;
      const groundY = tiles ? this.getTerrainHeight(unit.x, unit.z, tiles) : 0;
      vis.group.position.y = groundY;

      const isMoving = unit.state === UnitState.MOVING || unit.state === UnitState.RETURNING;
      const isAttacking = unit.state === UnitState.ATTACKING;
      const isGathering = unit.state === UnitState.GATHERING;
      const isBuilding = unit.state === UnitState.BUILDING;

      if (isMoving) {
        vis.group.position.y = groundY + Math.sin(t * 10) * 0.06;
      } else if (isAttacking) {
        vis.group.position.y = groundY + Math.abs(Math.sin(t * 12)) * 0.08;
      } else if (isGathering || isBuilding) {
        if (vis.group.children[0]) vis.group.children[0].rotation.z = Math.sin(t * 6) * 0.12;
      } else {
        vis.group.position.y = groundY + Math.sin(t * 2 + id) * 0.015;
      }

      if (unit.path.length > 0 && unit.pathIndex < unit.path.length) {
        const target = unit.path[unit.pathIndex];
        const angle = Math.atan2(
          (target.x * TILE_SIZE) - vis.group.position.x,
          (target.z * TILE_SIZE) - vis.group.position.z
        );
        vis.group.rotation.y = angle;
      } else if (unit.attackTargetId) {
        const target = units.get(unit.attackTargetId);
        if (target) {
          vis.group.rotation.y = Math.atan2(
            target.x * TILE_SIZE - vis.group.position.x,
            target.z * TILE_SIZE - vis.group.position.z
          );
        }
      }

      const selected = selectedIds.has(id);
      vis.selectionRing.visible = selected;

      const hpRatio = unit.hp / unit.maxHp;
      const showHealth = selected || hpRatio < 1;
      vis.healthBar.visible = showHealth;
      vis.healthBg.visible = showHealth;
      if (showHealth) {
        vis.healthBar.scale.x = Math.max(0.01, hpRatio);
        (vis.healthBar.material as THREE.MeshBasicMaterial).color.setHex(
          hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444
        );
      }

      for (const marker of this.moveMarkers) {
        (marker.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 6) * 0.3;
        marker.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
      }
    }
  }

  updateBuildings(buildings: Map<number, Building>, selectedIds: Set<number>, t: number, tiles?: { elevation: number }[][]): void {
    for (const [id, building] of buildings) {
      if (building.hp <= 0) {
        const vis = this.buildingVisuals.get(id);
        if (vis) {
          this.buildingGroup.remove(vis.group);
          this.buildingVisuals.delete(id);
        }
        continue;
      }

      const vis = this.buildingVisuals.get(id);
      if (!vis) continue;

      if (tiles) {
        const def = BUILDING_DEFS[building.type];
        const groundY = this.getTerrainHeight(building.tileX + def.size / 2, building.tileZ + def.size / 2, tiles);
        vis.group.position.y = groundY;
      }

      const selected = selectedIds.has(id);
      vis.selectionRing.visible = selected;

      if (!building.isComplete) {
        const progress = building.buildProgress / 100;
        vis.group.children[0].scale.y = Math.max(0.1, progress);
        vis.group.children[0].position.y *= progress;
      }

      const hpRatio = building.hp / building.maxHp;
      const showHealth = selected || hpRatio < 1;
      vis.healthBar.visible = showHealth;
      vis.healthBg.visible = showHealth;
      if (showHealth) {
        vis.healthBar.scale.x = Math.max(0.01, hpRatio);
        (vis.healthBar.material as THREE.MeshBasicMaterial).color.setHex(
          hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444
        );
      }
    }
  }

  removeEntity(id: number): void {
    const uVis = this.unitVisuals.get(id);
    if (uVis) {
      this.unitGroup.remove(uVis.group);
      this.unitVisuals.delete(id);
    }
    const bVis = this.buildingVisuals.get(id);
    if (bVis) {
      this.buildingGroup.remove(bVis.group);
      this.buildingVisuals.delete(id);
    }
  }

  showBuildGhost(type: BuildingType, tileX: number, tileZ: number, valid: boolean): void {
    this.hideBuildGhost();

    const def = BUILDING_DEFS[type];
    const s = def.size * TILE_SIZE;
    const geo = new THREE.BoxGeometry(s * 0.9, 0.3, s * 0.9);
    const mat = new THREE.MeshBasicMaterial({
      color: valid ? 0x00ff00 : 0xff0000,
      transparent: true,
      opacity: 0.4,
    });
    this.buildGhostMesh = new THREE.Mesh(geo, mat);
    this.buildGhostMesh.position.set(
      (tileX + def.size / 2) * TILE_SIZE,
      0.2,
      (tileZ + def.size / 2) * TILE_SIZE
    );
    this.buildingGroup.add(this.buildGhostMesh);
  }

  hideBuildGhost(): void {
    if (this.buildGhostMesh) {
      this.buildingGroup.remove(this.buildGhostMesh);
      this.buildGhostMesh = null;
    }
  }
}
