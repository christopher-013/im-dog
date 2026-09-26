import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { FOREARM_TO_PALM, HUMAN_SKELETON, JOINT_ORDER, UPPER_ARM, type HumanJoint } from './HumanRig';

export type JointAngles = Record<HumanJoint, { x: number; y: number; z: number }>;
export type Side = 'L' | 'R';

const euler = new Euler();
const quat = new Quaternion();
const local = new Matrix4();
const scaleOne = new Vector3(1, 1, 1);
const position = new Vector3();

const chainCache = new Map<HumanJoint, HumanJoint[]>();
/** The joints from the root (hips) down to `joint`. */
function chain(joint: HumanJoint): HumanJoint[] {
  let cached = chainCache.get(joint);
  if (!cached) {
    cached = [];
    for (let j: HumanJoint | null = joint; j; j = HUMAN_SKELETON[j].parent) cached.unshift(j);
    chainCache.set(joint, cached);
  }
  return cached;
}

/** A joint's rotation from its angles, in its Euler order. */
export function jointQuaternion(joint: HumanJoint, a: { x: number; y: number; z: number }, out: Quaternion): Quaternion {
  euler.set(a.x, a.y, a.z, JOINT_ORDER[joint] ?? 'XYZ');
  return out.setFromEuler(euler);
}

/**
 * Forward kinematics in character space (the root at the feet, facing +z): the matrix of `joint` for these angles
 * and hip placement. Plain maths, no scene graph, so the animation can reason about where hands and heads are.
 */
export function jointMatrix(angles: JointAngles, hips: { x: number; y: number; z: number }, joint: HumanJoint, out: Matrix4): Matrix4 {
  out.identity();
  for (const j of chain(joint)) {
    const at = HUMAN_SKELETON[j].at;
    if (j === 'hips') position.set(hips.x, hips.y, hips.z);
    else position.set(at[0], at[1], at[2]);
    jointQuaternion(j, angles[j], quat);
    local.compose(position, quat, scaleOne);
    out.multiply(local);
  }
  return out;
}

const parentMatrix = new Matrix4();
const parentQuat = new Quaternion();
const shoulderPos = new Vector3();
const toTarget = new Vector3();
const dir = new Vector3();
const poleDir = new Vector3();
const elbowPos = new Vector3();
const upper = new Vector3();
const fore = new Vector3();
const xAxis = new Vector3();
const yAxis = new Vector3();
const zAxis = new Vector3();
const basis = new Matrix4();
const worldQuat = new Quaternion();
const shoulderEuler = new Euler();

/**
 * Two-bone IK for an arm: angles for the shoulder and elbow that put the middle of the palm on `target` (character
 * space), the elbow bending out toward `pole` (a direction). The collarbone and everything above it are taken as
 * posed. If the target is out of reach, the arm points at it, straight (never stretched). Writes into `angles` and
 * returns how far the palm ends up from the target (m).
 */
export function solveArm(angles: JointAngles, hips: { x: number; y: number; z: number }, side: Side, target: Vector3, pole: Vector3): number {
  const clavicle: HumanJoint = side === 'L' ? 'clavicleL' : 'clavicleR';
  const shoulder: HumanJoint = side === 'L' ? 'shoulderL' : 'shoulderR';
  const elbow: HumanJoint = side === 'L' ? 'elbowL' : 'elbowR';
  jointMatrix(angles, hips, clavicle, parentMatrix);
  const at = HUMAN_SKELETON[shoulder].at;
  shoulderPos.set(at[0], at[1], at[2]).applyMatrix4(parentMatrix);
  parentQuat.setFromRotationMatrix(parentMatrix);

  const a = UPPER_ARM;
  const b = FOREARM_TO_PALM;
  toTarget.subVectors(target, shoulderPos);
  const want = toTarget.length();
  const d = Math.min(Math.max(want, Math.abs(a - b) + 0.03), (a + b) * 0.998);
  dir.copy(toTarget).divideScalar(Math.max(want, 1e-6));
  // The elbow sits in the plane of the reach and the pole, toward the pole.
  poleDir.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (poleDir.lengthSq() < 1e-8) poleDir.set(0, -1, 0).addScaledVector(dir, dir.y);
  poleDir.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  elbowPos.copy(shoulderPos).addScaledVector(dir, a * cosA).addScaledVector(poleDir, a * sinA);
  upper.subVectors(elbowPos, shoulderPos).normalize();
  const palm = shoulderPos.clone().addScaledVector(dir, d);
  fore.subVectors(palm, elbowPos).normalize();

  // The upper arm's frame: +y back up the arm (it hangs along -y at rest), +z the way the forearm bends.
  yAxis.copy(upper).negate();
  zAxis.copy(fore).addScaledVector(upper, -fore.dot(upper));
  if (zAxis.lengthSq() < 1e-8) zAxis.copy(poleDir).addScaledVector(upper, -poleDir.dot(upper)).negate();
  zAxis.normalize();
  xAxis.crossVectors(yAxis, zAxis).normalize();
  basis.makeBasis(xAxis, yAxis, zAxis);
  worldQuat.setFromRotationMatrix(basis);
  const localQuat = parentQuat.clone().invert().multiply(worldQuat);
  shoulderEuler.setFromQuaternion(localQuat, JOINT_ORDER[shoulder] ?? 'XYZ');
  const s = angles[shoulder];
  s.x = shoulderEuler.x;
  s.y = shoulderEuler.y;
  s.z = shoulderEuler.z;
  const e = angles[elbow];
  e.x = -Math.acos(Math.min(1, Math.max(-1, upper.dot(fore))));
  e.y = 0;
  e.z = 0;
  return Math.abs(want - d);
}

/** Where a joint is (character space) for these angles. */
export function jointPosition(angles: JointAngles, hips: { x: number; y: number; z: number }, joint: HumanJoint, out: Vector3): Vector3 {
  jointMatrix(angles, hips, joint, parentMatrix);
  return out.setFromMatrixPosition(parentMatrix);
}
