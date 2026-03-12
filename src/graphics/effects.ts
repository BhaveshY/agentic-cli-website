import * as THREE from 'three';
import { COLORS } from '../constants';
import { ActionType, PlayerSide } from '../types';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

interface Trail {
  points: THREE.Points;
  life: number;
}

export class VFXSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private trails: Trail[] = [];
  private pool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.prewarmPool(100);
  }

  private prewarmPool(count: number): void {
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push(mesh);
    }
  }

  private getParticleMesh(): THREE.Mesh {
    const available = this.pool.find((p) => !p.visible);
    if (available) {
      available.visible = true;
      return available;
    }
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
    this.pool.push(mesh);
    return mesh;
  }

  spawnActionEffect(action: ActionType, side: PlayerSide): void {
    const xDir = side === PlayerSide.HUMAN ? 1 : -1;
    const origin = new THREE.Vector3(xDir * -4, 2.5, 0);

    switch (action) {
      case ActionType.STRIKE:
        this.spawnSlashEffect(origin, xDir);
        break;
      case ActionType.BLAST:
        this.spawnBlastEffect(origin, xDir);
        break;
      case ActionType.SHIELD:
        this.spawnShieldEffect(origin);
        break;
      case ActionType.DODGE:
        this.spawnDodgeEffect(origin, xDir);
        break;
      case ActionType.CHARGE:
        this.spawnChargeEffect(origin);
        break;
      case ActionType.SURGE:
        this.spawnSurgeEffect(origin, xDir);
        break;
    }
  }

  private spawnSlashEffect(origin: THREE.Vector3, xDir: number): void {
    for (let i = 0; i < 20; i++) {
      this.addParticle(
        origin.clone().add(new THREE.Vector3(Math.random() * 0.5, Math.random() * 0.5, 0)),
        new THREE.Vector3(xDir * (2 + Math.random() * 3), Math.random() - 0.5, (Math.random() - 0.5) * 2),
        COLORS.humanPrimary,
        0.5 + Math.random() * 0.3,
        0
      );
    }
  }

  private spawnBlastEffect(origin: THREE.Vector3, xDir: number): void {
    const target = new THREE.Vector3(xDir * 4, 2.5, 0);
    const count = 30;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = origin.clone().lerp(target, t).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        )
      );
      setTimeout(() => {
        this.addParticle(
          pos,
          new THREE.Vector3(xDir * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
          0xffa94d,
          0.4 + Math.random() * 0.2,
          -0.5
        );
      }, t * 200);
    }
  }

  private spawnShieldEffect(origin: THREE.Vector3): void {
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const r = 1.2;
      this.addParticle(
        origin.clone().add(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0)),
        new THREE.Vector3(Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, (Math.random() - 0.5) * 0.3),
        COLORS.neonCyan,
        0.8 + Math.random() * 0.3,
        0
      );
    }
  }

  private spawnDodgeEffect(origin: THREE.Vector3, xDir: number): void {
    for (let i = 0; i < 15; i++) {
      this.addParticle(
        origin.clone(),
        new THREE.Vector3(xDir * (1 + Math.random()), Math.random() * 2, (Math.random() - 0.5) * 3),
        0xa78bfa,
        0.3 + Math.random() * 0.2,
        0
      );
    }
  }

  private spawnChargeEffect(origin: THREE.Vector3): void {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 2;
      const startPos = origin.clone().add(new THREE.Vector3(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 3,
        Math.sin(angle) * r
      ));
      const vel = origin.clone().sub(startPos).normalize().multiplyScalar(3);
      this.addParticle(startPos, vel, COLORS.energy, 0.6 + Math.random() * 0.3, 0);
    }
  }

  private spawnSurgeEffect(origin: THREE.Vector3, xDir: number): void {
    for (let i = 0; i < 50; i++) {
      const spread = (Math.random() - 0.5) * 1.5;
      this.addParticle(
        origin.clone().add(new THREE.Vector3(0, spread, spread)),
        new THREE.Vector3(xDir * (4 + Math.random() * 4), (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
        0xe599f7,
        0.6 + Math.random() * 0.3,
        0
      );
    }

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.addParticle(
        origin.clone(),
        new THREE.Vector3(
          Math.cos(angle) * (2 + Math.random() * 3),
          Math.sin(angle) * (2 + Math.random() * 3),
          (Math.random() - 0.5) * 4
        ),
        COLORS.neonMagenta,
        0.4 + Math.random() * 0.4,
        -1
      );
    }
  }

  spawnHitEffect(position: THREE.Vector3): void {
    for (let i = 0; i < 25; i++) {
      this.addParticle(
        position.clone(),
        new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 4,
          (Math.random() - 0.5) * 6
        ),
        COLORS.damage,
        0.4 + Math.random() * 0.3,
        -3
      );
    }
  }

  spawnVictoryEffect(position: THREE.Vector3, color: number): void {
    for (let wave = 0; wave < 5; wave++) {
      setTimeout(() => {
        for (let i = 0; i < 40; i++) {
          const angle = (i / 40) * Math.PI * 2;
          const speed = 3 + Math.random() * 3;
          this.addParticle(
            position.clone().add(new THREE.Vector3(0, wave * 0.5, 0)),
            new THREE.Vector3(
              Math.cos(angle) * speed,
              2 + Math.random() * 4,
              Math.sin(angle) * speed
            ),
            color,
            1 + Math.random() * 0.5,
            -2
          );
        }
      }, wave * 300);
    }
  }

  private addParticle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: number,
    maxLife: number,
    gravity: number
  ): void {
    const mesh = this.getParticleMesh();
    mesh.position.copy(position);
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 1;

    this.particles.push({ mesh, velocity, life: 0, maxLife, gravity });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const lifeRatio = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio;
      const scale = 0.5 + lifeRatio * 0.5;
      p.mesh.scale.set(scale, scale, scale);
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.life -= dt;
      if (trail.life <= 0) {
        this.scene.remove(trail.points);
        trail.points.geometry.dispose();
        (trail.points.material as THREE.Material).dispose();
        this.trails.splice(i, 1);
      }
    }
  }
}
