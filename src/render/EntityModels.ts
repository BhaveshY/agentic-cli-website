import * as THREE from 'three';
import {
  BuildingType, Faction, UnitType, UnitState,
  type Building, type Unit,
} from '../types';
import { BUILDING_DEFS, FACTION_COLORS, TILE_SIZE } from '../config';
import { getModel, hasModel, applyFactionTint, normalizeModelScale, centerModelAtBase, getAnimations } from './AssetLoader';

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
  private deathEffects: Array<{ group: THREE.Group; age: number }> = [];
  private projectiles: Array<{ mesh: THREE.Mesh; target: THREE.Vector3; speed: number; age: number }> = [];
  private unitTargetRotation = new Map<number, number>();
  private unitMixers = new Map<number, THREE.AnimationMixer>();
  private unitActions = new Map<number, Map<string, THREE.AnimationAction>>();
  private unitCurrentAnim = new Map<number, string>();
  private lastBuildProgress = new Map<number, number>();
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  private tmpVec3 = new THREE.Vector3();

  createUnitVisual(unit: Unit, faction: Faction): void {
    const group = new THREE.Group();
    const colors = FACTION_COLORS[faction];

    let unitHeight = 3.0;
    if (hasModel(unit.type)) {
      const glb = getModel(unit.type)!;
      normalizeModelScale(glb, 3.2);
      centerModelAtBase(glb);
      applyFactionTint(glb, colors);
      group.add(glb);
      unitHeight = 3.2;

      // Set up animations — map game states to animation clips
      const clips = getAnimations(unit.type);
      if (clips.length > 0) {
        const mixer = new THREE.AnimationMixer(glb);
        const actions = new Map<string, THREE.AnimationAction>();

        for (const clip of clips) {
          const name = clip.name.replace('CharacterArmature|', '');
          actions.set(name, mixer.clipAction(clip));
        }

        // Start with Idle
        const idle = actions.get('Idle') || actions.get('Idle_Neutral');
        if (idle) {
          idle.play();
          this.unitCurrentAnim.set(unit.id, 'Idle');
        }

        this.unitMixers.set(unit.id, mixer);
        this.unitActions.set(unit.id, actions);
      }
    } else {
      const mesh = this.buildUnitMesh(unit.type, colors);
      mesh.scale.set(3.0, 3.0, 3.0);
      group.add(mesh);
    }

    const { healthBar, healthBg } = this.createHealthBar(1.4);
    healthBg.position.y = unitHeight + 1.0;
    healthBar.position.y = unitHeight + 1.0;
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
    const def = BUILDING_DEFS[building.type];

    // Use the handcrafted procedural buildings — they're higher quality than generic GLBs
    const mesh = this.buildBuildingMesh(building.type, colors);
    group.add(mesh);
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

  private addDetailedLegs(g: THREE.Group, pantsMat: THREE.Material, bootMat: THREE.Material, spread: number, height: number): void {
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 8), pantsMat);
      thigh.position.set(side * spread, height + 0.11, 0);
      thigh.castShadow = true;
      g.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), pantsMat);
      shin.position.set(side * spread, height - 0.1, 0);
      shin.castShadow = true;
      g.add(shin);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), pantsMat);
      knee.position.set(side * spread, height, 0);
      g.add(knee);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), bootMat);
      boot.position.set(side * spread, height - 0.22, 0);
      g.add(boot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.16), bootMat);
      sole.position.set(side * spread, height - 0.27, 0.02);
      g.add(sole);
    }
  }

  private addDetailedArms(g: THREE.Group, mat: THREE.Material, handMat: THREE.Material, y: number, w: number): void {
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat);
      shoulder.position.set(side * w, y + 0.12, 0);
      g.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18, 8), mat);
      upper.position.set(side * w, y, 0);
      upper.castShadow = true;
      g.add(upper);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat);
      elbow.position.set(side * w, y - 0.1, 0);
      g.add(elbow);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 8), mat);
      lower.position.set(side * w, y - 0.2, 0);
      lower.castShadow = true;
      g.add(lower);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), handMat);
      hand.position.set(side * w, y - 0.3, 0);
      g.add(hand);
    }
  }

  private addDetailedHead(g: THREE.Group, skinMat: THREE.Material, y: number, hasHair = true): void {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    head.position.y = y;
    head.scale.set(1, 1.1, 1);
    head.castShadow = true;
    g.add(head);
    const noseGeo = new THREE.ConeGeometry(0.02, 0.05, 6);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, y - 0.02, 0.12);
    nose.rotation.x = -Math.PI / 2;
    g.add(nose);
    const earMat = skinMat;
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), earMat);
      ear.position.set(side * 0.12, y, 0);
      ear.scale.set(0.5, 0.8, 0.6);
      g.add(ear);
    }
    if (hasHair) {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 })
      );
      hair.position.y = y + 0.02;
      hair.scale.set(1.02, 1.0, 1.05);
      g.add(hair);
    }
  }

  private buildUnitMesh(type: UnitType, colors: { primary: number; secondary: number; accent: number }): THREE.Group {
    const g = new THREE.Group();
    const pri = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.55, metalness: 0.15 });
    const sec = new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: 0.55, metalness: 0.15 });
    const acc = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.3, metalness: 0.35 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7, metalness: 0.0 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.15 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.85, roughness: 0.2 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8, metalness: 0.05 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.75 });

    switch (type) {
      case UnitType.WORKER: {
        this.addDetailedLegs(g, sec, leather, 0.08, 0.18);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.32, 10), pri);
        torso.position.y = 0.52;
        torso.castShadow = true;
        g.add(torso);
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 10), leather);
        belt.position.y = 0.38;
        g.add(belt);
        const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), metal);
        beltBuckle.position.set(0, 0.38, 0.11);
        g.add(beltBuckle);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 10), pri);
        collar.position.y = 0.69;
        g.add(collar);
        this.addDetailedArms(g, skin, skin, 0.55, 0.2);
        this.addDetailedHead(g, skin, 0.82);
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.06, 10), sec);
        hat.position.y = 0.95;
        g.add(hat);
        const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 12), sec);
        hatBrim.position.y = 0.92;
        g.add(hatBrim);
        const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.5, 8), wood);
        pickHandle.position.set(0.26, 0.6, 0);
        pickHandle.rotation.z = 0.5;
        g.add(pickHandle);
        const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.03), darkMetal);
        pickHead.position.set(0.36, 0.84, 0);
        g.add(pickHead);
        const pickPoint = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), darkMetal);
        pickPoint.position.set(0.46, 0.84, 0);
        pickPoint.rotation.z = -Math.PI / 2;
        g.add(pickPoint);
        const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), leather);
        pouch.position.set(-0.12, 0.36, 0.04);
        pouch.scale.set(1, 1.2, 0.7);
        g.add(pouch);
        break;
      }
      case UnitType.SWORDSMAN: {
        const armorMat = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.3, metalness: 0.5 });
        this.addDetailedLegs(g, sec, armorMat, 0.09, 0.18);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.36, 10), armorMat);
        torso.position.y = 0.54;
        torso.castShadow = true;
        g.add(torso);
        const chestPlate = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI, 0, Math.PI), armorMat);
        chestPlate.position.set(0, 0.56, 0.02);
        chestPlate.scale.set(1.1, 0.7, 0.5);
        g.add(chestPlate);
        const waistGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 8), pri);
        waistGuard.position.y = 0.37;
        g.add(waistGuard);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.02), pri);
          tasset.position.set(Math.cos(angle) * 0.14, 0.3, Math.sin(angle) * 0.14);
          tasset.lookAt(new THREE.Vector3(0, 0.3, 0));
          g.add(tasset);
        }
        for (const side of [-1, 1]) {
          const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), armorMat);
          pauldron.position.set(side * 0.22, 0.72, 0);
          g.add(pauldron);
          const paulRim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12), armorMat);
          paulRim.position.set(side * 0.22, 0.68, 0);
          paulRim.rotation.x = Math.PI / 2;
          g.add(paulRim);
        }
        this.addDetailedArms(g, armorMat, darkMetal, 0.55, 0.24);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 8), armorMat);
        neck.position.y = 0.73;
        g.add(neck);
        const helmetBase = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), armorMat);
        helmetBase.position.y = 0.87;
        helmetBase.scale.set(1, 1.15, 1);
        helmetBase.castShadow = true;
        g.add(helmetBase);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), darkMetal);
        visor.position.set(0, 0.86, 0.12);
        g.add(visor);
        for (let i = 0; i < 3; i++) {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: 0x111111 }));
          slit.position.set((i - 1) * 0.04, 0.86, 0.14);
          g.add(slit);
        }
        const helmetCrest = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.2), armorMat);
        helmetCrest.position.set(0, 0.98, -0.02);
        g.add(helmetCrest);
        const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.5, 0.008), metal);
        swordBlade.position.set(0.32, 0.52, 0);
        g.add(swordBlade);
        const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.08, 4), metal);
        swordTip.position.set(0.32, 0.8, 0);
        g.add(swordTip);
        const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.025), acc);
        swordGuard.position.set(0.32, 0.28, 0);
        g.add(swordGuard);
        const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), leather);
        swordGrip.position.set(0.32, 0.22, 0);
        g.add(swordGrip);
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), acc);
        pommel.position.set(0.32, 0.16, 0);
        g.add(pommel);
        const shieldBody = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.03, 8), acc);
        shieldBody.position.set(-0.28, 0.52, 0.08);
        shieldBody.rotation.x = Math.PI / 2;
        g.add(shieldBody);
        const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), metal);
        shieldBoss.position.set(-0.28, 0.52, 0.1);
        g.add(shieldBoss);
        const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 6, 16), metal);
        shieldRim.position.set(-0.28, 0.52, 0.08);
        g.add(shieldRim);
        break;
      }
      case UnitType.ARCHER: {
        this.addDetailedLegs(g, sec, leather, 0.08, 0.18);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.3, 10), pri);
        torso.position.y = 0.52;
        torso.castShadow = true;
        g.add(torso);
        const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.2, 10), leather);
        vest.position.y = 0.54;
        g.add(vest);
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.03, 10), leather);
        belt.position.y = 0.39;
        g.add(belt);
        this.addDetailedArms(g, pri, skin, 0.5, 0.2);
        for (const side of [-1, 1]) {
          const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 8), leather);
          bracer.position.set(side * 0.2, 0.35, 0);
          g.add(bracer);
        }
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 8), skin);
        neck.position.y = 0.68;
        g.add(neck);
        this.addDetailedHead(g, skin, 0.8);
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 8), pri);
        hood.position.y = 0.95;
        g.add(hood);
        const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.4), pri);
        hoodBack.position.set(0, 0.85, -0.04);
        g.add(hoodBack);
        const capeTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.02), pri);
        capeTop.position.set(0, 0.66, -0.11);
        g.add(capeTop);
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.4), new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.6, side: THREE.DoubleSide }));
        cape.position.set(0, 0.44, -0.12);
        g.add(cape);
        const bowLimb = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 8, 16, Math.PI * 1.3), acc);
        bowLimb.position.set(0.24, 0.55, 0);
        bowLimb.rotation.z = Math.PI / 2;
        g.add(bowLimb);
        const bowGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), leather);
        bowGrip.position.set(0.24, 0.55, 0);
        g.add(bowGrip);
        const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 4), new THREE.MeshBasicMaterial({ color: 0xccccaa }));
        bowString.position.set(0.24, 0.55, 0);
        g.add(bowString);
        const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.35, 8), leather);
        quiver.position.set(-0.04, 0.58, -0.14);
        quiver.rotation.x = 0.12;
        g.add(quiver);
        const quiverRim = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 8), leather);
        quiverRim.position.set(-0.04, 0.76, -0.13);
        g.add(quiverRim);
        for (let i = 0; i < 4; i++) {
          const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 4), wood);
          arrow.position.set(-0.04 + (i - 1.5) * 0.015, 0.8, -0.14);
          g.add(arrow);
          const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.002), new THREE.MeshStandardMaterial({ color: 0xcc4444 }));
          fletch.position.set(-0.04 + (i - 1.5) * 0.015, 0.88, -0.14);
          g.add(fletch);
        }
        break;
      }
      case UnitType.KNIGHT: {
        const heavyArmor = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.2, metalness: 0.6 });
        this.addDetailedLegs(g, heavyArmor, heavyArmor, 0.1, 0.2);
        for (const side of [-1, 1]) {
          const kneeGuard = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), heavyArmor);
          kneeGuard.position.set(side * 0.1, 0.2, 0.03);
          kneeGuard.scale.set(1, 1, 0.6);
          g.add(kneeGuard);
        }
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.4, 10), heavyArmor);
        torso.position.y = 0.58;
        torso.castShadow = true;
        g.add(torso);
        const breastplate = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI, 0, Math.PI), heavyArmor);
        breastplate.position.set(0, 0.6, 0.02);
        breastplate.scale.set(1.1, 0.6, 0.5);
        g.add(breastplate);
        const gorget = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.06, 10), heavyArmor);
        gorget.position.y = 0.78;
        g.add(gorget);
        const waistplate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 8), heavyArmor);
        waistplate.position.y = 0.38;
        g.add(waistplate);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const fauld = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.015), pri);
          fauld.position.set(Math.cos(angle) * 0.15, 0.3, Math.sin(angle) * 0.15);
          fauld.lookAt(new THREE.Vector3(0, 0.3, 0));
          g.add(fauld);
        }
        for (const side of [-1, 1]) {
          const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), heavyArmor);
          pauldron.position.set(side * 0.26, 0.78, 0);
          g.add(pauldron);
          const ridgePaul = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.12), heavyArmor);
          ridgePaul.position.set(side * 0.26, 0.82, 0);
          g.add(ridgePaul);
        }
        this.addDetailedArms(g, heavyArmor, darkMetal, 0.6, 0.28);
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), heavyArmor);
        helm.position.y = 0.94;
        helm.scale.set(1, 1.15, 1.05);
        helm.castShadow = true;
        g.add(helm);
        const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.04), heavyArmor);
        faceplate.position.set(0, 0.9, 0.12);
        g.add(faceplate);
        const visorSlot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        visorSlot.position.set(0, 0.9, 0.14);
        g.add(visorSlot);
        for (let i = 0; i < 5; i++) {
          const breathHole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
          breathHole.position.set((i - 2) * 0.02, 0.87, 0.14);
          breathHole.rotation.x = Math.PI / 2;
          g.add(breathHole);
        }
        const plumeCrest = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.22), pri);
        plumeCrest.position.set(0, 1.08, -0.02);
        g.add(plumeCrest);
        for (let i = 0; i < 5; i++) {
          const plumeFeather = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.005, 0.04), pri);
          plumeFeather.position.set(0, 1.04 + i * 0.025, -0.12 + i * 0.02);
          g.add(plumeFeather);
        }
        const lanceShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.2, 8), wood);
        lanceShaft.position.set(0.36, 0.75, 0);
        lanceShaft.rotation.z = 0.08;
        g.add(lanceShaft);
        const lanceHead = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), metal);
        lanceHead.position.set(0.38, 1.38, 0);
        g.add(lanceHead);
        const lanceGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.04, 8), acc);
        lanceGuard.position.set(0.37, 1.28, 0);
        g.add(lanceGuard);
        const lanceGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), leather);
        lanceGrip.position.set(0.35, 0.5, 0);
        g.add(lanceGrip);
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
    const pri = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.5, metalness: 0.15 });
    const acc = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.25, metalness: 0.3 });
    const stoneLight = new THREE.MeshStandardMaterial({ color: 0xa8a8a0, roughness: 0.8 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x7a7a72, roughness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.75 });
    const roofTile = new THREE.MeshStandardMaterial({ color: 0xb85c38, roughness: 0.65 });

    const s = TILE_SIZE;

    switch (type) {
      case BuildingType.CITADEL: {
        const wallBase = new THREE.Mesh(new THREE.BoxGeometry(s * 2.8, 0.5, s * 2.8), stoneDark);
        wallBase.position.y = 0.25;
        wallBase.castShadow = true;
        g.add(wallBase);
        const baseStep = new THREE.Mesh(new THREE.BoxGeometry(s * 3.0, 0.15, s * 3.0), stoneDark);
        baseStep.position.y = 0.08;
        g.add(baseStep);

        const wallHeight = 1.8;
        const walls = [
          { x: 0, z: -s * 1.2, sx: s * 2.6, sz: 0.3 },
          { x: 0, z: s * 1.2, sx: s * 2.6, sz: 0.3 },
          { x: -s * 1.2, z: 0, sx: 0.3, sz: s * 2.4 },
          { x: s * 1.2, z: 0, sx: 0.3, sz: s * 2.4 },
        ];
        for (const w of walls) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w.sx, wallHeight, w.sz), stoneLight);
          wall.position.set(w.x, wallHeight / 2 + 0.5, w.z);
          wall.castShadow = true;
          g.add(wall);
          const wallTop = new THREE.Mesh(new THREE.BoxGeometry(w.sx + 0.05, 0.08, w.sz + 0.06), stoneLight);
          wallTop.position.set(w.x, wallHeight + 0.55, w.z);
          g.add(wallTop);
        }

        this.addBattlements(g, stoneLight, 0, wallHeight + 0.7, 0, s * 1.18, 20);

        const gate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.35), woodDark);
        gate.position.set(0, 0.95, s * 1.22);
        g.add(gate);
        const gateArch = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 12, 1, false, 0, Math.PI), stoneLight);
        gateArch.position.set(0, 1.45, s * 1.22);
        gateArch.rotation.x = Math.PI / 2;
        g.add(gateArch);
        const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.08), stoneLight);
        gateFrame.position.set(-0.28, 0.95, s * 1.25);
        g.add(gateFrame);
        const gateFrameR = gateFrame.clone();
        gateFrameR.position.x = 0.28;
        g.add(gateFrameR);

        const towerPositions = [
          [-s * 1.05, -s * 1.05], [s * 1.05, -s * 1.05],
          [-s * 1.05, s * 1.05], [s * 1.05, s * 1.05],
        ];
        for (const [tx, tz] of towerPositions) {
          const tBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.36, 0.5, 12), stoneDark);
          tBase.position.set(tx, 0.5, tz);
          g.add(tBase);
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.32, 3.2, 12), pri);
          tower.position.set(tx, 2.1, tz);
          tower.castShadow = true;
          g.add(tower);
          const towerRim = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.34, s * 0.3, 0.15, 12), stoneLight);
          towerRim.position.set(tx, 3.7, tz);
          g.add(towerRim);
          const towerTop = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35, 1.1, 12), acc);
          towerTop.position.set(tx, 4.3, tz);
          towerTop.castShadow = true;
          g.add(towerTop);
          const towerFinial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), acc);
          towerFinial.position.set(tx, 4.88, tz);
          g.add(towerFinial);
          this.addBattlements(g, stoneLight, tx, 3.85, tz, s * 0.32, 8);
          for (let wi = 0; wi < 3; wi++) {
            const wAngle = (wi / 3) * Math.PI * 2;
            const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.04), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            slit.position.set(tx + Math.cos(wAngle) * s * 0.3, 2.0 + wi * 0.6, tz + Math.sin(wAngle) * s * 0.3);
            slit.lookAt(new THREE.Vector3(tx, slit.position.y, tz));
            g.add(slit);
          }
        }

        const keep = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.42, s * 0.48, 3.5, 8), pri);
        keep.position.y = 2.35;
        keep.castShadow = true;
        g.add(keep);
        const keepBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.52, 0.3, 8), stoneLight);
        keepBase.position.y = 0.65;
        g.add(keepBase);
        for (let wy = 0; wy < 2; wy++) {
          for (let side = 0; side < 4; side++) {
            const angle = (side / 4) * Math.PI * 2 + 0.4;
            const winGlow = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 0.7 });
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.04), winGlow);
            win.position.set(Math.cos(angle) * s * 0.44, 1.8 + wy * 1.2, Math.sin(angle) * s * 0.44);
            win.lookAt(new THREE.Vector3(0, win.position.y, 0));
            g.add(win);
            const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.02), stoneLight);
            winFrame.position.copy(win.position);
            winFrame.lookAt(new THREE.Vector3(0, winFrame.position.y, 0));
            g.add(winFrame);
          }
        }
        const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.58, 1.6, 4), acc);
        keepRoof.position.y = 4.9;
        keepRoof.rotation.y = Math.PI / 4;
        keepRoof.castShadow = true;
        g.add(keepRoof);
        const roofEdge = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.48, s * 0.48, 0.08, 8), acc);
        roofEdge.position.y = 4.1;
        g.add(roofEdge);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.8, 6), stoneDark);
        pole.position.y = 6.5;
        g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshStandardMaterial({ color: colors.accent, side: THREE.DoubleSide }));
        flag.position.set(0.28, 7.1, 0);
        g.add(flag);

        const courtyard = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.9, s * 0.9, 0.02, 16), stoneDark);
        courtyard.position.y = 0.51;
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
        const tBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.42, 0.5, 12), stoneDark);
        tBase.position.y = 0.25;
        tBase.castShadow = true;
        g.add(tBase);
        const tBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.32, 2.8, 12), stoneLight);
        tBody.position.y = 1.9;
        tBody.castShadow = true;
        g.add(tBody);
        const band1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.31, s * 0.31, 0.06, 12), stoneDark);
        band1.position.y = 1.2;
        g.add(band1);
        const band2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, 0.06, 12), stoneDark);
        band2.position.y = 2.4;
        g.add(band2);
        const parapet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.33, 0.25, 12), stoneLight);
        parapet.position.y = 3.45;
        g.add(parapet);
        this.addBattlements(g, stoneLight, 0, 3.7, 0, s * 0.36, 10);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(s * 0.4, 1.3, 12), acc);
        roof.position.y = 4.35;
        roof.castShadow = true;
        g.add(roof);
        const roofFinial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), acc);
        roofFinial.position.y = 5.0;
        g.add(roofFinial);
        for (let i = 0; i < 4; i++) {
          const slitAngle = (i / 4) * Math.PI * 2;
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.04), new THREE.MeshStandardMaterial({ color: 0x222222 }));
          slit.position.set(Math.cos(slitAngle) * s * 0.3, 2.0, Math.sin(slitAngle) * s * 0.3);
          slit.lookAt(new THREE.Vector3(0, slit.position.y, 0));
          g.add(slit);
          const slit2 = slit.clone();
          slit2.position.y = 2.8;
          slit2.position.x = Math.cos(slitAngle + 0.4) * s * 0.3;
          slit2.position.z = Math.sin(slitAngle + 0.4) * s * 0.3;
          slit2.lookAt(new THREE.Vector3(0, slit2.position.y, 0));
          g.add(slit2);
        }
        const doorway = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.06), woodDark);
        doorway.position.set(0, 0.55, s * 0.33);
        g.add(doorway);
        const doorArch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8, 1, false, 0, Math.PI), stoneLight);
        doorArch.position.set(0, 0.82, s * 0.33);
        doorArch.rotation.x = Math.PI / 2;
        g.add(doorArch);
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
    const group = new THREE.Group();
    group.position.set(worldX, 0.1, worldZ);
    group.rotation.x = -Math.PI / 2;

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    group.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.18, 12),
      new THREE.MeshBasicMaterial({ color: 0x88ff88, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    group.add(innerRing);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
      );
      tick.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
      tick.rotation.z = angle;
      group.add(tick);
    }

    this.unitGroup.add(group);
    const markerRef = outerRing;
    this.moveMarkers.push(markerRef);
    markerRef.userData.parentGroup = group;

    setTimeout(() => {
      this.unitGroup.remove(group);
      this.moveMarkers = this.moveMarkers.filter((m) => m !== markerRef);
    }, 1500);
  }

  getTerrainHeight(x: number, z: number, tiles: { elevation: number }[][]): number {
    const tx = Math.max(0, Math.min(tiles.length - 1, Math.floor(x)));
    const tz = Math.max(0, Math.min((tiles[0]?.length || 1) - 1, Math.floor(z)));
    return (tiles[tx]?.[tz]?.elevation || 0.25) * 5.5;
  }

  updateUnits(units: Map<number, Unit>, selectedIds: Set<number>, t: number, camera?: THREE.Camera, tiles?: { elevation: number }[][]): void {
    if (camera) {
      this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }

    // Tick all animation mixers (dt ~16ms at 60fps)
    const dt = 0.016;
    for (const [id, mixer] of this.unitMixers) {
      mixer.update(dt);
    }

    for (const [id, unit] of units) {
      if (unit.state === UnitState.DEAD) {
        const vis = this.unitVisuals.get(id);
        if (vis) {
          this.unitGroup.remove(vis.group);
          this.unitVisuals.delete(id);
        }
        this.unitMixers.delete(id);
        this.unitActions.delete(id);
        this.unitCurrentAnim.delete(id);
        continue;
      }

      const vis = this.unitVisuals.get(id);
      if (!vis) continue;

      vis.group.position.x = unit.x * TILE_SIZE;
      vis.group.position.z = unit.z * TILE_SIZE;
      const groundY = tiles ? this.getTerrainHeight(unit.x, unit.z, tiles) : 0;
      vis.group.position.y = groundY;

      // Skip detailed animation updates for units outside the camera frustum
      if (camera) {
        this.tmpVec3.set(vis.group.position.x, vis.group.position.y, vis.group.position.z);
        if (!this.frustum.containsPoint(this.tmpVec3)) {
          vis.healthBar.visible = false;
          vis.healthBg.visible = false;
          vis.selectionRing.visible = false;
          continue;
        }
      }

      const isMoving = unit.state === UnitState.MOVING || unit.state === UnitState.RETURNING;
      const isAttacking = unit.state === UnitState.ATTACKING;
      const isGathering = unit.state === UnitState.GATHERING;
      const isBuilding = unit.state === UnitState.BUILDING;

      // Switch animation based on state
      let targetAnim = 'Idle';
      if (isMoving) targetAnim = 'Run';
      else if (isAttacking) targetAnim = 'Sword_Slash';
      else if (isGathering || isBuilding) targetAnim = 'Interact';

      const currentAnim = this.unitCurrentAnim.get(id);
      if (currentAnim !== targetAnim) {
        const actions = this.unitActions.get(id);
        if (actions) {
          const oldAction = actions.get(currentAnim || 'Idle');
          const newAction = actions.get(targetAnim) || actions.get('Idle');
          if (newAction) {
            if (oldAction) oldAction.fadeOut(0.2);
            newAction.reset().fadeIn(0.2).play();
            this.unitCurrentAnim.set(id, targetAnim);
          }
        }
      }

      // Subtle position offsets (no bobbing for GLB models — animation handles it)
      if (!this.unitActions.has(id)) {
        // Procedural fallback — keep the old bobbing
        if (isMoving) {
          vis.group.position.y = groundY + Math.sin(t * 10) * 0.06;
        } else if (isAttacking) {
          vis.group.position.y = groundY + Math.abs(Math.sin(t * 12)) * 0.08;
        } else if (isGathering || isBuilding) {
          if (vis.group.children[0]) vis.group.children[0].rotation.z = Math.sin(t * 6) * 0.12;
        } else {
          vis.group.position.y = groundY + Math.sin(t * 2 + id) * 0.015;
        }
      }

      let targetAngle: number | null = null;
      if (unit.path.length > 0 && unit.pathIndex < unit.path.length) {
        const target = unit.path[unit.pathIndex];
        targetAngle = Math.atan2(
          (target.x * TILE_SIZE) - vis.group.position.x,
          (target.z * TILE_SIZE) - vis.group.position.z
        );
      } else if (unit.attackTargetId) {
        const target = units.get(unit.attackTargetId);
        if (target) {
          targetAngle = Math.atan2(
            target.x * TILE_SIZE - vis.group.position.x,
            target.z * TILE_SIZE - vis.group.position.z
          );
        }
      }
      if (targetAngle !== null) {
        this.unitTargetRotation.set(id, targetAngle);
      }
      const desiredAngle = this.unitTargetRotation.get(id);
      if (desiredAngle !== undefined) {
        let diff = desiredAngle - vis.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        vis.group.rotation.y += diff * Math.min(1, 12 * 0.016);
      }

      const selected = selectedIds.has(id);
      vis.selectionRing.visible = selected;
      if (selected) {
        const pulse = 1.0 + Math.sin(t * 4) * 0.08;
        vis.selectionRing.scale.setScalar(pulse);
        (vis.selectionRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 3) * 0.2;
      }

      const hpRatio = unit.hp / unit.maxHp;
      const showHealth = selected || hpRatio < 1;
      vis.healthBar.visible = showHealth;
      vis.healthBg.visible = showHealth;
      if (showHealth) {
        vis.healthBar.scale.x = Math.max(0.01, hpRatio);
        (vis.healthBar.material as THREE.MeshBasicMaterial).color.setHex(
          hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444
        );
        if (camera) {
          vis.healthBar.quaternion.copy(camera.quaternion);
          vis.healthBg.quaternion.copy(camera.quaternion);
        }
      }
    }

    for (const marker of this.moveMarkers) {
      (marker.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 6) * 0.3;
      const parentGroup = marker.userData.parentGroup as THREE.Group | undefined;
      if (parentGroup) {
        parentGroup.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
        parentGroup.rotation.z = t * 1.5;
      } else {
        marker.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
      }
    }
  }

  updateBuildings(buildings: Map<number, Building>, selectedIds: Set<number>, t: number, tiles?: { elevation: number }[][], camera?: THREE.Camera): void {
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
      if (selected) {
        const pulse = 1.0 + Math.sin(t * 3.5) * 0.06;
        vis.selectionRing.scale.setScalar(pulse);
        (vis.selectionRing.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2.5) * 0.15;
      }

      if (!building.isComplete) {
        const prevProgress = this.lastBuildProgress.get(id) ?? -1;
        const currentProgress = building.buildProgress;
        if (currentProgress !== prevProgress) {
          this.lastBuildProgress.set(id, currentProgress);
          const progress = currentProgress / 100;
          const eased = progress * progress * (3 - 2 * progress);
          for (const child of vis.group.children) {
            if (child === vis.healthBar || child === vis.healthBg || child === vis.selectionRing) continue;
            child.scale.y = Math.max(0.05, eased);
            child.traverse((node) => {
              if (node instanceof THREE.Mesh) {
                const mat = node.material;
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.opacity = 0.4 + eased * 0.6;
                  mat.transparent = progress < 1;
                }
              }
            });
          }
        }
      } else {
        // Clean up tracking once building is complete
        this.lastBuildProgress.delete(id);
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
        if (camera) {
          vis.healthBar.quaternion.copy(camera.quaternion);
          vis.healthBg.quaternion.copy(camera.quaternion);
        }
      }
    }
  }

  removeEntity(id: number): void {
    const uVis = this.unitVisuals.get(id);
    if (uVis) {
      this.spawnDeathEffect(uVis.group.position.clone(), 0.5);
      this.unitGroup.remove(uVis.group);
      this.unitVisuals.delete(id);
      this.unitMixers.delete(id);
      this.unitActions.delete(id);
      this.unitCurrentAnim.delete(id);
    }
    const bVis = this.buildingVisuals.get(id);
    if (bVis) {
      this.spawnDeathEffect(bVis.group.position.clone(), 1.5);
      this.buildingGroup.remove(bVis.group);
      this.buildingVisuals.delete(id);
    }
  }

  private spawnDeathEffect(pos: THREE.Vector3, radius: number): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo = new THREE.SphereGeometry(size, 4, 3);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.8, 0.5 + Math.random() * 0.3),
        transparent: true,
        opacity: 0.9,
      });
      const particle = new THREE.Mesh(geo, mat);
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.0;
      particle.position.set(0, 0.3, 0);
      particle.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed * radius,
        1.5 + Math.random() * 2,
        Math.sin(angle) * speed * radius
      );
      group.add(particle);
    }
    this.unitGroup.add(group);
    this.deathEffects.push({ group, age: 0 });
  }

  spawnProjectile(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xddcc88 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    mesh.position.y += 1.5;
    mesh.lookAt(to.clone().setY(to.y + 0.8));
    this.unitGroup.add(mesh);
    this.projectiles.push({ mesh, target: to.clone().setY(to.y + 0.8), speed: 25, age: 0 });
  }

  updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.age += dt;
      const dir = proj.target.clone().sub(proj.mesh.position);
      const dist = dir.length();
      if (dist < 0.3 || proj.age > 2) {
        this.unitGroup.remove(proj.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      dir.normalize().multiplyScalar(proj.speed * dt);
      proj.mesh.position.add(dir);
      proj.mesh.lookAt(proj.target);
    }
  }

  updateDeathEffects(dt: number): void {
    for (let i = this.deathEffects.length - 1; i >= 0; i--) {
      const effect = this.deathEffects[i];
      effect.age += dt;
      if (effect.age > 1.2) {
        this.unitGroup.remove(effect.group);
        this.deathEffects.splice(i, 1);
        continue;
      }
      for (const child of effect.group.children) {
        const vel = child.userData.velocity as THREE.Vector3;
        if (!vel) continue;
        child.position.x += vel.x * dt;
        child.position.y += vel.y * dt;
        child.position.z += vel.z * dt;
        vel.y -= 6 * dt;
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - effect.age / 1.2);
      }
    }
  }

  showBuildGhost(
    type: BuildingType,
    tileX: number,
    tileZ: number,
    valid: boolean,
    tiles?: { elevation: number }[][]
  ): void {
    this.hideBuildGhost();

    const def = BUILDING_DEFS[type];
    const s = def.size * TILE_SIZE;
    const color = valid ? 0x00ff00 : 0xff0000;

    const ghostGroup = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(s * 0.92, 0.08, s * 0.92);
    const baseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.04;
    ghostGroup.add(baseMesh);

    const h = this.getBuildingHeight(type) * 0.6;
    const outlineGeo = new THREE.BoxGeometry(s * 0.85, h, s * 0.85);
    const edges = new THREE.EdgesGeometry(outlineGeo);
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.y = h / 2;
    ghostGroup.add(wireframe);

    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    const fillMesh = new THREE.Mesh(outlineGeo, fillMat);
    fillMesh.position.y = h / 2;
    ghostGroup.add(fillMesh);

    const groundY = tiles
      ? this.getTerrainHeight(tileX + def.size / 2, tileZ + def.size / 2, tiles)
      : 0;
    ghostGroup.position.set(
      (tileX + def.size / 2) * TILE_SIZE,
      groundY + 0.1,
      (tileZ + def.size / 2) * TILE_SIZE
    );

    const ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0), new THREE.MeshBasicMaterial());
    ghostMesh.visible = false;
    ghostGroup.add(ghostMesh);

    this.buildGhostMesh = ghostMesh;
    this.buildGhostMesh.userData.ghostGroup = ghostGroup;
    this.buildingGroup.add(ghostGroup);
  }

  hideBuildGhost(): void {
    if (this.buildGhostMesh) {
      const ghostGroup = this.buildGhostMesh.userData.ghostGroup as THREE.Group | undefined;
      if (ghostGroup) {
        this.buildingGroup.remove(ghostGroup);
      } else {
        this.buildingGroup.remove(this.buildGhostMesh);
      }
      this.buildGhostMesh = null;
    }
  }
}
