import { HEIST_LINES, type HeistLine } from '../config/heist';
import { HUMAN } from '../config/human';
import type { GameEvents, Speech } from '../core/GameEvents';
import type { Vec3Like } from '../physics/CharacterBody';
import { angleDelta, clamp, damp, lerp } from '../utils/math';
import { canHear, canSee, type ClearSight } from './HumanAwareness';
import type { HumanPose, HumanProp, HumanSitStyle } from './HumanRig';

export type { HumanPose } from './HumanRig';

/** Every state the human can be in (Sock Heist). Shown in the debug panel. */
export const HUMAN_STATES = [
  'idle', // folding laundry, glancing round now and then
  'noticed', // "Moke! Is that my sock?!"
  'chase', // hurrying after him
  'lunge', // a grab that always fumbles
  'recover', // after the fumble
  'search', // lost him: look where he was last seen
  'giveUp', // "Okay. New plan."
  'getTreat', // to the treat jar
  'offerTreat', // walking over with the treat
  'waitForTrade', // kneeling, treat held out
  'receiveSock', // got the sock back
  'reward', // treat on the floor for him
  'fetchSock', // picking up a sock he dropped
  'returnSock', // back into the laundry basket
] as const;
export type HumanStateName = (typeof HUMAN_STATES)[number];


/** What the human perceives this step. Built by the game from Moke, the props and physics. */
export interface HumanSenses {
  readonly position: Vec3Like;
  readonly heading: number;
  /** Their body reached the last goal (or can't get any closer). */
  readonly arrived: boolean;
  /** Sitting down (on a sofa, a chair, a stool). */
  readonly seated?: boolean;
  /** Seconds walking without getting any closer (a blocked path). */
  readonly stuck?: number;
  readonly moke: Vec3Like;
  readonly mokeCarryingSock: boolean;
  /** His ground speed (m/s): a sprinting dog is past before they can grab. */
  readonly mokeSpeed: number;
  /** Under the coffee table (or similar): out of arm's reach. */
  readonly mokeUnderFurniture: boolean;
  readonly mokeBarked: boolean;
  /** The sock, when it's lying loose (in nobody's mouth or hand). */
  readonly looseSock: Vec3Like | null;
  readonly clear: ClearSight;
  /** What Moke has in his mouth (a prop id), if anything. */
  readonly mokeCarrying?: string | null;
  /** He's doing a trick right now (begging, offering a paw…). */
  readonly mokeTrick?: boolean;
  /** He's lying down (in a bed, on a sofa). */
  readonly mokeLying?: boolean;
}

/**
 * What the human does when the Sock Heist doesn't need them: their daily routine (HumanActivityController). The
 * brain keeps watching for a dog with a sock; the moment it notices, it interrupts the routine, and resumes it
 * after the heist settles down.
 */
export interface HumanIdleDriver {
  /** Runs the idle behaviour for this step: fills in the intent; returns the head turn to aim for (rad). */
  drive(dt: number, s: HumanSenses, intent: HumanIntent): number;
  /** The heist needs the human: drop everything (and remember it). */
  interrupt(): void;
  /** Back to idle after the heist: pick things up again. */
  resume(s: HumanSenses): void;
  /** A replay: start again at the laundry. */
  reset(): void;
}

export interface HumanPlaces {
  /** Where they fold laundry, and the basket they face. */
  readonly home: Vec3Like;
  readonly basket: Vec3Like;
  /** Where they stand to get a treat, and the jar. */
  readonly treatStand: Vec3Like;
  readonly treatJar: Vec3Like;
}

/** What the human's hands do in the world (the Sock Heist implements it: props, treat, visuals). */
export interface HumanHands {
  takeTreat(): void;
  /** Picks up the loose sock if it's within reach. */
  pickUpSock(): boolean;
  putSockAway(): void;
  placeTreat(at: Vec3Like): void;
}

/** A seat to sit on: where the hips go, how high, how (the body walks to `goal` first, facing `facing`). */
export interface SeatSpec {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly style: HumanSitStyle;
  readonly facing: number;
}

