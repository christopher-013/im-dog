import type { Prop } from '../props/Prop';
import type { LivingRoom } from '../world/LivingRoom';
import type { ScentCategory, ScentSource } from './ScentSystem';

const PROP_SCENTS: Record<string, { category: ScentCategory; strength: number; radius: number }> = {
  // The sock smells the most interesting of all.
  sock: { category: 'SOCK', strength: 1, radius: 5 },
  toy: { category: 'TOY', strength: 0.85, radius: 4 },
  ball: { category: 'TOY', strength: 0.6, radius: 3.5 },
};

/** The living room's scent sources: the loose props (not while in his mouth) and his bed. */
export function createRoomScents(room: LivingRoom, props: readonly Prop[]): ScentSource[] {
  const sources: ScentSource[] = props.map((prop) => {
    const scent = PROP_SCENTS[prop.id] ?? { category: 'INTERESTING', strength: 0.5, radius: 3 };
    return {
      id: `prop:${prop.id}`,
      label: prop.name,
      ...scent,
      get position() {
        return prop.position;
      },
      get enabled() {
        return !prop.carried;
      },
    };
  });
  sources.push({
    id: 'dogBed',
    category: 'INTERESTING',
    label: 'Dog Bed',
    position: room.landmarks.dogBed,
    strength: 0.7,
    radius: 4.5,
    enabled: true,
  });
  return sources;
}
