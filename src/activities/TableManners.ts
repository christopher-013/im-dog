import { MISCHIEF, MISCHIEF_TABLES, onSurface, type MischiefSurface } from '../config/mischief';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { NavGrid } from '../human/NavGrid';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

/** Walk to a table's perimeter, remind Moke periodically, then wait on hips until he gets off. */
export class TableManners extends DogActivity {
  readonly id = 'tableManners' as const;
  readonly name = 'Moke, Get Down';
  readonly needsHuman = true;
  private nearby: MischiefSurface | null = null;
  private table: MischiefSurface | null = null;
  private ignored: string | null = null;
  private standing = false;
  private elapsed = 0;
  private reminderLeft = 0;
  private reminderIndex = 0;
  private approach: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly role: HumanRole = { id: 'tableManners', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: { routine: HumanActivityController; nav: NavGrid; grounded(): boolean; random?: () => number }) { super(MISCHIEF.tableCooldown); }
  override get objective(): string | null { return this.running ? 'Moke, get down! Jump or walk off the table.' : null; }
  protected wants(): boolean { return !!this.nearby && this.nearby.id !== this.ignored; }

  override update(dt: number, ctx: DogActivityContext): void {
    this.nearby = this.deps.grounded() ? MISCHIEF_TABLES.find((t) => onSurface(ctx.moke.position, t)) ?? null : null;
    if (this.ignored && !MISCHIEF_TABLES.some((t) => t.id === this.ignored && this.stillOn(ctx.moke.position, t))) this.ignored = null;
    if (this.running && this.table && !this.stillOn(ctx.moke.position, this.table)) {
      this.deps.routine.say('Thank you, Moke.', 'neutral');
      this.table = null; this.succeed();
    }
    super.update(dt, ctx);
  }

  protected onStart(ctx: DogActivityContext): void {
    if (!this.deps.routine.claim(this.role)) { this.enter('AVAILABLE'); return; }
    this.table = this.nearby; this.standing = false; this.elapsed = 0; this.reminderIndex = 0; this.reminderLeft = 0;
    const t = this.table!;
    const gap = MISCHIEF.approachGap;
    const points = [
      { x: t.x - t.halfX - gap, z: t.z }, { x: t.x + t.halfX + gap, z: t.z },
      { x: t.x, z: t.z - t.halfZ - gap }, { x: t.x, z: t.z + t.halfZ + gap },
    ].map((p) => ({ ...p, y: 0 })).filter((p) => this.deps.nav.isWalkable(p.x, p.z))
      .sort((a, b) => flatDistance(a, ctx.human.position) - flatDistance(b, ctx.human.position));
    if (!points.length) { this.cancel(); return; }
    this.approach = { ...points[0]!, y: 0 };
  }
  protected onUpdate(): void {}
  protected onCancel(): void { this.ignored = this.table?.id ?? null; this.table = null; this.standing = false; this.reminderLeft = 0; }
  resetAll(): void { this.cancel(); this.onCancel(); this.ignored = null; this.nearby = null; this.enter('AVAILABLE'); }

  private drive(dt: number, s: HumanSenses, i: HumanIntent): boolean {
    if (!this.running || !this.table) return false;
    this.elapsed += dt;
    if (!this.standing) {
      walkTo(i, this.approach, undefined, 0.12);
      if (s.arrived && flatDistance(s.position, this.approach) < 0.3) {
        this.standing = true; this.activate();
        this.sayReminder(i);
        this.reminderLeft = this.reminderDelay();
      } else if (this.elapsed > MISCHIEF.walkTimeout || (s.stuck ?? 0) > MISCHIEF.stuckTimeout) { this.cancel(); return false; }
    }
    if (this.standing) {
      hold(i, 'handsOnHips', s.moke, 0, s.moke); i.lookWeight = 1;
      this.reminderLeft -= dt;
      if (this.reminderLeft <= 0) {
        this.sayReminder(i);
        this.reminderLeft += this.reminderDelay();
      }
    }
    return true;
  }

  private sayReminder(intent: HumanIntent): void {
    const lines = MISCHIEF.tableReminders;
    this.deps.routine.say(lines[this.reminderIndex % lines.length]!, 'calling', intent);
    this.reminderIndex++;
  }

  private reminderDelay(): number {
    const [min, max] = MISCHIEF.tableReminderEvery;
    return min + (this.deps.random ?? Math.random)() * (max - min);
  }

  private stillOn(at: Vec3Like, t: MischiefSurface): boolean {
    return Math.abs(at.x - t.x) <= t.halfX + MISCHIEF.edgeTolerance && Math.abs(at.z - t.z) <= t.halfZ + MISCHIEF.edgeTolerance
      && at.y >= t.height - MISCHIEF.surfaceTolerance;
  }
}
