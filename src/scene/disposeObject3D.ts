import * as THREE from 'three';

/** Owns discarded roots belonging to one LandscapeScene, not global/cached assets.
 * WeakSets make repeat calls and resources shared across that owner's roots safe.
 * Only standard geometry/material texture references and explicit extra textures
 * are owned; userData, uniforms and unrelated close/dispose-shaped objects are not.
 */
export function createObject3DDisposer() {
  const releasedGeometry = new WeakSet<THREE.BufferGeometry>();
  const releasedMaterial = new WeakSet<THREE.Material>();
  const releasedTexture = new WeakSet<THREE.Texture>();
  const closedBitmap = new WeakSet<ImageBitmap>();
  return (root: THREE.Object3D | null | undefined, extraTextures: readonly THREE.Texture[] = []) => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>(), bitmaps = new Set<ImageBitmap>();
    if (root instanceof THREE.Object3D) root.traverse(object => {
      const geometry = Object.getOwnPropertyDescriptor(object, 'geometry')?.value;
      const reference = Object.getOwnPropertyDescriptor(object, 'material')?.value;
      if (geometry instanceof THREE.BufferGeometry) geometries.add(geometry);
      for (const material of Array.isArray(reference) ? reference : reference ? [reference] : []) {
        if (!(material instanceof THREE.Material)) continue;
        materials.add(material);
        for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(material))) {
          if (descriptor.value instanceof THREE.Texture) textures.add(descriptor.value);
        }
      }
    });
    for (const texture of Array.isArray(extraTextures) ? extraTextures : []) if (texture instanceof THREE.Texture) textures.add(texture);
    for (const texture of textures) {
      if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
    }
    const count = { geometries: 0, materials: 0, textures: 0, bitmaps: 0 };
    for (const geometry of geometries) if (!releasedGeometry.has(geometry)) {
      releasedGeometry.add(geometry); geometry.dispose(); count.geometries++;
    }
    for (const material of materials) if (!releasedMaterial.has(material)) {
      releasedMaterial.add(material); material.dispose(); count.materials++;
    }
    for (const texture of textures) if (!releasedTexture.has(texture)) {
      releasedTexture.add(texture); texture.dispose(); count.textures++;
    }
    for (const bitmap of bitmaps) if (!closedBitmap.has(bitmap)) {
      closedBitmap.add(bitmap); bitmap.close(); count.bitmaps++;
    }
    return count;
  };
}
