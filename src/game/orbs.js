import * as THREE from 'three';
import { makeCurved } from '../world/curvature.js';

const WRAP = 40; // toroidal cell side, must match main.js
const HALF = WRAP / 2;

/**
 * Shortest signed offset on the torus along one axis.
 * Double modulo on purpose: JS % returns negative values for negative
 * operands, so a single modulo would break for d < -HALF.
 */
function wrapDelta(d) {
  return ((d + HALF) % WRAP + WRAP) % WRAP - HALF;
}

/**
 * Collectible glowing orbs.
 * Logical positions are fixed points in the wrap cell [-20, 20]²; every
 * frame each orb is DRAWN at the copy closest to the spider (wrap-aware
 * per axis), so orbs across the cell border show up in front of you,
 * seamless like the ground. The shared material goes through makeCurved
 * so orbs follow the world curvature.
 */
export class OrbManager {
  constructor(scene, count = 6) {
    this.params = {
      pickupRadius: 1.2,  // horizontal pickup distance (world units)
      minSpawnDist: 6,    // never respawn closer than this to the spider
      baseHeight: 0.5,    // bobbing centerline
      bobAmp: 0.15,       // bobbing amplitude
      bobSpeed: 2,        // bobbing angular speed
    };

    this.material = new THREE.MeshPhongMaterial({
      color: 0x112233,
      emissive: 0x66ccff, // bright cyan reads well on the dusty ground
      emissiveIntensity: 2,
      shininess: 80,
    });
    makeCurved(this.material); // bend with the world like the ground

    const geo = new THREE.SphereGeometry(0.25, 24, 16);
    this.orbs = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, this.material);
      scene.add(mesh);
      const orb = {
        mesh,
        logical: new THREE.Vector3(), // fixed (x, 0, z) in the wrap cell
        offset: Math.random() * Math.PI * 2, // per-orb bobbing phase
      };
      this.respawn(orb, null);
      this.orbs.push(orb);
    }
  }

  /** new random logical position, at least minSpawnDist from the spider */
  respawn(orb, spiderPos) {
    for (let tries = 0; tries < 20; tries++) {
      orb.logical.set(
        THREE.MathUtils.randFloatSpread(WRAP),
        0,
        THREE.MathUtils.randFloatSpread(WRAP)
      );
      if (!spiderPos) return;
      const dx = wrapDelta(orb.logical.x - spiderPos.x);
      const dz = wrapDelta(orb.logical.z - spiderPos.z);
      if (dx * dx + dz * dz >= this.params.minSpawnDist ** 2) return;
    }
  }

  /** draw every orb at the copy closest to the spider, with bobbing */
  update(t, spiderPos) {
    const p = this.params;
    for (const orb of this.orbs) {
      orb.mesh.position.set(
        spiderPos.x + wrapDelta(orb.logical.x - spiderPos.x),
        p.baseHeight + Math.sin(t * p.bobSpeed + orb.offset) * p.bobAmp,
        spiderPos.z + wrapDelta(orb.logical.z - spiderPos.z)
      );
    }
  }

  /**
   * Pickup test on the VISUAL (wrap-aware) position, horizontal xz only
   * so the bobbing phase never changes the effective radius.
   * Collected orbs respawn elsewhere.
   * @returns {number} how many orbs were collected this call
   */
  checkPickup(spiderPos, radius = this.params.pickupRadius) {
    let collected = 0;
    for (const orb of this.orbs) {
      const dx = orb.mesh.position.x - spiderPos.x;
      const dz = orb.mesh.position.z - spiderPos.z;
      if (dx * dx + dz * dz < radius * radius) {
        collected++;
        this.respawn(orb, spiderPos);
      }
    }
    return collected;
  }
}
