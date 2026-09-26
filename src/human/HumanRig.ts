/**
 * The human's rig, shared by the animation (HumanAnimationController, which works out joint angles) and the look
 * (a HumanVisual, which bends its mesh by them). Nothing here knows about meshes, so a modelled human (a GLB with
 * the same joints, or clips mapped to the same states) can replace the built-in one without touching behaviour.
 *
 * **Rest pose:** standing straight, facing +z, their left is +x, feet flat on the floor at y = 0, arms hanging with
 * the palms toward the thighs. Every bone's rest rotation is identity, so a joint's angles are simply how far it has
 * moved from that pose. Bone lengths are an adult man's (1.77 m to the top of the hair), gently stylized.
 *
 * **Angles** (radians, about the joint's own axes):
 * - x: negative swings a limb forward (legs, arms), bends an elbow forward; positive bends a knee back and leans the
 *   spine/neck/head forward (nod);
 * - y: turns (positive = toward their left); on an elbow it swings the bent forearm (left arm: + out, right arm: + in);
 * - z: positive tips the left arm (or collarbone) up and out; the right side uses negative.
 * **Euler orders** (`JOINT_ORDER`): shoulders `ZXY` (raise out, then swing, then twist), elbows `YXZ` (bend, then
 * swing), neck and head `YXZ` (nod, then turn); everything else `XYZ`. The visual must use the same orders.
 */
export const HUMAN_JOINTS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'clavicleL',
  'shoulderL',
  'elbowL',
  'wristL',
  'fingersL',
  'thumbL',
  'clavicleR',
  'shoulderR',
  'elbowR',
  'wristR',
  'fingersR',
  'thumbR',
  'hipL',
  'kneeL',
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
] as const;
export type HumanJoint = (typeof HUMAN_JOINTS)[number];

export type EulerOrder = 'XYZ' | 'YXZ' | 'ZXY';

/** How each joint's three angles combine (see above). */
export const JOINT_ORDER: Readonly<Partial<Record<HumanJoint, EulerOrder>>> = {
  shoulderL: 'ZXY',
  shoulderR: 'ZXY',
  elbowL: 'YXZ',
  elbowR: 'YXZ',
  neck: 'YXZ',
  head: 'YXZ',
};

/** Where each joint sits in the rest pose, relative to its parent (m). */
export const HUMAN_SKELETON: Readonly<Record<HumanJoint, { readonly parent: HumanJoint | null; readonly at: readonly [number, number, number] }>> = {
  hips: { parent: null, at: [0, 0.965, 0] },
  spine: { parent: 'hips', at: [0, 0.1, -0.005] },
  chest: { parent: 'spine', at: [0, 0.19, 0.0] },
  neck: { parent: 'chest', at: [0, 0.215, -0.012] },
  head: { parent: 'neck', at: [0, 0.105, 0.012] },
  clavicleL: { parent: 'chest', at: [0.035, 0.175, 0.03] },
  shoulderL: { parent: 'clavicleL', at: [0.155, 0.0, -0.04] },
  elbowL: { parent: 'shoulderL', at: [0, -0.29, 0] },
  wristL: { parent: 'elbowL', at: [0, -0.26, 0.01] },
  fingersL: { parent: 'wristL', at: [0, -0.09, 0.006] },
  thumbL: { parent: 'wristL', at: [-0.006, -0.03, 0.028] },
  clavicleR: { parent: 'chest', at: [-0.035, 0.175, 0.03] },
  shoulderR: { parent: 'clavicleR', at: [-0.155, 0.0, -0.04] },
  elbowR: { parent: 'shoulderR', at: [0, -0.29, 0] },
  wristR: { parent: 'elbowR', at: [0, -0.26, 0.01] },
  fingersR: { parent: 'wristR', at: [0, -0.09, 0.006] },
  thumbR: { parent: 'wristR', at: [0.006, -0.03, 0.028] },
  hipL: { parent: 'hips', at: [0.1, -0.055, 0] },
  kneeL: { parent: 'hipL', at: [0, -0.44, 0.012] },
  ankleL: { parent: 'kneeL', at: [0, -0.41, -0.022] },
  hipR: { parent: 'hips', at: [-0.1, -0.055, 0] },
  kneeR: { parent: 'hipR', at: [0, -0.44, 0.012] },
  ankleR: { parent: 'kneeR', at: [0, -0.41, -0.022] },
};

