import * as THREE from 'three';

const _target = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _worldOff = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class PelvisController {
  constructor(bone, root) {
    this.bone = bone;
    this.root = root;
    this.rest = bone.position.clone();
    this.s = bone.parent.getWorldScale(new THREE.Vector3()).x;
    this.offset = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.phase = 0;
    this.idlePhase = 0;
    this.k = 0;
    this.params = {
      stiffness: 75,
      damping: 6.5,
      bobAmp: 0.1,
      swayAmp: 0.045,
      freq: 7,
      liftAmp: 0.2,
      ramp: 1.8,
      idleAmp: 0.02,
      idleFreq: 1.6,
    };
  }

  update(dt, speed) {
    const p = this.params;

    const kTarget = THREE.MathUtils.clamp(speed / 2.2, 0, 1);
    this.k = THREE.MathUtils.damp(this.k, kTarget, p.ramp, dt);
    const k = this.k;

    this.phase += dt * p.freq * (0.4 + k);
    this.idlePhase += dt * p.idleFreq;

    _target.set(
      Math.sin(this.phase) * p.swayAmp * k,
      p.liftAmp * k
        + Math.sin(this.phase * 2) * p.bobAmp * k
        + Math.sin(this.idlePhase) * p.idleAmp * (1 - k),
      0
    );

    _accel.copy(_target).sub(this.offset).multiplyScalar(p.stiffness)
      .addScaledVector(this.vel, -p.damping);
    this.vel.addScaledVector(_accel, dt);
    this.offset.addScaledVector(this.vel, dt);


    _right.set(1, 0, 0).applyQuaternion(this.root.quaternion);
    _worldOff.set(0, this.offset.y, 0).addScaledVector(_right, this.offset.x);
    this.bone.parent.getWorldQuaternion(_q).invert();
    _worldOff.applyQuaternion(_q).divideScalar(this.s);

    this.bone.position.copy(this.rest).add(_worldOff);
  }
}