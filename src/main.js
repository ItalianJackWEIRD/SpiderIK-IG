import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import GUI from 'lil-gui';
import { solveLeg } from './ik/fabrik.js';
import { GaitController } from './gait/gait.js';
import { PelvisController } from './gait/pelvis.js';
import { Keyboard } from './input/keyboard.js';

// se il ragno cammina all'indietro rispetto al muso, metti -1
const FORWARD = 1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 3, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// weak ambient fill; the main light is the spotlight parented to the spider
scene.add(new THREE.AmbientLight(0xffffff, 0.3));
scene.add(new THREE.GridHelper(60, 60));

const keyboard = new Keyboard();

// root logico: input e gait lavorano su questo; il modello è figlio
const spiderRoot = new THREE.Group();
scene.add(spiderRoot);

// --- spotlight above the spider: parented to the root so it follows ---
const spotTarget = new THREE.Object3D();
spiderRoot.add(spotTarget);
const spot = new THREE.SpotLight(0xffffff, 100, 0, Math.PI / 5, 0.6, 1.8);
spot.position.set(0, 4, 0);
spot.target = spotTarget;
spiderRoot.add(spot);

let model = null, chains = null, gait = null, pelvis = null;

const params = {
  moveSpeed: 2.2,
  turnSpeed: 2.2,
  camDistance: 4.5,
  camHeight: 2.2,
  camLag: 4,
  tiltAmount: 0.06,
  showTargets: false,
};

const targetMeshes = [];

new FBXLoader().load('models/spider.fbx', (fbx) => {
  model = fbx;
  const size = new THREE.Box3().setFromObject(fbx).getSize(new THREE.Vector3());
  fbx.scale.setScalar(2.5 / Math.max(size.x, size.z));
  fbx.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fbx);
  fbx.position.y -= box.min.y;

  // --- spider materials from the 4 Unreal-exported maps ---
  const texLoader = new THREE.TextureLoader();
  const colorMap = texLoader.load('textures/spider/texture.PNG');
  colorMap.colorSpace = THREE.SRGBColorSpace; // only the color map is sRGB
  const normalMap = texLoader.load('textures/spider/NormalMap.PNG');
  const specularMap = texLoader.load('textures/spider/SpecularMap.PNG');
  const aoMap = texLoader.load('textures/spider/AmbientOcclusionMap.PNG');
  aoMap.channel = 0; // mesh has a single UV channel (aoMap defaults to uv2)

  let spiderMat = null;
  fbx.traverse((o) => {
    if (!o.isMesh) return;
    o.material = spiderMat = new THREE.MeshPhongMaterial({
      map: colorMap,
      normalMap,
      normalScale: new THREE.Vector2(1, 1), // OpenGL-convention normal map (flipped Y)
      specularMap,
      aoMap,
      shininess: 30,
    });
  });

  spiderRoot.add(fbx);
  spiderRoot.updateMatrixWorld(true);

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

  gait = new GaitController(spiderRoot, chains);
  pelvis = new PelvisController(fbx.getObjectByName('Pelvis'), spiderRoot);

  const mat = new THREE.MeshBasicMaterial({ color: 0x33ff88 });
  for (const leg of gait.legs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04), mat);
    scene.add(m);
    targetMeshes.push(m);
  }

  const gui = new GUI();
  const g = gui.addFolder('Gait');
  g.add(gait.params, 'stepThreshold', 0.1, 0.8, 0.01);
  g.add(gait.params, 'stepDuration', 0.08, 0.6, 0.01);
  g.add(gait.params, 'stepHeight', 0.05, 0.5, 0.01);
  g.add(gait.params, 'leadFactor', 0, 0.5, 0.01);
  const pv = gui.addFolder('Pelvis');
  pv.add(pelvis.params, 'stiffness', 20, 300, 1);
  pv.add(pelvis.params, 'damping', 2, 30, 0.5);
  pv.add(pelvis.params, 'bobAmp', 0, 0.15, 0.005);
  pv.add(pelvis.params, 'swayAmp', 0, 0.15, 0.005);
  pv.add(pelvis.params, 'freq', 2, 15, 0.5);
  pv.add(pelvis.params, 'liftAmp', 0, 0.5, 0.005);
  pv.add(pelvis.params, 'ramp', 1, 10, 0.1);
  pv.add(pelvis.params, 'idleAmp', 0, 0.06, 0.002);
  pv.add(pelvis.params, 'idleFreq', 0.5, 4, 0.1);
  const lt = gui.addFolder('Light');
  lt.add(spot, 'intensity', 0, 300, 1);
  lt.add(spot.position, 'y', 1, 10, 0.1).name('height');
  lt.add(spot, 'angle', 0.1, Math.PI / 2, 0.01);
  lt.add(spot, 'penumbra', 0, 1, 0.01);
  lt.add(spot, 'decay', 0, 3, 0.05);
  lt.add(spiderMat.normalScale, 'y', { 'DirectX (-1)': -1, 'OpenGL (+1)': 1 }).name('normalMapY');
  const mv = gui.addFolder('Movement');
  mv.add(params, 'moveSpeed', 0.5, 3, 0.1);
  mv.add(params, 'turnSpeed', 0.5, 4, 0.1);
  mv.add(params, 'tiltAmount', 0, 0.15, 0.005);
  gui.add(params, 'showTargets');
}, undefined, (err) => console.error('Errore FBX:', err));

const clock = new THREE.Clock();
const prevPos = new THREE.Vector3();
const velocity = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (model && gait) {
    // --- input: W/S avanti-indietro, A/D ruota ---
    const move = keyboard.axis('KeyS', 'KeyW');
    const turn = keyboard.axis('KeyD', 'KeyA');

    spiderRoot.rotation.y += turn * params.turnSpeed * dt;
    _fwd.set(0, 0, FORWARD).applyQuaternion(spiderRoot.quaternion);
    spiderRoot.position.addScaledVector(_fwd, move * params.moveSpeed * dt);

    // --- tilt del corpo: pitch quando avanza, roll quando gira ---
    const targetPitch = -move * params.tiltAmount;
    const targetRoll = -turn * params.tiltAmount * 0.8;
    model.rotation.x = THREE.MathUtils.damp(model.rotation.x, targetPitch, 6, dt);
    model.rotation.z = THREE.MathUtils.damp(model.rotation.z, targetRoll, 6, dt);

    // --- velocità reale del root ---
    velocity.copy(spiderRoot.position).sub(prevPos).divideScalar(Math.max(dt, 1e-4));
    velocity.y = 0;
    prevPos.copy(spiderRoot.position);

    // --- pelvis sway, poi gait, poi IK (l'ordine conta) ---
    pelvis.update(dt, velocity.length());
    spiderRoot.updateMatrixWorld(true);
    gait.update(dt, velocity);

    for (let i = 0; i < chains.length; i++) {
      solveLeg(chains[i], gait.legs[i].target);
      targetMeshes[i].position.copy(gait.legs[i].target);
      targetMeshes[i].visible = params.showTargets;
    }

    // --- camera follow: dietro e sopra, con lag esponenziale ---
    _camGoal.set(0, 0, -FORWARD * params.camDistance)
      .applyQuaternion(spiderRoot.quaternion)
      .add(spiderRoot.position);
    _camGoal.y += params.camHeight;
    camera.position.lerp(_camGoal, 1 - Math.exp(-params.camLag * dt));
    _lookAt.copy(spiderRoot.position); _lookAt.y += 0.8;
    camera.lookAt(_lookAt);
  }

  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});