/** What the brain wants the body and visual to do. */
export interface HumanIntent {
  /** Walk here (pathfinding), or null to stay put. */
  goal: Vec3Like | null;
  speed: number;
  /** Close enough to the goal (m). */
  stopWithin: number;
  /** Turn to face this point (null keeps the heading). */
  face: Vec3Like | null;
  /** Head turn relative to the body (rad). */
  headYaw: number;
  /** 0 standing … 1 kneeling. */
  crouch: number;
  pose: HumanPose;
  /** Sit here once at `goal` (null: stand, getting up first if seated). */
  seat: SeatSpec | null;
  /** Something in hand for the activity. */
  prop: HumanProp | null;
  /** Something to look at (their eyes follow it; the head helps). */
  lookAt: Vec3Like | null;
  /**
   * How much of them turns to it: 0.3 a glance (eyes and a little head), 0.6 interested (head and neck), 1 full
   * attention (the upper body helps). Unset: 0.6. The animation eases between weights; it never snaps.
   */
  lookWeight?: number;
  /** Something the right hand should reach (petting Moke, holding out a treat). */
  reach?: Vec3Like | null;
  /** The height of the work surface in front of them (a counter, a table), for kitchen and table actions (m). */
  surface?: number;
  /** Seconds of speaking left (the mouth moves). */
  talking: number;
  /** Something small and alive to walk round if it's in the way (Moke). Set by the game, not the brain. */
  avoid?: Vec3Like | null;
}

type Tuning = typeof HUMAN;
type Handler = (dt: number, s: HumanSenses) => HumanStateName | null;

const ROOM_CENTER: Vec3Like = { x: 0.3, y: 0, z: 0.2 };
/** How long the mouth moves for one line (s). */
export const TALK_TIME = 1.3;
/** How far they can reach down for a sock without taking a step (m). */
const REACH = 0.8;
const distance = (a: Vec3Like, b: Vec3Like) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The human's behaviour during Sock Heist: an explicit state machine, one handler per state, pure logic.
 * It decides what to do from what it perceives (HumanSenses) and says so through `intent`, speech and
 * gameplay events; the body (HumanController), the look (HumanVisual) and the items (HumanHands) are
 * someone else's job. It never catches Moke and never punishes him: chasing just gets more frustrating
 * until a treat looks like the better idea.
 */
export class HumanBrain {
  state: HumanStateName = 'idle';
  timeInState = 0;
  private stepsInState = 0;
  /** Grows while chasing (and with every fumble or escape); at the limit they change strategy. */
  frustration = 0;
  hasTreat = false;
  hasSock = false;
  /** Did they see Moke this step? */
  seesMoke = false;
  readonly intent: HumanIntent = { goal: null, speed: 0, stopWithin: 0.15, face: null, headYaw: 0, crouch: 0, pose: 'fold', seat: null, prop: null, lookAt: null, talking: 0 };
  /** The daily routine, when there is one (Phase 4). Without it, idle is folding laundry at `places.home`. */
  driver: HumanIdleDriver | null = null;
  private lastSenses: HumanSenses | null = null;

  private readonly lastSeen: Vec3Like = { x: 0, y: 0, z: 0 };
  private seenFor = 0;
  private unseenFor = 0;
  private timesNoticed = 0;
  private headYawTarget = 0;
  private glanceIn: number;
  private glanceLeft = 0;
  private grabCooldown = 0;
  private cantReachCooldown = 0;
  private lookingFor = 0;
  private callIn = 0;
  private awayFor = 0;
  private saidSockFirst = false;
  private offered = false;
  /** The sock was dropped right by them while they knelt with the treat (a trade, not a fetch). */
  private droppedForTrade = false;
  /** How long a sock has been lying loose while they wait with the treat. */
  private looseFor = 0;
  /** Which line of each set comes next. */
  private readonly lineTurn = new Map<HeistLine, number>();
  private readonly handlers: Record<HumanStateName, Handler>;

