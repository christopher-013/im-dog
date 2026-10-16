import type { Action } from '../config/input';

/** The screens the game can be on (mirrors `Game`'s state). */
export type MenuState = 'loading' | 'menu' | 'select' | 'playing' | 'paused';
export type MenuCommand = 'pause' | 'resume' | 'play' | 'closeControls' | 'begin' | 'back' | 'prevDog' | 'nextDog' | null;

/**
 * What this frame's pause/confirm presses mean. Only the controller drives menus through here (Start, A):
 * with a keyboard, the focused button already answers Enter/Space and Esc closes the Controls dialog natively,
 * so handling those keys here too would, say, start the game from the CONTROLS button, or resume it when Esc
 * was only meant to close the dialog (or had just released the mouse).
 *
 * Choose Your Dog (`select`) is the exception for left/right and back: the arrow keys (or A/D), the D-pad and the
 * shoulder buttons move between the dogs, and Esc or B goes back to the title, since no button answers those.
 * Begin is still the focused BEGIN button on a keyboard, and A or Start on a controller.
 */
export function menuCommand(state: MenuState, pressed: (action: Action) => boolean, controlsOpen: boolean): MenuCommand {
  if (controlsOpen) return pressed('menuConfirm') || pressed('resume') ? 'closeControls' : null;
  if (state === 'playing') return pressed('pause') ? 'pause' : null;
  if (state === 'paused') return pressed('resume') || pressed('menuConfirm') ? 'resume' : null;
  if (state === 'menu') return pressed('menuConfirm') ? 'play' : null;
  if (state === 'select') {
    if (pressed('menuBack')) return 'back';
    if (pressed('menuConfirm') || pressed('resume')) return 'begin';
    if (pressed('menuPrev')) return 'prevDog';
    if (pressed('menuNext')) return 'nextDog';
  }
  return null;
}
