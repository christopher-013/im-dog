import { CanvasTexture, SRGBColorSpace } from 'three';
import { MOKE_LOOK } from '../../config/mokeLook';

const FONT = '"Fredoka Variable", Fredoka, ui-rounded, "Arial Rounded MT Bold", sans-serif';

/**
 * The name engraved on his collar tag ("Moke"), drawn on a transparent canvas to lay over the tag.
 * Redrawn once the game's rounded font has loaded, in case it wasn't ready yet. Null without a DOM (tests).
 */
export function tagNameTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('canvas');
  el.width = 256;
  el.height = 128;
  const ctx = el.getContext('2d');
  if (!ctx) return null;
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  const draw = () => {
    const { name, text } = MOKE_LOOK.collar;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 76px ${FONT}`;
    ctx.fillText(name, el.width / 2, el.height / 2 + 4);
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load(`700 76px ${FONT}`).then(draw, () => {});
  return texture;
}
