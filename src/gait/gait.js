import * as THREE from 'three';

const _home = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class GaitController {
  constructor(body, chains, params = {}) {
    this.body = body;
    this.params = {
      stepThreshold: 0.35, // distanza piede-home oltre cui scatta il passo
      stepDuration: 0.2,  // durata del passo in secondi
      stepHeight: 0.25,    // altezza dell'arco
      leadFactor: 0.33,    // anticipo nella direzione del movimento
      ...params
    };

    // gruppi diagonali alternati: A = 0,2,5,7 | B = 1,3,4,6
    this.legs = chains.map((chain, i) => {
      const planted = chain[2].getWorldPosition(new THREE.Vector3());
      return {
        chain,
        group: [0, 2, 5, 7].includes(i) ? 0 : 1,
        homeLocal: this.body.worldToLocal(planted.clone()), // home in spazio-corpo
        planted,                    // dove il piede è inchiodato (world)
        target: planted.clone(),    // ciò che l'IK deve inseguire
        stepping: false,
        t: 0,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
      };
    });
    this.velocity = new THREE.Vector3();
  }

  homeWorld(leg, out) {
    return out.copy(leg.homeLocal).applyMatrix4(this.body.matrixWorld);
  }

  update(dt, bodyVelocity) {
    if (dt <= 0) return;
    this.velocity.copy(bodyVelocity);
    const p = this.params;

    const steppingGroups = [false, false];
    for (const leg of this.legs) if (leg.stepping) steppingGroups[leg.group] = true;

    for (const leg of this.legs) {
      // --- zampa a metà passo: avanza lungo l'arco ---
      if (leg.stepping) {
        leg.t = Math.min(leg.t + dt / p.stepDuration, 1);
        const e = leg.t * leg.t * (3 - 2 * leg.t); // smoothstep
        leg.target.lerpVectors(leg.from, leg.to, e);
        leg.target.y += Math.sin(leg.t * Math.PI) * p.stepHeight;
        if (leg.t >= 1) {
          leg.stepping = false;
          leg.planted.copy(leg.to);
          leg.target.copy(leg.to);
        }
        continue;
      }

      // --- zampa piantata ---
      leg.target.copy(leg.planted);

      // trigger: home troppo lontana E l'altro gruppo è tutto a terra
      this.homeWorld(leg, _home);
      _tmp.copy(_home).sub(leg.planted);
      _tmp.y = 0;
      if (!steppingGroups[1 - leg.group] && _tmp.length() > p.stepThreshold) {
        leg.stepping = true;
        leg.t = 0;
        leg.from.copy(leg.planted);
        leg.to.copy(_home).addScaledVector(this.velocity, p.leadFactor);
        leg.to.y = 0; // terreno piatto (in futuro: raycast)
        steppingGroups[leg.group] = true;
      }
    }
  }
}