/** Standing hip height, the leg's length (hip joint to ankle), and how far above a seat the hip joints sit. */
export const HIP_HEIGHT = HUMAN_SKELETON.hips.at[1];
export const LEG_LENGTH = 0.44 + 0.41;
export const HIP_ABOVE_SEAT = 0.1;
/** Upper arm, and forearm to the middle of the palm (the IK chain). */
export const UPPER_ARM = 0.29;
export const FOREARM_TO_PALM = 0.26 + 0.075;

/** The action the body is asked for. The legs follow speed, sitting and kneeling on their own. */
export type HumanPose =
  // Sock Heist (Phase 3)
  | 'fold'
  | 'idle'
  | 'surprised'
  | 'chase'
  | 'lunge'
  | 'stumble'
  | 'shrug'
  | 'search'
  | 'peek'
  | 'rummage'
  | 'offer'
  | 'take'
  | 'place'
  | 'tidy'
  // Daily life (Phase 4)
  | 'read'
  | 'phone'
  | 'watch'
  | 'relax'
  | 'sip'
  | 'cook'
  | 'prep'
  | 'eat'
  | 'fridge'
  // With Moke
  | 'pet'
  | 'call'
  | 'shoo'
  | 'laugh'
  | 'windup'
  | 'throw'
  | 'point'
  | 'cheer';

/**
 * The semantic states the animation presents (debug panel, docs): what gameplay asked for, as the body shows it.
 * Gameplay asks with a pose name plus speed, sitting, kneeling and where to look; the controller decides the rest.
 */
export type HumanAnimState =
  | 'IDLE'
  | 'WALK'
  | 'TURN'
  | 'SIT_DOWN'
  | 'SIT'
  | 'STAND_UP'
  | 'KNEEL'
  | 'READ'
  | 'PHONE'
  | 'WATCH_TV'
  | 'RELAX'
  | 'SIP'
  | 'COOK'
  | 'PREP'
  | 'EAT'
  | 'FRIDGE'
  | 'FOLD'
  | 'LOOK_AT_MOKE'
  | 'PET_MOKE'
  | 'CALL_MOKE'
  | 'PLAY_WITH_MOKE'
  | 'HEIST';

/** Something in their hands for an activity (shown by the visual; the Sock Heist's sock and treat are separate). */
export type HumanProp = 'book' | 'phone' | 'mug' | 'fork' | 'remote' | 'spoon' | 'knife';

/** How they sit (see HomePlace): upright on a chair or sofa, perched on a tall stool, or lounging, legs up. */
export type HumanSitStyle = 'upright' | 'stool' | 'lounge';

/** A face, as a few dials. */
export interface HumanFace {
  /** 0 closed … 1 wide open (surprise, laughing, talking). */
  jawOpen: number;
  /** 0 round "o" … 1 wide grin. */
  mouthWide: number;
  /** 0 neutral … 1 big smile. */
  smile: number;
  /** 0 open … 1 shut (blinks, contented, dozing). */
  lids: number;
  /** -1 frowning … 0 … 1 raised. */
  brows: number;
  /** Where the eyes look, relative to the head (rad): yaw + = their left, pitch + = up. */
  eyeYaw: number;
  eyePitch: number;
}

/** One frame of the human's animation: joint angles, hip placement, the face, and what they're holding. */
export interface HumanAnimationState {
  readonly joints: Record<HumanJoint, { x: number; y: number; z: number }>;
  /** The hips (pelvis) position relative to the character's root (m): sideways sway, height, forward. */
  hipsX: number;
  hipsY: number;
  hipsZ: number;
  readonly face: HumanFace;
  prop: HumanProp | null;
}
