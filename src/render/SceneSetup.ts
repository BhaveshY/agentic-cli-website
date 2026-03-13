import * as THREE from 'three';
import { MAP_SIZE, TILE_SIZE } from '../config';

export class SceneSetup {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly raycaster = new THREE.Raycaster();

  private clock = new THREE.Clock();
  private animCallbacks: Array<(dt: number, t: number) => void> = [];
  private skyMaterial: THREE.ShaderMaterial | null = null;

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
    const hemi = new THREE.HemisphereLight(0x9dc4ff, 0x5a8a3c, 0.85);
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

    const fill = new THREE.DirectionalLight(0x88aadd, 0.5);
    fill.position.set(-25, 15, -15);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd4a0, 0.25);
    rim.position.set(-10, 8, 30);
    this.scene.add(rim);
  }

  private setupSky(): void {
    const skyGeo = new THREE.SphereGeometry(100, 64, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x1a5cb0) },
        midColor: { value: new THREE.Color(0x6baed6) },
        bottomColor: { value: new THREE.Color(0xe8d5b8) },
        sunDirection: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
        sunColor: { value: new THREE.Color(0xffeecc) },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(wp.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        uniform float time;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float val = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            val += amp * noise(p);
            p *= 2.1;
            amp *= 0.5;
          }
          return val;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;

          vec3 sky = mix(bottomColor, midColor, smoothstep(-0.05, 0.3, h));
          sky = mix(sky, topColor, smoothstep(0.3, 0.8, h));

          float sunDot = dot(dir, sunDirection);
          float sunDisc = smoothstep(0.9975, 0.999, sunDot);
          float sunGlow = pow(max(sunDot, 0.0), 8.0) * 0.35;
          float sunHalo = pow(max(sunDot, 0.0), 32.0) * 0.5;
          sky += sunColor * (sunGlow + sunHalo);
          sky = mix(sky, sunColor * 1.2, sunDisc);

          float horizonGlow = pow(1.0 - abs(h), 5.0) * 0.15;
          sky += vec3(1.0, 0.85, 0.6) * horizonGlow;

          vec2 cloudUV = dir.xz / (h + 0.1) * 1.8;
          float drift = time * 0.008;
          float clouds = fbm(cloudUV + drift);
          clouds = smoothstep(0.42, 0.72, clouds);
          float cloudShadow = fbm(cloudUV * 1.5 + drift * 0.7 + 3.0);
          cloudShadow = smoothstep(0.4, 0.7, cloudShadow);
          vec3 cloudColor = mix(vec3(0.95, 0.95, 0.98), sunColor * 0.9, max(sunDot, 0.0) * 0.4);
          vec3 cloudShade = cloudColor * 0.65;
          vec3 cloudFinal = mix(cloudShade, cloudColor, 1.0 - cloudShadow * 0.4);
          float cloudMask = clouds * smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.6, 0.9, h));
          sky = mix(sky, cloudFinal, cloudMask * 0.75);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyMaterial = skyMat;
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

      if (this.skyMaterial) {
        this.skyMaterial.uniforms.time.value = t;
      }

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
