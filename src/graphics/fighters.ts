import * as THREE from 'three';
import { COLORS } from '../constants';
import { PlayerSide, ActionType } from '../types';

interface FighterParts {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  glow: THREE.PointLight;
  shield?: THREE.Mesh;
  aura: THREE.Points;
}

export class FighterRenderer {
  readonly humanGroup = new THREE.Group();
  readonly aiGroup = new THREE.Group();

  private human!: FighterParts;
  private ai!: FighterParts;
  private animationState: {
    human: { action: ActionType | null; progress: number };
    ai: { action: ActionType | null; progress: number };
  } = {
    human: { action: null, progress: 0 },
    ai: { action: null, progress: 0 },
  };

  constructor() {
    this.human = this.createFighter(PlayerSide.HUMAN);
    this.ai = this.createFighter(PlayerSide.AI);

    this.humanGroup.add(this.human.group);
    this.humanGroup.position.set(-4, 0, 0);

    this.aiGroup.add(this.ai.group);
    this.aiGroup.position.set(4, 0, 0);
    this.aiGroup.rotation.y = Math.PI;
  }

  private createFighter(side: PlayerSide): FighterParts {
    const group = new THREE.Group();
    const primary = side === PlayerSide.HUMAN ? COLORS.humanPrimary : COLORS.aiPrimary;
    const secondary = side === PlayerSide.HUMAN ? COLORS.humanSecondary : COLORS.aiSecondary;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: secondary,
      metalness: 0.6,
      roughness: 0.3,
      emissive: primary,
      emissiveIntensity: 0.15,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.1,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), bodyMat);
    body.position.y = 2.4;
    body.castShadow = true;
    group.add(body);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.85), accentMat);
    chestPlate.position.y = 2.7;
    group.add(chestPlate);

    const head = new THREE.Mesh(
      side === PlayerSide.HUMAN
        ? new THREE.BoxGeometry(0.7, 0.7, 0.7)
        : new THREE.OctahedronGeometry(0.45, 1),
      accentMat
    );
    head.position.y = 3.6;
    head.castShadow = true;
    group.add(head);

    if (side === PlayerSide.AI) {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.15, 0.5),
        new THREE.MeshStandardMaterial({
          color: 0xff0000,
          emissive: 0xff0000,
          emissiveIntensity: 1.0,
        })
      );
      visor.position.y = 3.65;
      visor.position.z = 0.15;
      group.add(visor);
    } else {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.1),
        new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 1.0,
        })
      );
      visor.position.y = 3.65;
      visor.position.z = 0.35;
      group.add(visor);
    }

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), bodyMat);
    leftArm.position.set(-0.9, 2.3, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), bodyMat);
    rightArm.position.set(0.9, 2.3, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    const fistMat = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: 0.3,
    });
    const leftFist = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), fistMat);
    leftFist.position.set(-0.9, 1.5, 0);
    group.add(leftFist);

    const rightFist = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), fistMat);
    rightFist.position.set(0.9, 1.5, 0);
    group.add(rightFist);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), bodyMat);
    leftLeg.position.set(-0.35, 0.6, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), bodyMat);
    rightLeg.position.set(0.35, 0.6, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const bootMat = accentMat.clone();
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.55), bootMat);
    leftBoot.position.set(-0.35, 0.15, 0.05);
    group.add(leftBoot);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.55), bootMat);
    rightBoot.position.set(0.35, 0.15, 0.05);
    group.add(rightBoot);

    const glow = new THREE.PointLight(primary, 1.5, 8);
    glow.position.y = 2.5;
    group.add(glow);

    const auraCount = 60;
    const auraPositions = new Float32Array(auraCount * 3);
    for (let i = 0; i < auraCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 0.5;
      auraPositions[i * 3] = Math.cos(angle) * r;
      auraPositions[i * 3 + 1] = 1 + Math.random() * 3;
      auraPositions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const auraGeo = new THREE.BufferGeometry();
    auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
    const auraMat = new THREE.PointsMaterial({
      color: primary,
      size: 0.1,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    const aura = new THREE.Points(auraGeo, auraMat);
    group.add(aura);

    return { group, body, head, leftArm, rightArm, leftLeg, rightLeg, glow, aura };
  }

  playActionAnimation(side: PlayerSide, action: ActionType): void {
    const state = side === PlayerSide.HUMAN ? this.animationState.human : this.animationState.ai;
    state.action = action;
    state.progress = 0;
  }

  resetPose(): void {
    this.animationState.human = { action: null, progress: 0 };
    this.animationState.ai = { action: null, progress: 0 };
  }

  update(elapsed: number, dt: number): void {
    this.idleAnimation(this.human, elapsed, 0);
    this.idleAnimation(this.ai, elapsed, Math.PI);

    this.updateActionAnimation(this.human, this.humanGroup, this.animationState.human, dt, 1);
    this.updateActionAnimation(this.ai, this.aiGroup, this.animationState.ai, dt, -1);

    this.updateAura(this.human, elapsed, 0);
    this.updateAura(this.ai, elapsed, 1.5);
  }

  private idleAnimation(fighter: FighterParts, elapsed: number, offset: number): void {
    const bob = Math.sin(elapsed * 2 + offset) * 0.05;
    fighter.body.position.y = 2.4 + bob;
    fighter.head.position.y = 3.6 + bob;

    fighter.leftArm.rotation.x = Math.sin(elapsed * 1.5 + offset) * 0.1;
    fighter.rightArm.rotation.x = Math.sin(elapsed * 1.5 + offset + Math.PI) * 0.1;
  }

  private updateActionAnimation(
    fighter: FighterParts,
    parentGroup: THREE.Group,
    state: { action: ActionType | null; progress: number },
    dt: number,
    direction: number
  ): void {
    if (!state.action) return;

    state.progress += dt * 2.5;
    const t = Math.min(state.progress, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    switch (state.action) {
      case ActionType.STRIKE:
        parentGroup.position.z = -direction * ease * 2 * (t < 0.5 ? t * 2 : 2 - t * 2);
        fighter.rightArm.rotation.x = -ease * 1.5 * (t < 0.5 ? t * 2 : 2 - t * 2);
        break;
      case ActionType.BLAST:
        fighter.rightArm.rotation.x = -ease * Math.PI / 2;
        fighter.rightArm.rotation.z = direction * ease * 0.5;
        fighter.leftArm.rotation.x = -ease * Math.PI / 2;
        fighter.leftArm.rotation.z = -direction * ease * 0.5;
        break;
      case ActionType.SHIELD:
        fighter.leftArm.rotation.x = -ease * Math.PI / 3;
        fighter.leftArm.rotation.z = -direction * ease * 0.8;
        fighter.rightArm.rotation.x = -ease * Math.PI / 3;
        fighter.rightArm.rotation.z = direction * ease * 0.2;
        break;
      case ActionType.DODGE:
        parentGroup.position.x += direction * ease * 1.5 * (t < 0.5 ? t * 2 : 2 - t * 2);
        parentGroup.position.y = ease * 1 * (t < 0.5 ? t * 2 : 2 - t * 2);
        break;
      case ActionType.CHARGE:
        fighter.body.scale.y = 1 + ease * 0.1;
        fighter.glow.intensity = 1.5 + ease * 3;
        break;
      case ActionType.SURGE:
        parentGroup.position.z = -direction * ease * 3 * (t < 0.5 ? t * 2 : 2 - t * 2);
        fighter.rightArm.rotation.x = -ease * Math.PI;
        fighter.glow.intensity = 1.5 + ease * 5;
        break;
    }

    if (t >= 1) {
      state.action = null;
      state.progress = 0;
      parentGroup.position.set(
        direction === 1 ? -4 : 4,
        0,
        0
      );
      fighter.body.scale.y = 1;
      fighter.glow.intensity = 1.5;
      fighter.leftArm.rotation.set(0, 0, 0);
      fighter.rightArm.rotation.set(0, 0, 0);
    }
  }

  private updateAura(fighter: FighterParts, elapsed: number, offset: number): void {
    const positions = fighter.aura.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i);
      y += 0.02;
      if (y > 4) y = 1;
      positions.setY(i, y);

      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setX(i, x + Math.sin(elapsed * 2 + i + offset) * 0.005);
      positions.setZ(i, z + Math.cos(elapsed * 2 + i + offset) * 0.005);
    }
    positions.needsUpdate = true;
  }

  flashDamage(side: PlayerSide): void {
    const fighter = side === PlayerSide.HUMAN ? this.human : this.ai;
    const originalColor = (fighter.body.material as THREE.MeshStandardMaterial).emissive.clone();

    (fighter.body.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0000);
    (fighter.head.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0000);

    setTimeout(() => {
      (fighter.body.material as THREE.MeshStandardMaterial).emissive.copy(originalColor);
      (fighter.head.material as THREE.MeshStandardMaterial).emissive.copy(originalColor);
    }, 200);
  }
}
