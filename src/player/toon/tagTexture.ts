import { CanvasTexture, SRGBColorSpace } from 'three';
import type { CollarLook } from '../../config/dogLooks';
import { MOKE_LOOK } from '../../config/mokeLook';

const FONT = '"Fredoka Variable", Fredoka, ui-rounded, "Arial Rounded MT Bold", sans-serif';

/**
 * The name engraved on the dog's collar tag ("Moke", "Dougie"), drawn on a transparent canvas to lay over the tag.
 * Redrawn once the game's rounded font has loaded, in case it wasn't ready yet. Null without a DOM (tests).
 */
export function tagNameTexture(collar: CollarLook = MOKE_LOOK.collar): CanvasTexture | null {
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
    const { name, text } = collar;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // A longer name ("Dougie") is set a little smaller so it fits the tag; "Moke" stays at full size.
    let size = 76;
    ctx.font = `700 ${size}px ${FONT}`;
    while (size > 36 && ctx.measureText(name).width > el.width - 20) {
      size -= 4;
      ctx.font = `700 ${size}px ${FONT}`;
    }
    ctx.fillText(name, el.width / 2, el.height / 2 + 4);
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load(`700 76px ${FONT}`).then(draw, () => {});
  return texture;
}
