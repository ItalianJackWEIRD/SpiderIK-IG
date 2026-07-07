import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { makeCurved } from '../world/curvature.js';

const WRAP = 40; // toroidal cell side, must match main.js
const HALF = WRAP / 2;

/** Shortest signed offset on the torus along one axis. */
function wrapDelta(d) {
  return ((d + HALF) % WRAP + WRAP) % WRAP - HALF;
}

/**
 * Orb types.
 *   model:   public/models/orbs/<model>.fbx
 *   texture: public/textures/orbs/<model>.jpg
 *   seconds: number, or [good, bad] for the 50:50 risk orb
 *   weight:  spawn probability (renormalized among non-capped types)
 *   max:     hard cap of simultaneous orbs of this type
 */
export const ORB_TYPES = {
  normal: { seconds: 5, tint: 0xbfdfff, emissive: 0x66ccff, weight: 0.70, max: 6 },
  bonus: { seconds: 8, tint: 0xbbf7d0, emissive: 0x4afe96, weight: 0.10, max: 1 },
  risk: { seconds: [15, -5], tint: 0xffb3b3, emissive: 0xff3333, weight: 0.20, max: 2 },
};

export class OrbManager {
  constructor(scene, count = 6) {
    this.params = {
      pickupRadius: 1.2,
      minSpawnDist: 6,   // from the spider
      minOrbDist: 7,     // between orbs (toroidal distance)
      baseHeight: 0.5,
      bobAmp: 0.15,
      bobSpeed: 2,
      spinSpeed: 0.8,    // showcase spin (JS animation, not imported)
      size: 0.55,        // model target size in world units
    };

    this.placeholderGeo = new THREE.SphereGeometry(0.25, 24, 16);

    // --- shared texture set, loaded once ---
    const texLoader = new THREE.TextureLoader();
    const T = (p, srgb = false) => {
      const t = texLoader.load(p);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const maps = {
      map: T('textures/orbs/orb_color.png', true),
      normalMap: T('textures/orbs/orb_normal.png'),
      specularMap: T('textures/orbs/orb_roughness.png'),
      emissiveMap: T('textures/orbs/orb_emissive.png', true),
      aoMap: T('textures/orbs/orb_ao.png'),
    };
    maps.aoMap.channel = 0; // single UV set, like the spider

    // --- one material per type: same maps, different tint & glow ---
    this.assets = {};
    for (const [type, cfg] of Object.entries(ORB_TYPES)) {
      const material = new THREE.MeshPhongMaterial({
        ...maps,
        color: cfg.tint,          // multiplies the baseColor: the "veil"
        emissive: cfg.emissive,   // multiplies the emissiveMap: tints the LED
        emissiveIntensity: 1.4,
        shininess: 45,
      });
      makeCurved(material);
      this.assets[type] = { material };
    }

    // --- ONE shared FBX for all types ---
    this.templateShared = null;
    new FBXLoader().load('models/orbs/orb.fbx', (fbx) => {
      let box = new THREE.Box3().setFromObject(fbx);
      const dim = box.getSize(new THREE.Vector3());
      fbx.scale.setScalar(this.params.size / Math.max(dim.x, dim.y, dim.z));
      fbx.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(fbx);
      fbx.position.sub(box.getCenter(new THREE.Vector3()));

      this.templateShared = fbx;
      for (const orb of this.orbs) this.setVisual(orb); // upgrade placeholders
    }, undefined, () => console.warn('orb.fbx missing (placeholder spheres in use)'));

    // --- the orbs themselves ---
    this.orbs = [];
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      scene.add(group);
      const orb = {
        group,
        type: 'normal',
        logical: new THREE.Vector3(),
        offset: Math.random() * Math.PI * 2,
      };
      this.respawn(orb, null);
      this.orbs.push(orb);
    }
  }

  setVisual(orb) {
    orb.group.clear();
    const mat = this.assets[orb.type].material;
    if (this.templateShared) {
      const m = this.templateShared.clone();
      m.traverse((o) => { if (o.isMesh) o.material = mat; });
      orb.group.add(m);
    } else {
      orb.group.add(new THREE.Mesh(this.placeholderGeo, mat));
    }
  }

  /** pick a type honoring per-type caps, weights renormalized */
  chooseType(exclude) {
    const counts = {};
    for (const o of this.orbs) {
      if (o === exclude) continue;
      counts[o.type] = (counts[o.type] || 0) + 1;
    }
    const avail = Object.entries(ORB_TYPES)
      .filter(([t, c]) => (counts[t] || 0) < c.max);
    let total = avail.reduce((s, [, c]) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const [t, c] of avail) {
      r -= c.weight;
      if (r <= 0) return t;
    }
    return 'normal';
  }

  /** random logical position far from the spider AND from other orbs */
  respawn(orb, spiderPos) {
    orb.type = this.chooseType(orb);
    this.setVisual(orb);

    const p = this.params;
    for (let tries = 0; tries < 30; tries++) {
      orb.logical.set(
        THREE.MathUtils.randFloatSpread(WRAP), 0,
        THREE.MathUtils.randFloatSpread(WRAP)
      );
      let ok = true;
      if (spiderPos) {
        const dx = wrapDelta(orb.logical.x - spiderPos.x);
        const dz = wrapDelta(orb.logical.z - spiderPos.z);
        ok = dx * dx + dz * dz >= p.minSpawnDist ** 2;
      }
      if (!ok) continue;
      for (const other of this.orbs) {
        if (other === orb) continue;
        const dx = wrapDelta(orb.logical.x - other.logical.x);
        const dz = wrapDelta(orb.logical.z - other.logical.z);
        if (dx * dx + dz * dz < p.minOrbDist ** 2) { ok = false; break; }
      }
      if (ok) return;
    }
    // 30 failed tries: keep the last candidate (never hard-locks)
  }

  update(t, spiderPos) {
    const p = this.params;
    for (const orb of this.orbs) {
      orb.group.position.set(
        spiderPos.x + wrapDelta(orb.logical.x - spiderPos.x),
        p.baseHeight + Math.sin(t * p.bobSpeed + orb.offset) * p.bobAmp,
        spiderPos.z + wrapDelta(orb.logical.z - spiderPos.z)
      );
      orb.group.rotation.y = t * p.spinSpeed + orb.offset;
      if (orb.type === 'risk') {
        this.assets.risk.material.emissiveIntensity = 1.4 + Math.sin(t * 5) * 0.7;
      }
    }
  }

  /**
   * Pickup on the VISUAL (wrap-aware) position, xz only.
   * @returns {Array<{type: string, seconds: number, good: boolean}>}
   */
  checkPickup(spiderPos, radius = this.params.pickupRadius) {
    const events = [];
    for (const orb of this.orbs) {
      const dx = orb.group.position.x - spiderPos.x;
      const dz = orb.group.position.z - spiderPos.z;
      if (dx * dx + dz * dz >= radius * radius) continue;

      const cfg = ORB_TYPES[orb.type];
      let seconds, good = true;
      if (Array.isArray(cfg.seconds)) {          // risk: 50:50
        good = Math.random() < 0.5;
        seconds = good ? cfg.seconds[0] : cfg.seconds[1];
      } else {
        seconds = cfg.seconds;
      }
      events.push({ type: orb.type, seconds, good });
      this.respawn(orb, spiderPos);
    }
    return events;
  }
}