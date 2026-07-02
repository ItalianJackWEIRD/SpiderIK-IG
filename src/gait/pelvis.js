import * as THREE from 'three';

const _target = new THREE.Vector3();
const _accel = new THREE.Vector3();

export class PelvisController {
  /**
   * @param bone il bone Pelvis
   */
  constructor(bone) {
    this.bone = bone;
    this.rest = bone.position.clone();
    // conversione world→spazio locale del bone: scala world del PARENT
    // (include tutti i nodi intermedi dell'export FBX)
    this.s = bone.parent.getWorldScale(new THREE.Vector3()).x;
    console.log('Pelvis parent world scale:', this.s);
    this.offset = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.phase = 0;
    this.params = {
      stiffness: 120,
      damping: 14,
      bobAmp: 0.1,
      swayAmp: 0.045,
      freq: 5.5,
    };
  }

  update(dt, speed) {
    const p = this.params;
    const k = THREE.MathUtils.clamp(speed / 1.5, 0, 1); // 1.5 = velocità di crociera

    this.phase += dt * p.freq * (0.4 + k);

    // target: sway laterale a freq base, bob verticale a freq doppia
    // (due appoggi per ciclo = due bob, come nel walk cycle reale)
    _target.set(
      Math.sin(this.phase) * p.swayAmp * k,
      Math.sin(this.phase * 2) * p.bobAmp * k,
      0
    );

    // spring-damper semi-implicito
    _accel.copy(_target).sub(this.offset).multiplyScalar(p.stiffness)
      .addScaledVector(this.vel, -p.damping);
    this.vel.addScaledVector(_accel, dt);
    this.offset.addScaledVector(this.vel, dt);

    // applica in spazio bone (conversione di scala)
    this.bone.position.set(
      this.rest.x + this.offset.x / this.s,
      this.rest.y + this.offset.y / this.s,
      this.rest.z
    );
  }
}