import * as THREE from 'three';

const _home = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _velLocal = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class GaitController {
  constructor(body, chains, params = {}) {
    this.body = body;
    this.params = {
      stepThreshold: 0.35, // distanza piede-home oltre cui scatta il passo
      stepDuration: 0.25,       // valore attivo (pilotato da main.js)
      stepDurationWalk: 0.25,
      stepDurationSprint: 0.15,
      stepHeight: 0.25,    // altezza dell'arco
      leadFactor: 0.35,    // anticipo nella direzione del movimento
      maxLead: 0.5,        // clamp del lead (unità world)
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
        from: new THREE.Vector3(),  // partenza del passo (world, fissa)
        to: new THREE.Vector3(),    // atterraggio (world, ricalcolato da toLocal)
        toLocal: new THREE.Vector3(), // atterraggio ancorato al corpo
      };
    });
    this.velocity = new THREE.Vector3();
    this.lastGroup = 1; // il primo turno tocca al gruppo 0
  }

  homeWorld(leg, out) {
    return out.copy(leg.homeLocal).applyMatrix4(this.body.matrixWorld);
  }

  legLag(leg) {
    this.homeWorld(leg, _home);
    _tmp.copy(_home).sub(leg.planted);
    _tmp.y = 0;
    return _tmp.length();
  }

  startGroup(g) {
    // lead in spazio-corpo: durante il volo ruota/trasla col corpo
    _q.copy(this.body.quaternion).invert();
    _velLocal.copy(this.velocity).applyQuaternion(_q)
      .multiplyScalar(this.params.leadFactor);

    // invariante anti micro-step: atterrare sempre SOTTO soglia rispetto
    // all'home, altrimenti il gruppo appena atterrato conta come "in ritardo"
    // e si auto-ritriggera con micro-passi
    const maxLead = Math.min(this.params.maxLead, this.params.stepThreshold * 0.8);
    if (_velLocal.length() > maxLead) _velLocal.setLength(maxLead);

    for (const leg of this.legs) {
      if (leg.group !== g) continue;
      leg.stepping = true;
      leg.t = 0;
      leg.from.copy(leg.planted);
      leg.toLocal.copy(leg.homeLocal).add(_velLocal);
    }
    this.lastGroup = g;
  }

  update(dt, bodyVelocity) {
    if (dt <= 0) return;
    this.velocity.copy(bodyVelocity);
    const p = this.params;

    // --- zampe in volo: l'atterraggio è ancorato al corpo, quindi segue
    // traslazione E rotazione senza alcuna predizione ---
    let airborne = false;
    for (const leg of this.legs) {
      if (!leg.stepping) { leg.target.copy(leg.planted); continue; }
      airborne = true;

      leg.to.copy(leg.toLocal).applyMatrix4(this.body.matrixWorld);
      leg.to.y = 0;

      leg.t = Math.min(leg.t + dt / p.stepDuration, 1);
      const e = leg.t * leg.t * (3 - 2 * leg.t); // smoothstep
      leg.target.lerpVectors(leg.from, leg.to, e);
      leg.target.y += Math.sin(leg.t * Math.PI) * p.stepHeight;
      if (leg.t >= 1) {
        leg.stepping = false;
        leg.planted.copy(leg.to);
        leg.target.copy(leg.to);
      }
    }

    if (airborne) return; // un gruppo è in volo: nessun nuovo trigger

    // --- nessuno in volo: si assegna il turno a livello di GRUPPO ---
    const maxLag = [0, 0];
    for (const leg of this.legs) {
      maxLag[leg.group] = Math.max(maxLag[leg.group], this.legLag(leg));
    }
    const over = [maxLag[0] > p.stepThreshold, maxLag[1] > p.stepThreshold];

    if (over[0] && over[1]) this.startGroup(1 - this.lastGroup); // alternanza rigorosa
    else if (over[0]) this.startGroup(0);
    else if (over[1]) this.startGroup(1);
  }
}