import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { solveLeg } from './ik/fabrik.js';
import { GaitController } from './gait/gait.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(3, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);

scene.add(new THREE.DirectionalLight(0xffffff, 2));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
scene.add(new THREE.GridHelper(20, 20));

let spider = null, chains = null, gait = null;
const debug = { autoWalk: false, walkSpeed: 0.8, turnSpeed: 0.5, showTargets: true };
const targetMeshes = [];

const loader = new FBXLoader();
loader.load('models/spider.fbx', (fbx) => {
  spider = fbx;
  const size = new THREE.Box3().setFromObject(fbx).getSize(new THREE.Vector3());
  fbx.scale.setScalar(2.5 / Math.max(size.x, size.z));
  fbx.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fbx);
  fbx.position.y -= box.min.y;
  fbx.updateMatrixWorld(true);

  scene.add(fbx);
  scene.add(new THREE.SkeletonHelper(fbx));

  const suffixes = ['', '001', '002', '003'];
  chains = [];
  for (const side of ['l', 'r']) {
    for (const suf of suffixes) {
      chains.push(
        [`${side}_thigh${suf}`, `${side}_calf${suf}`, `${side}_foot${suf}`]
          .map(n => fbx.getObjectByName(n))
      );
    }
  }

  gait = new GaitController(fbx, chains);

  // sferette di debug sui target
  const mat = new THREE.MeshBasicMaterial({ color: 0x33ff88 });
  for (const leg of gait.legs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04), mat);
    m.position.copy(leg.target);
    scene.add(m);
    targetMeshes.push(m);
  }

  // GUI: tuning gait + movimento di test
  const gui = new GUI();
  const g = gui.addFolder('Gait');
  g.add(gait.params, 'stepThreshold', 0.1, 0.8, 0.01);
  g.add(gait.params, 'stepDuration', 0.08, 0.6, 0.01);
  g.add(gait.params, 'stepHeight', 0.05, 0.5, 0.01);
  g.add(gait.params, 'leadFactor', 0, 0.5, 0.01);
  const d = gui.addFolder('Debug');
  d.add(debug, 'autoWalk').name('auto walk (cerchio)');
  d.add(debug, 'walkSpeed', 0.2, 2, 0.01);
  d.add(debug, 'turnSpeed', 0, 1.5, 0.01);
  d.add(debug, 'showTargets');
  gui.add(spider.position, 'x', -5, 5, 0.01).name('body x (manuale)');
  gui.add(spider.position, 'z', -5, 5, 0.01).name('body z (manuale)');
  gui.add(spider.rotation, 'y', -Math.PI, Math.PI, 0.01).name('body yaw (manuale)');
}, undefined, (err) => console.error('Errore FBX:', err));

const clock = new THREE.Clock();
const prevPos = new THREE.Vector3();
const velocity = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (spider && gait) {
    // movimento di test: cerchio automatico
    if (debug.autoWalk) {
      spider.rotation.y += debug.turnSpeed * dt;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(spider.quaternion);
      spider.position.addScaledVector(fwd, debug.walkSpeed * dt);
    }
    spider.updateMatrixWorld(true);

    // velocità del corpo (da qualunque fonte: slider o autoWalk)
    velocity.copy(spider.position).sub(prevPos).divideScalar(Math.max(dt, 1e-4));
    velocity.y = 0;
    prevPos.copy(spider.position);

    gait.update(dt, velocity);

    for (let i = 0; i < chains.length; i++) {
      solveLeg(chains[i], gait.legs[i].target);
      targetMeshes[i].position.copy(gait.legs[i].target);
      targetMeshes[i].visible = debug.showTargets;
    }
  }

  controls.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});