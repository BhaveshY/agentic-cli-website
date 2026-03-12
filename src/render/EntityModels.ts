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

  private addBattlements(g: THREE.Group, mat: THREE.Material, cx: number, y: number, cz: number, radius: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), mat);
      merlon.position.set(cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius);
      g.add(merlon);
    }
  }

  private buildBuildingMesh(type: BuildingType, colors: { primary: number; secondary: number; accent: number }): THREE.Group {
    const g = new THREE.Group();
    const pri = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.55, metalness: 0.15, flatShading: true });
    const sec = new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: 0.55, metalness: 0.15, flatShading: true });
    const acc = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.2, metalness: 0.35, flatShading: true });
    const stoneLight = new THREE.MeshStandardMaterial({ color: 0xa0a098, roughness: 0.85, flatShading: true });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x787870, roughness: 0.9, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.75, flatShading: true });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8, flatShading: true });
    const roofTile = new THREE.MeshStandardMaterial({ color: 0xb85c38, roughness: 0.7, flatShading: true });

    const s = TILE_SIZE;

    switch (type) {
      case BuildingType.CITADEL: {
        const wallBase = new THREE.Mesh(new THREE.BoxGeometry(s * 2.8, 0.6, s * 2.8), stoneDark);
        wallBase.position.y = 0.3;
        wallBase.castShadow = true;
        g.add(wallBase);

        const wallHeight = 1.6;
        const walls = [
          { x: 0, z: -s * 1.2, sx: s * 2.6, sz: 0.25 },
          { x: 0, z: s * 1.2, sx: s * 2.6, sz: 0.25 },
          { x: -s * 1.2, z: 0, sx: 0.25, sz: s * 2.4 },
          { x: s * 1.2, z: 0, sx: 0.25, sz: s * 2.4 },
        ];
        for (const w of walls) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w.sx, wallHeight, w.sz), stoneLight);
          wall.position.set(w.x, wallHeight / 2 + 0.6, w.z);
          wall.castShadow = true;
          g.add(wall);
        }

        this.addBattlements(g, stoneLight, 0, wallHeight + 0.7, 0, s * 1.15, 16);

        const gate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), woodDark);
        gate.position.set(0, 1.0, s * 1.22);
        g.add(gate);
        const gateArch = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 8, 1, false, 0, Math.PI), stoneLight);
        gateArch.position.set(0, 1.45, s * 1.22);
        gateArch.rotation.x = Math.PI / 2;
        g.add(gateArch);

        const towerPositions = [
          [-s * 1.05, -s * 1.05], [s * 1.05, -s * 1.05],
          [-s * 1.05, s * 1.05], [s * 1.05, s * 1.05],
        ];
        for (const [tx, tz] of towerPositions) {
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.32, 3.2, 7), pri);
          tower.position.set(tx, 2.2, tz);
          tower.castShadow = true;
          g.add(tower);
          const towerTop = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35, 1.0, 7), acc);
          towerTop.position.set(tx, 4.1, tz);
          towerTop.castShadow = true;
          g.add(towerTop);
          this.addBattlements(g, stoneLight, tx, 3.85, tz, s * 0.3, 6);
        }

        const keep = new THREE.Mesh(new THREE.BoxGeometry(s * 0.9, 3.5, s * 0.9), pri);
        keep.position.y = 2.35;
        keep.castShadow = true;
        g.add(keep);
        for (let wy = 0; wy < 2; wy++) {
          for (let side = 0; side < 4; side++) {
            const angle = (side / 4) * Math.PI * 2;
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 0.3 }));
            win.position.set(Math.cos(angle) * s * 0.46, 1.8 + wy * 1.2, Math.sin(angle) * s * 0.46);
            win.lookAt(new THREE.Vector3(0, win.position.y, 0));
            g.add(win);
          }
        }
        const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.65, 1.5, 4), acc);
        keepRoof.position.y = 4.85;
        keepRoof.rotation.y = Math.PI / 4;
        keepRoof.castShadow = true;
        g.add(keepRoof);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4), stoneDark);
        pole.position.y = 6.3;
        g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), acc);
        flag.position.set(0.25, 6.8, 0);
        flag.material.side = THREE.DoubleSide;
        g.add(flag);

        const courtyard = new THREE.Mesh(new THREE.BoxGeometry(s * 1.8, 0.02, s * 1.8), stoneDark);
        courtyard.position.y = 0.61;
        g.add(courtyard);
        break;
      }
      case BuildingType.BARRACKS: {
        const foundation = new THREE.Mesh(new THREE.BoxGeometry(s * 2.0, 0.3, s * 1.8), stoneDark);
        foundation.position.y = 0.15;
        g.add(foundation);
        const wallsGeo = new THREE.BoxGeometry(s * 1.8, 1.3, s * 1.6);
        const wallsMesh = new THREE.Mesh(wallsGeo, stoneLight);
        wallsMesh.position.y = 0.95;
        wallsMesh.castShadow = true;
        g.add(wallsMesh);
        const roofBase = new THREE.Mesh(new THREE.BoxGeometry(s * 2.0, 0.1, s * 1.8), wood);
        roofBase.position.y = 1.65;
        g.add(roofBase);
        const roofA = new THREE.Mesh(new THREE.BoxGeometry(s * 2.1, 0.08, s * 1.05), roofTile);
        roofA.position.set(0, 2.0, -s * 0.25);
        roofA.rotation.x = -0.35;
        roofA.castShadow = true;
        g.add(roofA);
        const roofB = roofA.clone();
        roofB.position.z = s * 0.25;
        roofB.rotation.x = 0.35;
        g.add(roofB);
        for (let i = 0; i < 3; i++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.06), woodDark);
          win.position.set((i - 1) * 0.55, 1.1, s * 0.82);
          g.add(win);
        }
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.06), woodDark);
        door.position.set(0, 0.6, s * 0.82);
        g.add(door);
        const dummy = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4), wood);
        dummy.position.set(s * 0.9, 0.7, s * 0.3);
        g.add(dummy);
        const dummyHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), new THREE.MeshStandardMaterial({ color: 0xccaa88 }));
        dummyHead.position.set(s * 0.9, 1.15, s * 0.3);
        g.add(dummyHead);
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.08), wood);
        rack.position.set(-s * 0.85, 0.8, s * 0.5);
        g.add(rack);
        for (let i = 0; i < 3; i++) {
          const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 }));
          weapon.position.set(-s * 0.85 + (i - 1) * 0.18, 1.0, s * 0.5);
          g.add(weapon);
        }
        break;
      }
      case BuildingType.FARM: {
        const soil = new THREE.Mesh(new THREE.BoxGeometry(s * 2.0, 0.08, s * 2.0), new THREE.MeshStandardMaterial({ color: 0x6b5a30, roughness: 0.95 }));
        soil.position.y = 0.04;
        g.add(soil);
        for (let row = 0; row < 4; row++) {
          const furrow = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.95 }));
          furrow.position.set(0, 0.11, (row - 1.5) * s * 0.4);
          g.add(furrow);
          for (let col = 0; col < 6; col++) {
            const cropH = 0.15 + Math.random() * 0.2;
            const crop = new THREE.Mesh(new THREE.ConeGeometry(0.06, cropH, 4), new THREE.MeshStandardMaterial({ color: 0x55aa22 + Math.floor(Math.random() * 0x222200), roughness: 0.8 }));
            crop.position.set((col - 2.5) * s * 0.28, 0.12 + cropH / 2, (row - 1.5) * s * 0.4);
            g.add(crop);
          }
        }
        const hut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), wood);
        hut.position.set(s * 0.8, 0.33, -s * 0.7);
        hut.castShadow = true;
        g.add(hut);
        const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.3, 4), roofTile);
        hutRoof.position.set(s * 0.8, 0.73, -s * 0.7);
        hutRoof.rotation.y = Math.PI / 4;
        g.add(hutRoof);
        break;
      }
      case BuildingType.TOWER: {
        const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.38, 0.6, 8), stoneDark);
        towerBase.position.y = 0.3;
        towerBase.castShadow = true;
        g.add(towerBase);
        const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.3, 2.8, 8), stoneLight);
        towerBody.position.y = 2.0;
        towerBody.castShadow = true;
        g.add(towerBody);
        const parapet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.32, 0.3, 8), stoneLight);
        parapet.position.y = 3.55;
        g.add(parapet);
        this.addBattlements(g, stoneLight, 0, 3.8, 0, s * 0.35, 8);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.4, 1.2, 8), acc);
        roof.position.y = 4.3;
        roof.castShadow = true;
        g.add(roof);
        for (let i = 0; i < 3; i++) {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.06), new THREE.MeshStandardMaterial({ color: 0x222222 }));
          const slitAngle = (i / 3) * Math.PI * 2;
          slit.position.set(Math.cos(slitAngle) * s * 0.3, 2.5, Math.sin(slitAngle) * s * 0.3);
          slit.lookAt(new THREE.Vector3(0, slit.position.y, 0));
          g.add(slit);
        }
        break;
      }
      case BuildingType.AETHER_WELL: {
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.65, 0.35, 8), stoneDark);
        basin.position.y = 0.18;
        g.add(basin);
        const innerBasin = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.5, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x4444aa, emissive: 0x2222aa, emissiveIntensity: 0.4, roughness: 0.1 }));
        innerBasin.position.y = 0.2;
        g.add(innerBasin);
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 5), acc);
          pillar.position.set(Math.cos(angle) * s * 0.4, 1.25, Math.sin(angle) * s * 0.4);
          pillar.castShadow = true;
          g.add(pillar);
        }
        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, 0.06, s * 0.7), acc);
        crossbar.position.y = 2.15;
        g.add(crossbar);
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.35, 0),
          new THREE.MeshPhysicalMaterial({ color: 0x8878ee, emissive: 0x6644dd, emissiveIntensity: 0.6, clearcoat: 1, transparent: true, opacity: 0.85 })
        );
        crystal.position.y = 1.6;
        g.add(crystal);
        const glow = new THREE.PointLight(0x7b68ee, 0.8, 6);
        glow.position.y = 1.6;
        g.add(glow);
        break;
      }
      case BuildingType.LUMBER_CAMP: {
        const platform = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, 0.12, s * 1.3), wood);
        platform.position.y = 0.06;
        g.add(platform);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, 0.9, s * 0.9), wood);
        cabin.position.y = 0.55;
        cabin.castShadow = true;
        g.add(cabin);
        const roofL = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, 0.06, s * 0.6), roofTile);
        roofL.position.set(0, 1.15, -s * 0.15);
        roofL.rotation.x = -0.3;
        g.add(roofL);
        const roofR = roofL.clone();
        roofR.position.z = s * 0.15;
        roofR.rotation.x = 0.3;
        g.add(roofR);
        for (let i = 0; i < 4; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x7a5230 }));
          log.rotation.z = Math.PI / 2;
          log.position.set(s * 0.75, 0.1 + i * 0.15, (i % 2 - 0.5) * 0.2);
          g.add(log);
        }
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a28 }));
        stump.position.set(-s * 0.7, 0.12, s * 0.4);
        g.add(stump);
        const axe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.03), new THREE.MeshStandardMaterial({ color: 0x8B5A2B }));
        axe.position.set(-s * 0.65, 0.3, s * 0.4);
        axe.rotation.z = 0.3;
        g.add(axe);
        break;
      }
      case BuildingType.QUARRY: {
        const pit = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, 0.4, s * 1.5), stoneDark);
        pit.position.y = 0.2;
        pit.castShadow = true;
        g.add(pit);
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.8), stoneDark);
        ramp.position.set(s * 0.6, 0.15, 0);
        ramp.rotation.z = -0.2;
        g.add(ramp);
        const crane = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 5), wood);
        crane.position.set(-s * 0.3, 1.65, -s * 0.3);
        crane.castShadow = true;
        g.add(crane);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), wood);
        arm.position.set(0.1, 2.9, -s * 0.3);
        g.add(arm);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 3), new THREE.MeshStandardMaterial({ color: 0x886644 }));
        rope.position.set(0.6, 2.4, -s * 0.3);
        g.add(rope);
        for (let i = 0; i < 3; i++) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.1, 0), stoneDark);
          rock.position.set(s * 0.3 + i * 0.2, 0.45 + Math.random() * 0.1, s * 0.4);
          rock.rotation.set(Math.random(), Math.random(), 0);
          g.add(rock);
        }
        break;
      }
      case BuildingType.ARMORY: {
        const foundation = new THREE.Mesh(new THREE.BoxGeometry(s * 1.9, 0.3, s * 1.9), stoneDark);
        foundation.position.y = 0.15;
        g.add(foundation);
        const walls = new THREE.Mesh(new THREE.BoxGeometry(s * 1.7, 1.5, s * 1.7), stoneLight);
        walls.position.y = 1.05;
        walls.castShadow = true;
        g.add(walls);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 1.1, 1.0, 4), roofTile);
        roof.position.y = 2.3;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        g.add(roof);
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.8, 5), stoneDark);
        chimney.position.set(s * 0.45, 2.4, -s * 0.35);
        chimney.castShadow = true;
        g.add(chimney);
        const smokeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.12, 5), stoneDark);
        smokeTop.position.set(s * 0.45, 3.35, -s * 0.35);
        g.add(smokeTop);
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.18), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.9, roughness: 0.3 }));
        anvil.position.set(-s * 0.3, 0.4, s * 0.9);
        g.add(anvil);
        const forge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x444444 }));
        forge.position.set(s * 0.2, 0.45, s * 0.9);
        g.add(forge);
        const forgeGlow = new THREE.PointLight(0xff6622, 0.4, 3);
        forgeGlow.position.set(s * 0.2, 0.6, s * 0.9);
        g.add(forgeGlow);
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
