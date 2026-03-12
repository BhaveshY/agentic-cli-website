import * as THREE from 'three';
import { MAP_SIZE, TILE_SIZE } from '../config';

export class SceneSetup {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly raycaster = new THREE.Raycaster();

  private clock = new THREE.Clock();
  private animCallbacks: Array<(dt: number, t: number) => void> = [];

  cameraTarget = new THREE.Vector3(MAP_SIZE / 2 * TILE_SIZE, 0, MAP_SIZE / 2 * TILE_SIZE);
  cameraDistance = 22;
  cameraAngle = -Math.PI / 4;
  cameraPitch = Math.PI / 3;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7ec8e3);
    this.scene.fog = new THREE.Fog(0x9ad4e8, 50, 110);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.setupLighting();
    this.setupSky();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x5a8a3c, 0.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(25, 45, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 130;
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -65;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88aadd, 0.4);
    fill.position.set(-25, 15, -15);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd4a0, 0.25);
    rim.position.set(-10, 8, 30);
    this.scene.add(rim);
  }

  private setupSky(): void {
    const skyGeo = new THREE.SphereGeometry(100, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x3b7ec8) },
        bottomColor: { value: new THREE.Color(0xd4e8f0) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  updateCameraPosition(): void {
    const x = this.cameraTarget.x + Math.sin(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const y = this.cameraTarget.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const z = this.cameraTarget.z + Math.cos(this.cameraAngle) * Math.cos(this.cameraPitch) * this.cameraDistance;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  onAnimate(cb: (dt: number, t: number) => void): void {
    this.animCallbacks.push(cb);
  }

  start(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.getElapsedTime();

      for (const cb of this.animCallbacks) cb(dt, t);

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  getWorldPositionFromMouse(mx: number, my: number, groundPlane: THREE.Plane): THREE.Vector3 | null {
    const ndc = new THREE.Vector2(
      (mx / window.innerWidth) * 2 - 1,
      -(my / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(groundPlane, intersection);
    return hit ? intersection : null;
  }

  screenToNDC(mx: number, my: number): THREE.Vector2 {
    return new THREE.Vector2(
      (mx / window.innerWidth) * 2 - 1,
      -(my / window.innerHeight) * 2 + 1
    );
  }
}
