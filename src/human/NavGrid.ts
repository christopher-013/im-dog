import type { StaticBox } from '../physics/PhysicsWorld';

export interface Point2 {
  x: number;
  z: number;
}

export interface NavGridOptions {
  /** World area covered (m). Outside it is unwalkable. */
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  /** Cell size (m). */
  readonly cell: number;
  /** The walker's radius: obstacles are grown by it, so a path is clear for the whole body. */
  readonly agentRadius: number;
  /** Only obstacles overlapping this height band block (a rug doesn't; a tabletop at knee height does). */
  readonly minY: number;
  readonly maxY: number;
}

const SQRT2 = Math.SQRT2;

/** Something in the way just now (Moke standing in a doorway): a circle to route round, for one search. */
export interface NavAvoid {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/**
 * A walkability grid over the floor, built once from the room's static colliders, with A* paths smoothed into
 * a few straight legs. Plain logic (no three.js or Rapier), so it's cheap and testable. Because obstacles are
 * grown by the walker's radius, gaps narrower than the walker simply don't exist for it: the human can't
 * follow Moke under the coffee table or through dog-sized gaps.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  // A* scratch (reused: no allocation per query beyond the returned path).
  private readonly gScore: Float32Array;
  private readonly cameFrom: Int32Array;
  private readonly state: Uint8Array; // 0 unseen, 1 open, 2 closed
  private readonly heap: Int32Array;
  private readonly fScore: Float32Array;
  /** The temporary obstacle for the current search (see findPath). */
  private avoid: NavAvoid | null = null;

  constructor(
    boxes: readonly StaticBox[],
    private readonly options: NavGridOptions,
  ) {
    const { bounds, cell } = options;
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.gScore = new Float32Array(n);
    this.fScore = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.state = new Uint8Array(n);
    this.heap = new Int32Array(n);
    for (const box of boxes) this.stamp(box);
  }

  /** Is the walker's centre allowed here? */
  isWalkable(x: number, z: number): boolean {
    const i = this.index(x, z);
    return i >= 0 && this.blocked[i] === 0 && !this.avoided(x, z);
  }

  private avoided(x: number, z: number): boolean {
    const a = this.avoid;
    return a !== null && Math.hypot(x - a.x, z - a.z) < a.r;
  }

