import * as THREE from 'three';

/**
 * FABRIK (Forward And Backward Reaching IK) — Aristidou & Lasenby 2011
 * Muta `points` in place. `lengths[i]` = distanza tra points[i] e points[i+1].
 */
export function solveFABRIK(points, lengths, target, iterations = 10, tolerance = 0.001) {
  const root = points[0].clone();
  const totalLen = lengths.reduce((a, b) => a + b, 0);

  // Target irraggiungibile: catena tesa verso il target
  if (root.distanceTo(target) > totalLen) {
    for (let i = 0; i < points.length - 1; i++) {
      const dir = target.clone().sub(points[i]).normalize();
      points[i + 1].copy(points[i]).addScaledVector(dir, lengths[i]);
    }
    return;
  }

  for (let it = 0; it < iterations; it++) {
    // Backward pass: dall'end effector alla radice
    points[points.length - 1].copy(target);
    for (let i = points.length - 2; i >= 0; i--) {
      const dir = points[i].clone().sub(points[i + 1]).normalize();
      points[i].copy(points[i + 1]).addScaledVector(dir, lengths[i]);
    }
    // Forward pass: dalla radice all'end effector
    points[0].copy(root);
    for (let i = 1; i < points.length; i++) {
      const dir = points[i].clone().sub(points[i - 1]).normalize();
      points[i].copy(points[i - 1]).addScaledVector(dir, lengths[i - 1]);
    }
    if (points[points.length - 1].distanceTo(target) < tolerance) break;
  }
}

/**
 * Applica al bone la rotazione (in world space, riconvertita in local)
 * che porta la direzione verso il child sulla direzione risolta dal FABRIK.
 */
export function alignBoneToward(bone, child, solvedChildPos) {
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const curDir = child.getWorldPosition(new THREE.Vector3()).sub(bonePos).normalize();
  const tgtDir = solvedChildPos.clone().sub(bonePos).normalize();

  const deltaQ = new THREE.Quaternion().setFromUnitVectors(curDir, tgtDir);
  const newWorldQ = deltaQ.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parentWorldQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());

  bone.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
  bone.updateMatrixWorld(true);
}

/** Risolve una catena [thigh, calf, foot] verso un target world-space. */
export function solveLeg(chain, targetWorld) {
  const p = chain.map(b => b.getWorldPosition(new THREE.Vector3()));
  const lengths = [p[0].distanceTo(p[1]), p[1].distanceTo(p[2])];

  solveFABRIK(p, lengths, targetWorld);

  alignBoneToward(chain[0], chain[1], p[1]); // thigh → posizione risolta del calf
  alignBoneToward(chain[1], chain[2], p[2]); // calf  → posizione risolta del foot
}