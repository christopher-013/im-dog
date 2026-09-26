import { MOKE_REACTIONS } from '../../config/activities';
import type { Speech } from '../../core/GameEvents';
import type { Vec3Like } from '../../physics/CharacterBody';
import type { HumanIntent, HumanSenses } from '../HumanBrain';
import type { HumanPose } from '../HumanRig';
import type { HumanActivityController, ReactionLayer } from './HumanActivityController';

/** A short moment with Moke, on top of whatever they're doing. */
export type ReactionKind = 'look' | 'greet' | 'answerBark' | 'attend' | 'praise' | 'pet' | 'gesture';

type Tuning = typeof MOKE_REACTIONS;

const LINES = {
  greet: ['Hi, buddy.', 'Hey, Moke.', 'There you are.', 'Hello, fluffball.'],
  answerBark: ['Yes, Moke?', 'What is it?', 'I hear you…', 'Shh, buddy.'],
  attend: ['Okay, okay. What do you want?', 'Alright, you have my attention.', 'What\'s up, Moke?'],
  praise: ['Aww, good boy!', 'Look at you!', 'So clever!', 'Such a good trick!'],
  pet: ['Who\'s a good boy?', 'Good boy, Moke.', 'Aww, buddy.', 'So soft…'],
} as const;

const distance = (a: Vec3Like, b: Vec3Like) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * How the human responds to Moke while going about their day: lightweight awareness (how close he is, a bark,
 * a trick, what he's carrying) turned into short reactions: a look, a greeting, "yes, Moke?", praise, pats. Each
 * has a cooldown, lines are rare, and the activity underneath is only paused, never lost:
 * ACTIVITY → MOKE → RESPONSE → (a dog activity, maybe) → RESUME.
 */
export class HumanReactions implements ReactionLayer {
  kind: ReactionKind | null = null;
  private left = 0;
  private readonly cooldowns = new Map<ReactionKind, number>();
  private sinceLine = Infinity;
  private barks: number[] = [];
  private time = 0;
  private nearFor = 0;
  private awayFor = Infinity;
  private petRequested = false;
  private gesturePose: HumanPose = 'shoo';
  private gestureRequest: { pose: HumanPose; seconds: number; line: string | null } | null = null;
  /** Called when the human pets him (Moke's side: sit, lean in, wag). */
  onPet: (() => void) | null = null;

  constructor(
    private readonly random: () => number = Math.random,
    private readonly tuning: Tuning = MOKE_REACTIONS,
  ) {}

  /** Can Moke ask for pets right now (the "Get Pets" prompt)? */
  canPet(routine: HumanActivityController): boolean {
    return routine.available && this.kind !== 'pet' && this.ready('pet');
  }

  /** The player asked for pets (E near the human). */
  requestPet(): void {
    this.petRequested = true;
  }

  /** A quick gesture at Moke from wherever they are (a dismissive wave: "not now"), with an optional line. */
  perform(pose: HumanPose, seconds: number, line: string | null = null): void {
    this.gestureRequest = { pose, seconds, line };
  }

  /** Giving Moke their attention because he asked for it (barking at them until they gave in). */
  get engaged(): boolean {
    return this.kind === 'attend';
  }

  /** In the middle of something with Moke that shouldn't be cut short (a pat, a gesture). */
  get busy(): boolean {
    return this.kind === 'pet' || this.kind === 'gesture';
  }

  reset(): void {
    this.kind = null;
    this.left = 0;
    this.barks.length = 0;
    this.petRequested = false;
    this.nearFor = 0;
  }

  update(dt: number, s: HumanSenses, intent: HumanIntent, routine: HumanActivityController): 'look' | 'pose' | null {
    this.time += dt;
    this.sinceLine += dt;
    for (const [kind, t] of this.cooldowns) this.cooldowns.set(kind, t - dt);
    const t = this.tuning;
    const d = distance(s.position, s.moke);
    const sees = this.canSee(s, d);
    if (s.mokeBarked && d <= t.hearing) this.barks.push(this.time);
    this.barks = this.barks.filter((b) => this.time - b < t.barkWindow);
    this.nearFor = d < t.nearRange ? this.nearFor + dt : 0;
    this.awayFor = d > t.awayRange ? this.awayFor + dt : d < t.greetRange ? 0 : this.awayFor;

    // Something new to react to? (Stronger reactions win over the one running.)
    const gesture = this.gestureRequest;
    this.gestureRequest = null;
    if (gesture) {
      this.kind = 'gesture';
      this.gesturePose = gesture.pose;
      this.left = gesture.seconds;
      if (gesture.line) {
        intent.talking = 1.3;
        this.sinceLine = 0;
        this.say(gesture.line, 'neutral');
      }
    } else {
      const next = this.pick(s, d, sees, routine);
      if (next) this.begin(next, s, intent);
    }

    if (!this.kind) return null;
    this.left -= dt;
    if (this.left <= 0) {
      if (this.kind === 'pet') this.cooldowns.set('pet', t.cooldowns.pet);
      this.kind = null;
      return null;
    }
    intent.lookAt = s.moke;
    const pose = this.poseFor(this.kind, s);
    if (!pose) return 'look';
    intent.pose = pose;
    // Petting while standing: turn to him and get down to his level. Seated, they just lean.
    intent.crouch = this.kind === 'pet' && !s.seated ? 1 : 0;
    if (!s.seated && (this.kind === 'pet' || this.kind === 'attend' || this.kind === 'praise')) intent.face = s.moke;
    intent.prop = this.kind === 'pet' || this.kind === 'praise' ? null : intent.prop;
    return 'pose';
  }

  private pick(s: HumanSenses, d: number, sees: boolean, routine: HumanActivityController): ReactionKind | null {
    const t = this.tuning;
    const running = this.kind;
    if (this.petRequested) {
      this.petRequested = false;
      if (d <= t.petReach + 0.3) return 'pet';
    }
    if (running === 'pet' || running === 'gesture') return null;
    // A trick right in front of them.
    if (s.mokeTrick && sees && d < t.praiseRange && this.ready('praise')) return 'praise';
    // Barking: a look, a reply, and if he keeps at it, their attention.
    if (s.mokeBarked && d <= t.hearing) {
      const interruptible = routine.activity?.interruptible ?? 'always';
      const willing = interruptible === 'always' || (interruptible === 'sometimes' && this.random() < 0.6);
      if (this.barks.length >= t.barksToAttend && d < t.attendRange && willing && this.ready('attend')) return 'attend';
      if (running !== 'attend' && this.ready('answerBark')) return 'answerBark';
    }
    if (running) return null;
    // He's back after a while away: hello.
    if (sees && d < t.greetRange && this.awayFor > t.greetAfterAway && this.ready('greet')) return 'greet';
    // Sitting close by, leaning on them: a spontaneous pat.
    if (s.seated && d < t.petReach && this.nearFor > t.spontaneousPetAfter && (s.mokeLying || s.moke.y > 0.25 || this.nearFor > t.spontaneousPetAfter * 2) && this.ready('pet')) return 'pet';
    // Just noticed him nearby: a glance.
    if (sees && d < t.lookRange && this.ready('look')) return 'look';
    return null;
  }

  private begin(kind: ReactionKind, s: HumanSenses, intent: HumanIntent): void {
    const t = this.tuning;
    this.kind = kind;
    this.left = t.durations[kind];
    if (kind !== 'pet') this.cooldowns.set(kind, t.cooldowns[kind]);
    if (kind === 'attend') this.barks.length = 0;
    if (kind === 'greet') this.awayFor = 0;
    if (kind === 'pet') this.onPet?.();
    const lines = kind === 'look' || kind === 'gesture' ? null : LINES[kind];
    const chance = kind === 'attend' || kind === 'pet' ? 0.85 : kind === 'praise' ? 0.8 : t.lineChance;
    if (lines && this.sinceLine > t.lineGap && this.random() < chance) {
      this.sinceLine = 0;
      const mood: Speech['mood'] = kind === 'answerBark' ? 'neutral' : 'happy';
      intent.talking = 1.3;
      this.say(lines[Math.floor(this.random() * lines.length)]!, mood);
    }
    void s;
  }

  /** Set by the routine to emit speech (keeps this class free of the event hub). */
  say: (text: string, mood: Speech['mood']) => void = () => {};

  private poseFor(kind: ReactionKind, s: HumanSenses): HumanPose | null {
    switch (kind) {
      case 'gesture':
        return this.gesturePose;
      case 'pet':
        return 'pet';
      case 'praise':
        return s.seated ? null : 'cheer';
      case 'attend':
        return s.seated ? null : 'call';
      default:
        return null;
    }
  }

  private ready(kind: ReactionKind): boolean {
    return (this.cooldowns.get(kind) ?? 0) <= 0;
  }

  /** In front of them and near enough (their full sight rules live in the brain; this is just for reactions). */
  private canSee(s: HumanSenses, d: number): boolean {
    if (d < 1.0) return true;
    if (d > this.tuning.lookRange + 2) return false;
    const toward = Math.atan2(s.moke.x - s.position.x, s.moke.z - s.position.z);
    let off = toward - s.heading;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    return Math.abs(off) < 1.3 && s.clear({ x: s.position.x, y: s.position.y + 1.2, z: s.position.z }, { x: s.moke.x, y: s.moke.y + 0.3, z: s.moke.z });
  }
}
