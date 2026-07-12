import * as THREE from 'three';

export function solveFABRIK(points, lengths, target, iterations = 10, tolerance = 0.001) {
  const root = points[0].clone();
  const totalLen = lengths.reduce((a, b) => a + b, 0);

  if (root.distanceTo(target) > totalLen) {
    for (let i = 0; i < points.length - 1; i++) {
      const dir = target.clone().sub(points[i]).normalize();
      points[i + 1].copy(points[i]).addScaledVector(dir, lengths[i]);
    }
    return;
  }

  for (let it = 0; it < iterations; it++) {
    // Backward pass
    points[points.length - 1].copy(target);
    for (let i = points.length - 2; i >= 0; i--) {
      const dir = points[i].clone().sub(points[i + 1]).normalize();
      points[i].copy(points[i + 1]).addScaledVector(dir, lengths[i]);
    }
    // Forward pass
    points[0].copy(root);
    for (let i = 1; i < points.length; i++) {
      const dir = points[i].clone().sub(points[i - 1]).normalize();
      points[i].copy(points[i - 1]).addScaledVector(dir, lengths[i - 1]);
    }
    if (points[points.length - 1].distanceTo(target) < tolerance) break;
  }
}

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

export function applyPoleConstraint(points, poleWorld) {
  const [p0, p1, p2] = points;

  const axis = p2.clone().sub(p0);
  const axisLen = axis.length();
  if (axisLen < 1e-6) return;
  axis.divideScalar(axisLen);

  const proj = p0.clone().addScaledVector(axis, p1.clone().sub(p0).dot(axis));
  const bendLen = p1.distanceTo(proj);

  const toPole = poleWorld.clone().sub(proj);
  toPole.addScaledVector(axis, -toPole.dot(axis));
  if (toPole.lengthSq() < 1e-8) return;
  toPole.normalize();

  p1.copy(proj).addScaledVector(toPole, bendLen);
}

const _up = new THREE.Vector3(0, 1, 0);

export function solveLeg(chain, targetWorld, poleUp = 1.0) {
  const p = chain.map(b => b.getWorldPosition(new THREE.Vector3()));
  const lengths = [p[0].distanceTo(p[1]), p[1].distanceTo(p[2])];

  solveFABRIK(p, lengths, targetWorld);

  const pole = p[0].clone().add(targetWorld).multiplyScalar(0.5).addScaledVector(_up, poleUp);
  applyPoleConstraint(p, pole);

  alignBoneToward(chain[0], chain[1], p[1]);
  alignBoneToward(chain[1], chain[2], p[2]);
}