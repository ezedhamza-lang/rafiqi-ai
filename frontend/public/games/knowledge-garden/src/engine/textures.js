/**
 * لوحات النصوص ثلاثية الأبعاد — canvas-based text sprites.
 *
 * Arabic glyphs are rendered with a real font stack and the canvas is drawn in
 * RTL mode, so letters and words appear correctly shaped inside the 3D world.
 * The texture cache is keyed by content + colours, which keeps repeated
 * decorations from re-uploading textures every level.
 */
import * as THREE from '../../vendor/three.module.js';

const FONT_STACK = '"Noto Sans Arabic", "Tajawal", "Segoe UI", Tahoma, sans-serif';
const cache = new Map();

/**
 * Build (or reuse) a sprite showing `text`.
 * @param {string} text   Arabic letter, word or short label
 * @param {number} bg     background colour (use 0x00000000-ish for none)
 * @param {number} fg     text colour
 * @param {number} px     font size in px
 * @param {number} pad    padding around the glyphs
 */
export function textSprite(text, bg, fg, px = 160, pad = 16) {
  const key = `${text}|${bg}|${fg}|${px}|${pad}`;
  const hit = cache.get(key);
  if (hit) return hit.clone();

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `bold ${px}px ${FONT_STACK}`;
  const w = Math.max(64, Math.ceil(measure.measureText(text).width) + pad * 2);
  const h = Math.ceil(px * 1.5) + pad * 2;

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');

  // Rounded plate behind the text so it stays readable over any scenery.
  if (bg !== null) {
    const r = Math.min(28, h / 2);
    ctx.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
    ctx.fill();
  }

  ctx.font = `bold ${px}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillStyle = `#${fg.toString(16).padStart(6, '0')}`;
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false
  }));
  // Preserve the aspect ratio of the rendered text.
  sprite.scale.set(w / h, 1, 1);
  sprite.userData.aspect = w / h;
  cache.set(key, sprite);
  return sprite.clone();
}

/** Free every cached texture (called when a level is torn down). */
export function clearTextCache() {
  for (const sprite of cache.values()) {
    sprite.material?.map?.dispose?.();
    sprite.material?.dispose?.();
  }
  cache.clear();
}

/**
 * Ground shadow blob under a character or object.
 * A cheap fake shadow reads better than a real shadow map at this art style.
 */
export function makeShadow(radius = 2) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  // Soft and light: a contact shadow, not a dark hole in the ground.
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.3;
  return mesh;
}