  constructor(
    private readonly places: HumanPlaces,
    private readonly hands: HumanHands,
    private readonly events: GameEvents,
    private readonly random: () => number = Math.random,
    private readonly tuning: Tuning = HUMAN,
  ) {
    this.glanceIn = this.nextGlance();
    this.handlers = {
      idle: this.idle,
      noticed: this.noticed,
      chase: this.chase,
      lunge: this.lunge,
      recover: this.recover,
      search: this.search,
      giveUp: this.giveUp,
      getTreat: this.getTreat,
      offerTreat: this.offerTreat,
      waitForTrade: this.waitForTrade,
      receiveSock: this.receiveSockState,
      reward: this.reward,
      fetchSock: this.fetchSock,
      returnSock: this.returnSock,
    };
  }

  /** Kneeling with a treat, ready to swap: the "Give Sock" interaction is live. */
  get wantsTrade(): boolean {
    return this.state === 'waitForTrade' || (this.state === 'offerTreat' && this.hasTreat);
  }

  /** How far their eyes are off the floor now (crouching and sitting lower them). */
  get eyeHeight(): number {
    const sight = this.tuning.sight;
    // Searching, they bend right down to peek under things; otherwise a crouch is a kneel.
    const low = this.intent.pose === 'peek' ? sight.peekEyeHeight : sight.crouchEyeHeight;
    const standing = this.seated ? sight.seatedEyeHeight : sight.eyeHeight;
    return lerp(standing, low, this.intent.crouch);
  }

  /** Sitting down right now (from the senses). */
  private seated = false;

  update(dt: number, s: HumanSenses): void {
    this.seated = s.seated ?? false;
    this.lastSenses = s;
    this.timeInState += dt;
    this.stepsInState++;
    this.intent.talking = Math.max(0, this.intent.talking - dt);
    // Everything but idle is the Sock Heist: on their feet, hands free, eyes on Moke when they can see him.
    if (this.state !== 'idle') {
      this.intent.seat = null;
      this.intent.prop = null;
      this.intent.lookAt = this.seesMoke ? s.moke : null;
    }
    this.intent.headYaw = damp(this.intent.headYaw, this.headYawTarget, 6, dt);
    // Under the coffee table he's hidden from standing eyes; only a crouch to peek finds him there.
    this.seesMoke = canSee(s.position, s.heading + this.intent.headYaw, this.eyeHeight, s.moke, s.clear, this.tuning.sight, !s.mokeUnderFurniture);
    if (this.seesMoke) {
      this.lastSeen.x = s.moke.x;
      this.lastSeen.y = s.moke.y;
      this.lastSeen.z = s.moke.z;
      this.unseenFor = 0;
    } else {
      this.unseenFor += dt;
    }
    const next = this.handlers[this.state](dt, s);
    if (next && next !== this.state) this.go(next);
  }

  /** The player handed the sock over (the "Give Sock" interaction). Returns false if they weren't asking. */
  receiveSock(): boolean {
    if (!this.wantsTrade) return false;
    this.hasSock = true;
    this.say('thanks', 'happy');
    this.go('receiveSock');
    return true;
  }

  /** Back to folding laundry at home, as at the start (Sock Heist replay). */
  reset(): void {
    this.state = 'idle';
    this.timeInState = 0;
    this.frustration = 0;
    this.hasTreat = false;
    this.hasSock = false;
    this.timesNoticed = 0;
    this.seenFor = 0;
    this.unseenFor = 0;
    this.headYawTarget = 0;
    this.intent.headYaw = 0;
    this.intent.crouch = 0;
    this.intent.goal = null;
    this.glanceIn = this.nextGlance();
    this.glanceLeft = 0;
    this.offered = false;
    this.driver?.reset();
  }

  // ---------------------------------------------------------------- states

