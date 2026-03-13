import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { UnitType } from '../types';

export type ModelKey = UnitType | string;

const MODEL_MANIFEST: Record<string, string> = {
  [UnitType.WORKER]: '/models/units/worker.glb',
  [UnitType.SWORDSMAN]: '/models/units/swordsman.glb',
  [UnitType.ARCHER]: '/models/units/archer.glb',
  [UnitType.KNIGHT]: '/models/units/knight.glb',
};

const cache = new Map<string, THREE.Group>();
const animCache = new Map<string, THREE.AnimationClip[]>();
const loader = new GLTFLoader();

export async function preloadAllModels(
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const entries = Object.entries(MODEL_MANIFEST);
  let loaded = 0;

  await Promise.all(
    entries.map(async ([key, path]) => {
      try {
        const gltf = await loader.loadAsync(path);
        const model = gltf.scene;

        // Replace materials with MeshLambertMaterial for performance + correct rendering
        // (Edelweiss pattern: keep only .map texture, replace everything else)
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const oldMat = child.material as THREE.MeshStandardMaterial;
            if (oldMat && oldMat.map) {
              oldMat.map.colorSpace = THREE.SRGBColorSpace;
              const newMat = new THREE.MeshLambertMaterial({
                map: oldMat.map,
                side: THREE.DoubleSide,
              });
              child.material = newMat;
            } else if (oldMat && oldMat.color) {
              child.material = new THREE.MeshLambertMaterial({
                color: oldMat.color,
                side: THREE.DoubleSide,
              });
            }
          }
        });

        cache.set(key, model);
        if (gltf.animations.length > 0) {
          animCache.set(key, gltf.animations);
        }
        const animNames = gltf.animations.map(a => a.name);
        console.log(`[Asset] ${key}: meshes=${countMeshes(model)}, anims=[${animNames.join(', ')}]`);
      } catch (err) {
        console.warn(`[Asset] Failed to load ${key} from ${path}:`, err);
      }
      loaded++;
      onProgress?.(loaded, entries.length);
    })
  );
}

function countMeshes(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((c) => { if (c instanceof THREE.Mesh) count++; });
  return count;
}

export function getModel(key: ModelKey): THREE.Group | null {
  const cached = cache.get(key);
  if (!cached) return null;
  // Use SkeletonUtils clone for proper skinned mesh cloning
  return skeletonClone(cached) as THREE.Group;
}

export function getAnimations(key: ModelKey): THREE.AnimationClip[] {
  return animCache.get(key) || [];
}

export function hasModel(key: ModelKey): boolean {
  return cache.has(key);
}

export function applyFactionTint(
  model: THREE.Group,
  factionColor: { primary: number; secondary: number; accent: number }
): void {
  const tintColor = new THREE.Color(factionColor.primary);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material;
      if (mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshStandardMaterial) {
        child.material = mat.clone();
        (child.material as THREE.MeshLambertMaterial).color.lerp(tintColor, 0.15);
      }
    }
  });
}

export function computeModelBounds(model: THREE.Group): THREE.Vector3 {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  return box.getSize(new THREE.Vector3());
}

export function normalizeModelScale(model: THREE.Group, targetHeight: number): void {
  model.updateMatrixWorld(true);
  const size = computeModelBounds(model);
  if (size.y > 0) {
    const scale = targetHeight / size.y;
    model.scale.multiplyScalar(scale);
  }
}

export function centerModelAtBase(model: THREE.Group): void {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}
