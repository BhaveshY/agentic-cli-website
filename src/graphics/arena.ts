import * as THREE from 'three';
import { COLORS } from '../constants';

export class Arena {
  readonly group = new THREE.Group();
  private gridLines: THREE.LineSegments;
  private rings: THREE.Mesh[] = [];
  private floatingGems: THREE.Mesh[] = [];
  private pillars: THREE.Mesh[] = [];

  constructor() {
    this.gridLines = this.createGrid();
    this.buildArena();
  }

  private buildArena(): void {
    const floorGeo = new THREE.CylinderGeometry(12, 12, 0.3, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.arenaFloor,
      metalness: 0.7,
      roughness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.group.add(floor);

    const rimGeo = new THREE.TorusGeometry(12, 0.15, 8, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: COLORS.neonPurple,
      emissive: COLORS.neonPurple,
      emissiveIntensity: 0.5,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    this.group.add(rim);

    this.group.add(this.gridLines);

    for (let i = 0; i < 3; i++) {
      const radius = 4 + i * 3;
      const ringGeo = new THREE.TorusGeometry(radius, 0.04, 6, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: COLORS.neonCyan,
        emissive: COLORS.neonCyan,
        emissiveIntensity: 0.3 - i * 0.08,
        transparent: true,
        opacity: 0.5 - i * 0.1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.createPillars();
    this.createFloatingGems();
    this.createParticleField();
  }

  private createGrid(): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const size = 11;
    const divisions = 22;
    const step = (size * 2) / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -size + i * step;
      points.push(new THREE.Vector3(pos, 0.02, -size));
      points.push(new THREE.Vector3(pos, 0.02, size));
      points.push(new THREE.Vector3(-size, 0.02, pos));
      points.push(new THREE.Vector3(size, 0.02, pos));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: COLORS.gridLine,
      transparent: true,
      opacity: 0.25,
    });
    return new THREE.LineSegments(geometry, material);
  }

  private createPillars(): void {
    const pillarCount = 6;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const radius = 10;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const pillarGeo = new THREE.BoxGeometry(0.4, 5, 0.4);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a5e,
        metalness: 0.8,
        roughness: 0.2,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 2.5, z);
      pillar.castShadow = true;
      this.pillars.push(pillar);
      this.group.add(pillar);

      const topGeo = new THREE.OctahedronGeometry(0.3, 0);
      const topMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? COLORS.neonCyan : COLORS.neonMagenta,
        emissive: i % 2 === 0 ? COLORS.neonCyan : COLORS.neonMagenta,
        emissiveIntensity: 0.8,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(x, 5.3, z);
      this.floatingGems.push(top);
      this.group.add(top);
    }
  }

  private createFloatingGems(): void {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 14 + Math.random() * 6;
      const y = 3 + Math.random() * 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const shapes = [
        new THREE.TetrahedronGeometry(0.2 + Math.random() * 0.3, 0),
        new THREE.OctahedronGeometry(0.15 + Math.random() * 0.2, 0),
        new THREE.IcosahedronGeometry(0.15 + Math.random() * 0.15, 0),
      ];
      const geo = shapes[Math.floor(Math.random() * shapes.length)];
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.neonPurple,
        emissive: COLORS.neonPurple,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.6,
      });
      const gem = new THREE.Mesh(geo, mat);
      gem.position.set(x, y, z);
      this.floatingGems.push(gem);
      this.group.add(gem);
    }
  }

  private createParticleField(): void {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: COLORS.neonPurple,
      size: 0.08,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(geo, mat);
    this.group.add(particles);
  }

  update(elapsed: number): void {
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].rotation.z = elapsed * 0.1 * (i % 2 === 0 ? 1 : -1);
    }

    for (let i = 0; i < this.floatingGems.length; i++) {
      const gem = this.floatingGems[i];
      gem.rotation.x = elapsed * 0.5 + i;
      gem.rotation.y = elapsed * 0.3 + i * 0.7;
      gem.position.y += Math.sin(elapsed * 0.8 + i * 1.3) * 0.003;
    }
  }
}
