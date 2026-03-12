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
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 120);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 200);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.setupLighting();
    this.setupSky();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.6);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e6, 1.4);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6688cc, 0.3);
    fill.position.set(-20, 20, -10);
    this.scene.add(fill);
  }

  private setupSky(): void {
    const skyGeo = new THREE.SphereGeometry(100, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x4488cc) },
        bottomColor: { value: new THREE.Color(0xc8dde8) },
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