  /** The walkable point nearest (x, z), searching outwards up to `maxRadius` (m), or null. */
  nearestWalkable(x: number, z: number, maxRadius = 1.5): Point2 | null {
    if (this.isWalkable(x, z)) return { x, z };
    const { cell } = this.options;
    const rings = Math.ceil(maxRadius / cell);
    const c0 = this.col(x);
    const r0 = this.row(z);
    let best: Point2 | null = null;
    let bestDistance = Infinity;
    for (let ring = 1; ring <= rings && !best; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!this.open(c, r)) continue;
          const p = this.center(c, r);
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < bestDistance) {
            bestDistance = d;
            best = p;
          }
        }
      }
    }
    return best;
  }

  /**
   * A smoothed path from `from` to `to` (both snapped to the nearest walkable point), written into `out` as
   * waypoints after the start, ending at the goal. Returns false (and leaves `out` empty) if unreachable.
   */
  findPath(from: Point2, to: Point2, out: Point2[], avoid: NavAvoid | null = null): boolean {
    this.avoid = avoid;
    try {
      return this.search2(from, to, out);
    } finally {
      this.avoid = null;
    }
  }

  private search2(from: Point2, to: Point2, out: Point2[]): boolean {
    out.length = 0;
    const start = this.nearestWalkable(from.x, from.z);
    const goal = this.nearestWalkable(to.x, to.z);
    if (!start || !goal) return false;
    // Starting off the walkable area (squeezed against something, or inside what to avoid): step out first.
    const offStart = Math.hypot(start.x - from.x, start.z - from.z) > this.options.cell * 0.75;
    if (this.lineOfSight(start, goal)) {
      if (offStart) out.push(start);
      out.push(goal);
      return true;
    }
    const s = this.index(start.x, start.z);
    const g = this.index(goal.x, goal.z);
    if (!this.search(s, g)) return false;

    // Walk back from the goal, then string-pull: keep only the corners needed to stay clear.
    const cells: number[] = [];
    for (let i = g; i !== s; i = this.cameFrom[i]!) cells.push(i);
    cells.reverse();
    const points = cells.map((i) => this.center(i % this.cols, Math.floor(i / this.cols)));
    points[points.length - 1] = goal;
    if (offStart) out.push(start);
    let anchor: Point2 = start;
    let k = 0;
    while (k < points.length) {
      let far = k;
      for (let j = points.length - 1; j > k; j--) {
        if (this.lineOfSight(anchor, points[j]!)) {
          far = j;
          break;
        }
      }
      out.push(points[far]!);
      anchor = points[far]!;
      k = far + 1;
    }
    return true;
  }

  /** Can the walker go straight from a to b? (Samples the grid along the segment.) */
  lineOfSight(a: Point2, b: Point2): boolean {
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(distance / (this.options.cell * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  private search(start: number, goal: number): boolean {
    const { cols } = this;
    this.state.fill(0);
    const gc = goal % cols;
    const gr = Math.floor(goal / cols);
    const h = (i: number) => {
      const dc = Math.abs((i % cols) - gc);
      const dr = Math.abs(Math.floor(i / cols) - gr);
      return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
    };
    let size = 0;
    const push = (i: number) => {
      let at = size++;
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (this.fScore[this.heap[parent]!]! <= this.fScore[i]!) break;
        this.heap[at] = this.heap[parent]!;
        at = parent;
      }
      this.heap[at] = i;
    };
    const pop = (): number => {
      const top = this.heap[0]!;
      const last = this.heap[--size]!;
      let at = 0;
      for (;;) {
        let child = 2 * at + 1;
        if (child >= size) break;
        if (child + 1 < size && this.fScore[this.heap[child + 1]!]! < this.fScore[this.heap[child]!]!) child++;
        if (this.fScore[last]! <= this.fScore[this.heap[child]!]!) break;
        this.heap[at] = this.heap[child]!;
        at = child;
      }
      this.heap[at] = last;
      return top;
    };

    this.gScore[start] = 0;
    this.fScore[start] = h(start);
    this.state[start] = 1;
    push(start);
    while (size > 0) {
      const current = pop();
      if (this.state[current] === 2) continue;
      if (current === goal) return true;
      this.state[current] = 2;
      const c = current % cols;
      const r = Math.floor(current / cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.open(nc, nr)) continue;
          // No cutting corners past an obstacle.
          if (dr !== 0 && dc !== 0 && (!this.open(c + dc, r) || !this.open(c, r + dr))) continue;
          const next = nr * cols + nc;
          if (this.state[next] === 2) continue;
          const tentative = this.gScore[current]! + (dr !== 0 && dc !== 0 ? SQRT2 : 1);
          if (this.state[next] === 1 && tentative >= this.gScore[next]!) continue;
          this.gScore[next] = tentative;
          this.fScore[next] = tentative + h(next);
          this.cameFrom[next] = current;
          this.state[next] = 1;
          push(next);
        }
      }
    }
    return false;
  }

  /** Blocks every cell whose centre is within the walker's radius of the box's footprint. */
  private stamp(box: StaticBox): void {
    const { minY, maxY, agentRadius: radius } = this.options;
    const [cx, cy, cz] = box.center;
    const [hx, hy, hz] = box.halfExtents;
    if (cy + hy < minY || cy - hy > maxY) return;
    const [qx, qy, qz, qw] = box.rotation;
    let yaw = 0;
    let ex = hx;
    let ez = hz;
    if (Math.abs(qx) > 1e-3 || Math.abs(qz) > 1e-3) {
      // Tilted part: use its (conservative) world-space bounding rectangle.
      const corners = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => rotate([sx * hx, sy * hy, sz * hz], [qx, qy, qz, qw]))));
      ex = Math.max(...corners.map((p) => Math.abs(p[0])));
      ez = Math.max(...corners.map((p) => Math.abs(p[2])));
    } else {
      yaw = 2 * Math.atan2(qy, qw);
    }
    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    const reach = Math.hypot(ex, ez) + radius;
    const c0 = Math.max(0, this.col(cx - reach));
    const c1 = Math.min(this.cols - 1, this.col(cx + reach));
    const r0 = Math.max(0, this.row(cz - reach));
    const r1 = Math.min(this.rows - 1, this.row(cz + reach));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const p = this.center(c, r);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const lx = dx * cos + dz * sin;
        const lz = -dx * sin + dz * cos;
        const out = Math.hypot(Math.max(Math.abs(lx) - ex, 0), Math.max(Math.abs(lz) - ez, 0));
        if (out <= radius) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  private open(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows || this.blocked[r * this.cols + c] !== 0) return false;
    if (!this.avoid) return true;
    const p = this.center(c, r);
    return !this.avoided(p.x, p.z);
  }

  private col(x: number): number {
    return Math.floor((x - this.options.bounds.minX) / this.options.cell);
  }

  private row(z: number): number {
    return Math.floor((z - this.options.bounds.minZ) / this.options.cell);
  }

  private index(x: number, z: number): number {
    const c = this.col(x);
    const r = this.row(z);
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows ? r * this.cols + c : -1;
  }

  private center(c: number, r: number): Point2 {
    const { bounds, cell } = this.options;
    return { x: bounds.minX + (c + 0.5) * cell, z: bounds.minZ + (r + 0.5) * cell };
  }
}

/** Rotates vector v by unit quaternion q. */
function rotate(v: readonly [number, number, number], q: readonly [number, number, number, number]): [number, number, number] {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}
