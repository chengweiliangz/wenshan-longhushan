import * as THREE from 'three';

export const SERIF_STACK = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, serif';

/** Waits for the display serif so the giant 3D lettering never bakes a fallback font. Gives up after `timeout`. */
export async function loadDisplayFont(timeout = 2500) {
  if (!document.fonts?.load) return false;
  try {
    const result = await Promise.race([
      document.fonts.load(`600 200px "Noto Serif SC"`, '问山龙虎'),
      new Promise<never[]>(resolve => setTimeout(() => resolve([]), timeout)),
    ]);
    return result.length > 0;
  } catch { return false; }
}

/**
 * Giant 「问山」 lettering standing in the valley. It is an aria-hidden decoration rendered inside the scene,
 * so foreground bamboo truly passes in front of it while mountains stay behind.
 */
export function createBrandText(maxAnisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f6f1e4';
  ctx.textBaseline = 'middle';
  ctx.font = `600 860px ${SERIF_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('问', 40, 540);
  ctx.textAlign = 'right';
  ctx.fillText('山', 2010, 540);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = true;
  // Depth is written only where letters are (alphaTest), so mist and motes behind the glyphs stay behind them.
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.04, depthWrite: true, fog: false, opacity: 0.92, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), material);
  mesh.renderOrder = 3;
  return mesh;
}