  private readonly idle: Handler = (dt, s) => {
    const i = this.intent;
    if (this.driver) {
      // The daily routine decides what they're up to; the heist only watches for the sock.
      this.headYawTarget = this.driver.drive(dt, s, i);
    } else {
      const home = distance(s.position, this.places.home) < 0.3;
      this.walkTo(home ? null : this.places.home, this.tuning.move.walkSpeed, 0.15);
      i.face = home ? this.places.basket : null;
      i.crouch = 0;
      i.pose = home ? 'fold' : 'idle';
      this.glanceAround(dt, s);
    }

    const heard = s.mokeBarked && s.mokeCarryingSock && canHear(s.position, s.moke, this.tuning.sight);
    this.seenFor = this.seesMoke && s.mokeCarryingSock ? this.seenFor + dt : 0;
    if (heard || this.seenFor >= this.tuning.noticeDelay) {
      this.copy(this.lastSeen, s.moke);
      return 'noticed';
    }
    return null;
  };

  /** Folding laundry: now and then a look round at the room (that's when a sneaky dog gets spotted). */
  private glanceAround(dt: number, s: HumanSenses): void {
    if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      if (this.glanceLeft <= 0) {
        this.headYawTarget = 0;
        this.glanceIn = this.nextGlance();
      }
    } else if ((this.glanceIn -= dt) <= 0) {
      this.glanceLeft = this.tuning.glance.duration;
      const toRoom = angleDelta(s.heading, Math.atan2(ROOM_CENTER.x - s.position.x, ROOM_CENTER.z - s.position.z));
      this.headYawTarget = clamp(toRoom, -this.tuning.glance.angle, this.tuning.glance.angle);
    }
  }

  private readonly noticed: Handler = (_dt, s) => {
    if (this.timeInState < this.tuning.reactTime) return null;
    if (s.mokeCarryingSock) return 'chase';
    return s.looseSock ? 'fetchSock' : 'idle';
  };

  private readonly chase: Handler = (dt, s) => {
    this.grabCooldown -= dt;
    this.cantReachCooldown -= dt;
    this.headYawTarget = 0;
    // A standoff: he's under the furniture right by them. They crouch and peer at him (keeping him in view),
    // can't reach, and lose patience faster.
    const standoff = s.mokeUnderFurniture && distance(s.position, s.moke) < this.tuning.chase.standoffRange;
    this.frustration += dt * (standoff ? this.tuning.chase.standoffRate : 1);
    if (standoff) {
      this.walkTo(null, 0, 0.35);
      this.intent.face = s.moke;
      this.intent.pose = 'peek';
      this.intent.crouch = 1;
      if (this.cantReachCooldown <= 0 && this.seesMoke) {
        this.say('cantReach', 'neutral');
        this.cantReachCooldown = 6;
      }
    } else {
      this.walkTo(this.lastSeen, this.tuning.move.hurrySpeed, 0.35);
      this.intent.face = this.lastSeen;
      this.intent.pose = 'chase';
      this.intent.crouch = 0;
    }

    if (!s.mokeCarryingSock) return s.looseSock && this.canSeeSpot(s, s.looseSock) ? 'fetchSock' : 'search';
    if (this.frustration >= this.tuning.chase.giveUpAt) return 'giveUp';
    if (this.unseenFor >= this.tuning.chase.loseAfter) {
      this.events.emit('CHASE_LOST');
      this.say('lost', 'searching');
      return 'search';
    }
    const inReach = this.seesMoke && distance(s.position, s.moke) <= this.tuning.chase.grabReach;
    // Only a dog in front of them: one darting past behind them is gone before they can turn.
    const inFront = Math.abs(angleDelta(s.heading, Math.atan2(s.moke.x - s.position.x, s.moke.z - s.position.z))) <= this.tuning.chase.grabAngle;
    const catchable = s.mokeSpeed < this.tuning.chase.grabBelowSpeed;
    if (inReach && inFront && catchable && this.grabCooldown <= 0) {
      if (!s.mokeUnderFurniture) return 'lunge';
    }
    return null;
  };

  private readonly lunge: Handler = () => {
    this.stay('lunge');
    if (this.timeInState < this.tuning.chase.lungeTime) return null;
    // Always a fumble: Moke wriggles free (no catching, no punishment; just a bit more frustration).
    this.frustration += this.tuning.chase.missPenalty;
    this.events.emit('GRAB_MISSED');
    this.say('missed', 'surprised');
    return 'recover';
  };

  private readonly recover: Handler = () => {
    this.stay('stumble');
    if (this.timeInState < this.tuning.chase.recoverTime) return null;
    this.grabCooldown = this.tuning.chase.grabCooldown;
    return this.unseenFor > 0.3 ? 'search' : 'chase';
  };

  private readonly search: Handler = (dt, s) => {
    this.frustration += dt;
    const i = this.intent;
    const there = this.arrived(s) || distance(s.position, this.lastSeen) < 0.5 || this.timeInState > 8;
    if (!there) {
      this.walkTo(this.lastSeen, this.tuning.move.walkSpeed, 0.3);
      i.face = this.lastSeen;
      i.pose = 'search';
      i.crouch = 0;
    } else {
      this.lookingFor += dt;
      this.walkTo(null, 0, 0.3);
      i.face = null;
      i.pose = 'search';
      this.headYawTarget = Math.sin(this.lookingFor * 1.7) * 1.1;
      // Halfway through, a crouch to peek under the furniture.
      const t = this.lookingFor / this.tuning.chase.searchTime;
      const peeking = t > 0.35 && t < 0.7;
      i.crouch = peeking ? 1 : 0;
      i.pose = peeking ? 'peek' : 'search';
    }
    if (this.seesMoke && s.mokeCarryingSock) {
      this.say('found', 'surprised');
      this.events.emit('CHASE_FOUND');
      return 'chase';
    }
    if (s.looseSock && this.canSeeSpot(s, s.looseSock)) return 'fetchSock';
    // A bark from his hiding place gives him away.
    if (s.mokeBarked && s.mokeCarryingSock && canHear(s.position, s.moke, this.tuning.sight)) {
      this.copy(this.lastSeen, s.moke);
      this.lookingFor = 0;
      this.timeInState = 0;
      this.say('found', 'surprised');
    }
    if (this.lookingFor >= this.tuning.chase.searchTime) {
      this.frustration += this.tuning.chase.lostPenalty;
      return 'giveUp';
    }
    return null;
  };

  private readonly giveUp: Handler = () => {
    this.stay('shrug');
    return this.timeInState >= this.tuning.chase.giveUpTime ? 'getTreat' : null;
  };

  private readonly getTreat: Handler = (_dt, s) => {
    const i = this.intent;
    const there = this.arrived(s) || distance(s.position, this.places.treatStand) < 0.2;
    if (!there) {
      this.walkTo(this.places.treatStand, this.tuning.move.walkSpeed, 0.15);
      i.face = null;
      i.pose = 'idle';
      this.timeInState = 0; // the rummage clock starts at the jar
      return null;
    }
    this.walkTo(null, 0, 0.15);
    i.face = this.places.treatJar;
    i.pose = 'rummage';
    if (this.timeInState < this.tuning.treat.rummageTime) return null;
    this.hands.takeTreat();
    this.hasTreat = true;
    this.events.emit('TREAT_FETCHED');
    this.say('treatReady', 'happy');
    return 'offerTreat';
  };

  private readonly offerTreat: Handler = (_dt, s) => {
    const i = this.intent;
    const target = this.seesMoke ? s.moke : this.lastSeen;
    this.walkTo(target, this.tuning.move.walkSpeed, this.tuning.treat.offerDistance);
    i.face = target;
    i.pose = 'idle';
    i.crouch = 0;
    if (s.looseSock && (this.canSeeSpot(s, s.looseSock) || distance(s.position, s.looseSock) < 3)) return 'fetchSock';
    const close = distance(s.position, target) <= this.tuning.treat.offerDistance + 0.25;
    if (close || this.arrived(s) || this.timeInState > 12) {
      if (!this.offered) {
        this.offered = true;
        this.events.emit('TREAT_OFFERED');
      }
      this.say('offer', 'calling');
      return 'waitForTrade';
    }
    return null;
  };

  private readonly waitForTrade: Handler = (dt, s) => {
    const i = this.intent;
    this.walkTo(null, 0, 0.15);
    i.face = this.seesMoke ? s.moke : this.lastSeen;
    i.pose = 'offer';
    i.crouch = 1;
    this.headYawTarget = 0;

    // He dropped it right here: that's a trade. Dropped it somewhere else: fetch it, and he gets the treat anyway.
    if (s.looseSock) {
      const away = distance(s.position, s.looseSock);
      if (away <= REACH && this.hands.pickUpSock()) {
        this.hasSock = true;
        this.say('thanks', 'happy');
        return 'receiveSock';
      }
      this.droppedForTrade = away <= this.tuning.treat.closeEnoughDrop;
      // Seen, heard land nearby, or (a safety net, never a soft-lock) noticed after a while wherever it is.
      this.looseFor += dt;
      if (this.droppedForTrade || away < 3 || this.canSeeSpot(s, s.looseSock) || this.looseFor > 12) return 'fetchSock';
    } else {
      this.looseFor = 0;
    }

    const near = distance(s.position, s.moke) <= this.tuning.treat.tradeDistance;
    if (near && !s.mokeCarryingSock && !this.saidSockFirst) {
      this.say('sockFirst', 'neutral');
      this.saidSockFirst = true;
    } else if (!near && distance(s.position, s.moke) > this.tuning.treat.tradeDistance + 0.8) {
      this.saidSockFirst = false;
    }

    if ((this.callIn -= dt) <= 0) {
      this.callIn = this.tuning.treat.callEvery;
      if (this.timeInState > 1) this.say('call', 'calling');
    }
    this.awayFor = this.seesMoke && distance(s.position, s.moke) < 4 ? 0 : this.awayFor + dt;
    if (this.awayFor >= this.tuning.treat.repositionAfter) return 'offerTreat';
    return null;
  };

  private readonly receiveSockState: Handler = (_dt, s) => {
    this.stay('take');
    this.intent.crouch = 1;
    this.intent.face = s.moke;
    if (this.timeInState < this.tuning.exchangeTime) return null;
    this.putTreatDownFor(s);
    this.frustration = 0;
    return 'reward';
  };

  private readonly reward: Handler = () => {
    this.stay('place');
    this.intent.crouch = this.timeInState < 0.6 ? 1 : 0;
    return this.timeInState >= 1.2 ? 'returnSock' : null;
  };

  private readonly fetchSock: Handler = (_dt, s) => {
    const sock = s.looseSock;
    const i = this.intent;
    if (!sock) {
      // He grabbed it again first.
      if (this.hasTreat) return 'offerTreat';
      return this.seesMoke && s.mokeCarryingSock ? 'chase' : 'search';
    }
    this.walkTo(sock, this.hasTreat ? this.tuning.move.walkSpeed : this.tuning.move.hurrySpeed * 0.8, 0.4);
    i.face = sock;
    i.pose = 'idle';
    i.crouch = distance(s.position, sock) < 0.8 ? 0.7 : 0;
    if ((distance(s.position, sock) < REACH || this.arrived(s)) && this.hands.pickUpSock()) {
      this.hasSock = true;
      if (this.hasTreat) {
        // Dropped at their feet: a proper trade. Dropped across the room: close enough.
        this.say(this.droppedForTrade ? 'thanks' : 'closeEnough', 'happy');
        return 'receiveSock';
      }
      this.say('sockBack', 'happy');
      this.events.emit('SOCK_PICKED_UP', { by: 'human' });
      return 'returnSock';
    }
    return null;
  };

  private readonly returnSock: Handler = (_dt, s) => {
    const i = this.intent;
    const home = distance(s.position, this.places.home) < 0.3 || (this.arrived(s) && distance(s.position, this.places.home) < 0.8);
    if (!home) {
      this.walkTo(this.places.home, this.tuning.move.walkSpeed, 0.15);
      i.face = null;
      i.pose = 'idle';
      i.crouch = 0;
      this.timeInState = 0;
      return null;
    }
    this.walkTo(null, 0, 0.15);
    i.face = this.places.basket;
    i.pose = 'tidy';
    if (this.timeInState < this.tuning.tidyTime) return null;
    if (this.hasSock) {
      this.hands.putSockAway();
      this.hasSock = false;
      this.events.emit('SOCK_RETURNED');
    }
    return 'idle';
  };

  // ---------------------------------------------------------------- helpers

  private go(next: HumanStateName): void {
    const from = this.state;
    this.state = next;
    this.timeInState = 0;
    this.stepsInState = 0;
    const i = this.intent;
    if (from === 'idle' && next !== 'idle') this.driver?.interrupt();
    if (next === 'idle' && from !== 'idle' && this.lastSenses) this.driver?.resume(this.lastSenses);
    switch (next) {
      case 'noticed':
        this.timesNoticed++;
        this.say(this.timesNoticed > 1 ? 'noticedAgain' : 'noticed', 'surprised');
        this.events.emit('HUMAN_NOTICED');
        this.stay('surprised');
        i.face = this.lastSeen;
        this.headYawTarget = 0;
        break;
      case 'chase':
        if (from === 'noticed') {
          this.events.emit('CHASE_STARTED');
          this.say('chase', 'neutral');
        }
        i.crouch = 0;
        break;
      case 'lunge':
        this.say('lunge', 'surprised');
        break;
      case 'search':
        this.lookingFor = 0;
        break;
      case 'giveUp':
        this.say('giveUp', 'neutral');
        this.events.emit('CHASE_GAVE_UP');
        i.crouch = 0;
        this.headYawTarget = 0;
        break;
      case 'waitForTrade':
        this.callIn = this.tuning.treat.callEvery;
        this.awayFor = 0;
        this.saidSockFirst = false;
        this.droppedForTrade = false;
        break;
      case 'idle':
        this.glanceIn = this.nextGlance();
        this.glanceLeft = 0;
        this.headYawTarget = 0;
        this.seenFor = 0;
        this.offered = false;
        break;
      default:
        break;
    }
  }

  /** Treat down on the floor between them and Moke, near him. */
  private putTreatDownFor(s: HumanSenses): void {
    const toward = this.seesMoke || distance(s.position, s.moke) < 3 ? s.moke : this.lastSeen;
    const d = Math.max(0.01, distance(s.position, toward));
    const reach = Math.min(0.55, d * 0.6);
    this.hands.placeTreat({
      x: s.position.x + ((toward.x - s.position.x) / d) * reach,
      y: 0,
      z: s.position.z + ((toward.z - s.position.z) / d) * reach,
    });
    this.hasTreat = false;
    this.events.emit('TREAT_PLACED');
  }

  /** Is a spot on the floor (the sock) in view? */
  private canSeeSpot(s: HumanSenses, spot: Vec3Like): boolean {
    return canSee(s.position, s.heading + this.intent.headYaw, this.eyeHeight, spot, s.clear, this.tuning.sight);
  }

  /**
   * The body reached the goal this state asked for. Right after a change of state the body's flag still
   * describes the previous goal, so it only counts once the new goal has been walked for a step.
   */
  private arrived(s: HumanSenses): boolean {
    return this.stepsInState >= 2 && s.arrived;
  }

  private walkTo(goal: Vec3Like | null, speed: number, stopWithin: number): void {
    this.intent.goal = goal;
    this.intent.speed = speed;
    this.intent.stopWithin = stopWithin;
  }

  private stay(pose: HumanPose): void {
    this.walkTo(null, 0, 0.15);
    this.intent.pose = pose;
  }

  /** Says one of the lines for a moment: a random one first, then the others in turn (no instant repeats). */
  private say(line: HeistLine, mood: Speech['mood']): void {
    const lines = HEIST_LINES[line];
    const next = this.lineTurn.get(line) ?? Math.floor(this.random() * lines.length);
    this.lineTurn.set(line, next + 1);
    this.intent.talking = TALK_TIME;
    this.events.emit('HUMAN_SAID', { text: lines[next % lines.length]!, mood });
  }

  private copy(out: Vec3Like, from: Vec3Like): void {
    out.x = from.x;
    out.y = from.y;
    out.z = from.z;
  }

  private nextGlance(): number {
    const [min, extra] = this.tuning.glance.every;
    return min + this.random() * extra;
  }
}
