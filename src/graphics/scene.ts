import * as THREE from 'three';
import { COLORS } from '../constants';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private clock = new THREE.Clock();
  private shakeIntensity = 0;
  private shakeDecay = 0.92;
  private originalCameraPos = new THREE.Vector3();
  private animationCallbacks: Array<(dt: number, elapsed: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.FogExp2(COLORS.background, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 1, 0);
    this.originalCameraPos.copy(this.camera.position);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.setupLighting();
    this.setupResizeHandler();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x222244, 0.6);
    this.scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);

    const cyanPoint = new THREE.PointLight(COLORS.neonCyan, 2, 30);
    cyanPoint.position.set(-6, 5, -3);
    this.scene.add(cyanPoint);

    const magentaPoint = new THREE.PointLight(COLORS.neonMagenta, 2, 30);
    magentaPoint.position.set(6, 5, -3);
    this.scene.add(magentaPoint);

    const purpleSpot = new THREE.SpotLight(COLORS.neonPurple, 1.5, 25, Math.PI / 6);
    purpleSpot.position.set(0, 12, 0);
    purpleSpot.target.position.set(0, 0, 0);
    this.scene.add(purpleSpot);
    this.scene.add(purpleSpot.target);
  }

  private setupResizeHandler(): void {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
  }

  onAnimate(callback: (dt: number, elapsed: number) => void): void {
    this.animationCallbacks.push(callback);
  }

  triggerScreenShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  setCameraForBattle(): void {
    this.animateCameraTo(new THREE.Vector3(0, 8, 14), new THREE.Vector3(0, 1, 0), 1000);
  }

  setCameraForMenu(): void {
    this.animateCameraTo(new THREE.Vector3(0, 12, 20), new THREE.Vector3(0, 2, 0), 1500);
  }

  setCameraForClash(): void {
    this.animateCameraTo(new THREE.Vector3(0, 5, 8), new THREE.Vector3(0, 2, 0), 500);
  }

  private animateCameraTo(
    targetPos: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number
  ): void {
    const startPos = this.camera.position.clone();
    const startTime = this.clock.getElapsedTime();

    const animate = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const t = Math.min(elapsed / (duration / 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.camera.lookAt(lookAt);
      this.originalCameraPos.copy(this.camera.position);

      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  start(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      if (this.shakeIntensity > 0.01) {
        this.camera.position.x =
          this.originalCameraPos.x + (Math.random() - 0.5) * this.shakeIntensity;
        this.camera.position.y =
          this.originalCameraPos.y + (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeIntensity *= this.shakeDecay;
      } else {
        this.shakeIntensity = 0;
        this.camera.position.copy(this.originalCameraPos);
      }

      for (const cb of this.animationCallbacks) {
        cb(dt, elapsed);
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
