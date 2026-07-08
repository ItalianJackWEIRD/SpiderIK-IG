import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { solveLeg } from './ik/fabrik.js';
import { GaitController } from './gait/gait.js';
import { PelvisController } from './gait/pelvis.js';
import { Keyboard } from './input/keyboard.js';
import { makeCurved, curveUniforms } from './world/curvature.js';
import { playerState } from './game/state.js';
// TEMP HOOKUP — do not commit: official wiring happens at merge
import { initGame, updateGame, isGameOver, startGame, setDifficulty, showPause, hidePause } from './game/game.js';
import { initMainMenu } from './ui/menu.js';

// se il ragno cammina all'indietro rispetto al muso, metti -1
const FORWARD = 1;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 60, 0.1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- orbit camera (mouse), alternativa alla follow cam ---
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.enablePan = false;
orbit.minDistance = 2;
orbit.maxDistance = 10;
orbit.maxPolarAngle = Math.PI / 2 - 0.05;
orbit.enabled = false; // si parte in follow

// modalità camera: true = orbita col mouse, false = follow
const cam = { orbitMode: false };

let paused = false;
let camCtrl = null;

let mode = 'menu';               // 'menu' | 'intro' | 'playing'
let introT = 0;
const INTRO_DUR = 2.2;           // durata volo cinematico (s)
const _introFrom = new THREE.Vector3();
const _introFromTgt = new THREE.Vector3();
const _introTgt = new THREE.Vector3();


// weak ambient fill; the main light is the spotlight parented to the spider
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// --- terreno: 3 set di texture switchabili (base dei livelli) ---
const groundParams = { repeatPeriod: 20, set: 1 };
const GROUND_SIZE = 120;

const groundTexLoader = new THREE.TextureLoader();
function loadGroundTex(path, srgb = false) {
  const t = groundTexLoader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

const groundCache = new Map();
function getGroundSet(i) {
  if (!groundCache.has(i)) {
    const base = `textures/levels/ground${i}_`;
    groundCache.set(i, {
      color: loadGroundTex(base + 'color.jpg', true),
      normal: loadGroundTex(base + 'normal.jpg'),
      specular: loadGroundTex(base + 'specular.jpg'),
      height: loadGroundTex(base + 'height.jpg'),
    });
  }
  return groundCache.get(i);
}

const groundMat = new THREE.MeshPhongMaterial({
  normalScale: new THREE.Vector2(1, -1), // Quixel = convenzione DirectX
  shininess: 8,
});
makeCurved(groundMat, { withHeight: true });

function setGroundRepeat(period) {
  const s = getGroundSet(groundParams.set);
  const n = GROUND_SIZE / period;
  for (const t of [s.color, s.normal, s.specular]) t.repeat.set(n, n);
}

function applyGround(i) {
  groundParams.set = i;
  const s = getGroundSet(i);
  groundMat.map = s.color;
  groundMat.normalMap = s.normal;
  groundMat.specularMap = s.specular;
  curveUniforms.uHeightMap.value = s.height;
  setGroundRepeat(groundParams.repeatPeriod);
  groundMat.needsUpdate = true; // il materiale acquisisce mappe: ricompila
}
applyGround(1);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 200, 200),
  groundMat
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const SKY_PATHS = [
  'textures/skybox/galaxy2Light.jpg',
  'textures/skybox/galaxy3.jpg',
  'textures/skybox/galaxy1Stars.jpg',
  'textures/skybox/galaxy2.jpg',
  'textures/skybox/galaxy1.jpg',
  'textures/skybox/galaxy4.jpg',
];
const sky = { set: 1, tilt: 2.56, yaw: 2.11 };
const skyCache = new Map();
scene.backgroundRotation.order = 'YXZ';
scene.backgroundRotation.x = sky.tilt;
scene.backgroundRotation.y = sky.yaw;

function applySky(i) {
  sky.set = i;
  if (!skyCache.has(i)) {
    const t = new THREE.TextureLoader().load(SKY_PATHS[i - 1]);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    skyCache.set(i, t);
  }
  scene.background = skyCache.get(i);
}
applySky(1);

const keyboard = new Keyboard();

// root logico: input e gait lavorano su questo; il modello è figlio
const spiderRoot = new THREE.Group();
scene.add(spiderRoot);

// --- sole: luce direzionale fissa, uniforme su tutto il mondo ---
const sun = new THREE.DirectionalLight(0xfff1dd, 8);
scene.add(sun);
const sunCtl = { azimuth: 4.82, elevation: 1.26 };
function placeSun() {
  sun.position.set(
    Math.cos(sunCtl.azimuth) * Math.cos(sunCtl.elevation) * 60,
    Math.sin(sunCtl.elevation) * 60,
    Math.sin(sunCtl.azimuth) * Math.cos(sunCtl.elevation) * 60
  );
}
placeSun();

initGame(scene);

initMainMenu({
  groundCount: 3,
  skyCount: SKY_PATHS.length,
  volume: 100,
  onDifficulty: setDifficulty,
  onGround: applyGround,
  onSky: applySky,
  onPlay: () => {
    mode = 'intro';
    introT = 0;
    // posa di partenza = dov'è ora la camera (alta)
    _introFrom.copy(camera.position);
    _introFromTgt.set(0, 2, 0); // guardava l'orizzonte
  },
});

let model = null, chains = null, gait = null, pelvis = null;

const params = {
  moveSpeed: 2.2,
  sprintMult: 2.5,
  turnSpeed: 2.2,
  camDistance: 4.5,
  camHeight: 2.2,
  camLag: 4,
  tiltAmount: 0.06,
  showTargets: false,
};

const stamina = {
  value: 1,
  drainTime: 1.8,  // secondi di sprint continuo
  regenTime: 6,    // secondi per ricarica completa
  cooldown: 1,     // pausa dopo esaurimento totale
  cdLeft: 0,
  exhausted: false,
};

const WRAP = 40; // lato della cella toroidale (il "perimetro" della luna)

function shiftWorld(dx, dz) {
  spiderRoot.position.x += dx; spiderRoot.position.z += dz;
  prevPos.x += dx; prevPos.z += dz;
  camera.position.x += dx; camera.position.z += dz;
  orbit.target.x += dx; orbit.target.z += dz;
  for (const leg of gait.legs) {
    leg.planted.x += dx; leg.planted.z += dz;
    leg.target.x += dx; leg.target.z += dz;
    leg.from.x += dx; leg.from.z += dz;
    leg.to.x += dx; leg.to.z += dz;
  }
  spiderRoot.updateMatrixWorld(true);
}

function wrapWorld() {
  let dx = 0, dz = 0;
  if (spiderRoot.position.x > WRAP / 2) dx = -WRAP;
  if (spiderRoot.position.x < -WRAP / 2) dx = WRAP;
  if (spiderRoot.position.z > WRAP / 2) dz = -WRAP;
  if (spiderRoot.position.z < -WRAP / 2) dz = WRAP;
  if (dx || dz) shiftWorld(dx, dz);
}

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
  const colorMap = texLoader.load('textures/spider/texture.png');
  colorMap.colorSpace = THREE.SRGBColorSpace; // only the color map is sRGB
  const normalMap = texLoader.load('textures/spider/NormalMap.png');
  const specularMap = texLoader.load('textures/spider/SpecularMap.png');
  const aoMap = texLoader.load('textures/spider/AmbientOcclusionMap.png');
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
  g.add(gait.params, 'stepDurationWalk', 0.08, 0.6, 0.01);
  g.add(gait.params, 'stepDurationSprint', 0.08, 0.4, 0.01);
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
  lt.add(sun, 'intensity', 0, 8, 0.1).name('sun intensity');
  lt.add(sunCtl, 'azimuth', 0, Math.PI * 2, 0.01).name('sun azimuth').onChange(placeSun);
  lt.add(sunCtl, 'elevation', 0.1, Math.PI / 2, 0.01).name('sun elevation').onChange(placeSun);
  lt.add(spiderMat.normalScale, 'y', { 'DirectX (-1)': -1, 'OpenGL (+1)': 1 }).name('normalMapY');
  const mv = gui.addFolder('Movement');
  mv.add(params, 'moveSpeed', 0.5, 3, 0.1);
  mv.add(params, 'turnSpeed', 0.5, 4, 0.1);
  mv.add(params, 'tiltAmount', 0, 0.15, 0.005);
  mv.add(params, 'sprintMult', 1.2, 2.5, 0.05);
  mv.add(stamina, 'drainTime', 1, 8, 0.1);
  mv.add(stamina, 'regenTime', 2, 12, 0.1);
  const w = gui.addFolder('World');
  w.add(groundParams, 'repeatPeriod', [1, 2, 4, 8, 10, 20, 40]).name('texture period')
    .onChange(setGroundRepeat);
  w.add(groundMat, 'shininess', 0, 60, 1);
  w.add(curveUniforms.uCurveR, 'value', 20, 200, 1).name('curve R');
  w.add(curveUniforms.uHeightAmp, 'value', 0, 6, 0.1).name('horizon relief');
  w.add(groundParams, 'set', { 'Ground 1': 1, 'Ground 2': 2, 'Ground 3': 3 })
    .name('ground').onChange(applyGround);
  w.add(sky, 'set', { 'Sky 1': 1, 'Sky 2': 2, 'Sky 3': 3 })
    .name('skybox').onChange(applySky);
  gui.add(params, 'showTargets');
  camCtrl = gui.add(cam, 'orbitMode').name('camera orbit (mouse)')
    .onChange(v => { orbit.enabled = v; });
}, undefined, (err) => console.error('Errore FBX:', err));

const clock = new THREE.Clock();
const prevPos = new THREE.Vector3();
const velocity = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  // pausa: congela ma continua a disegnare
  if (paused) { renderer.render(scene, camera); return; }

  // orb bobbing gira sempre (anche nel menu/intro): serve spiderRoot valido
  if (model) updateGame(dt, clock.elapsedTime, spiderRoot.position);

  // --- MENU: scena ferma, camera alta immobile ---
  if (mode === 'menu') {
    renderer.render(scene, camera);
    return;
  }

  // --- INTRO: volo cinematico dalla posa alta alla follow-cam ---
  if (mode === 'intro') {
    startGame(); // avvia timer+musica una volta sola (guardia interna)
    introT = Math.min(introT + dt / INTRO_DUR, 1);
    const e = introT * introT * (3 - 2 * introT); // smoothstep

    // posa di gioco target (stessa formula della follow-cam)
    _introTgt.set(0, 0, -FORWARD * params.camDistance)
      .applyQuaternion(spiderRoot.quaternion)
      .add(spiderRoot.position);
    _introTgt.y += params.camHeight;
    _lookAt.copy(spiderRoot.position); _lookAt.y += 0.8;

    camera.position.lerpVectors(_introFrom, _introTgt, e);
    _introFromTgt.lerp(_lookAt, e); // interpola anche il punto guardato
    camera.lookAt(_introFromTgt);

    if (introT >= 1) mode = 'playing'; // sblocca input
    renderer.render(scene, camera);
    return;
  }

  // --- PLAYING ---
  if (model && gait && !isGameOver()) {
    // --- input: W/S avanti-indietro, A/D ruota ---
    const move = keyboard.axis('KeyS', 'KeyW');
    const strafe = keyboard.axis('KeyA', 'KeyD');
    const turn = keyboard.axis('KeyE', 'KeyQ');

    // --- sprint con stamina ---
    const wantSprint = keyboard.isDown('ShiftLeft') || keyboard.isDown('ShiftRight');
    const moving = move !== 0 || strafe !== 0;
    let sprinting = wantSprint && moving && !stamina.exhausted && stamina.value > 0;

    if (sprinting) {
      stamina.value -= dt / stamina.drainTime;
      if (stamina.value <= 0) {
        stamina.value = 0;
        stamina.exhausted = true;
        stamina.cdLeft = stamina.cooldown;
        sprinting = false;
      }
    } else if (stamina.cdLeft > 0) {
      stamina.cdLeft -= dt;
    } else {
      stamina.value = Math.min(1, stamina.value + dt / stamina.regenTime);
      if (stamina.exhausted && stamina.value > 0.25) stamina.exhausted = false;
    }

    // bonus orb: refill immediato della stamina
    if (playerState.refillStamina) {
      stamina.value = 1;
      stamina.exhausted = false;
      stamina.cdLeft = 0;
      playerState.refillStamina = false; // consuma il segnale
    }

    playerState.stamina = stamina.value;
    playerState.sprinting = sprinting;
    playerState.exhausted = stamina.exhausted;

    const speed = params.moveSpeed * (sprinting ? params.sprintMult : 1);

    // --- movimento: fwd*move + right*strafe, normalizzato in diagonale ---
    spiderRoot.rotation.y += turn * params.turnSpeed * dt;
    _fwd.set(0, 0, FORWARD).applyQuaternion(spiderRoot.quaternion);
    _right.set(-FORWARD, 0, 0).applyQuaternion(spiderRoot.quaternion);
    _moveDir.copy(_fwd).multiplyScalar(move).addScaledVector(_right, strafe);
    if (_moveDir.lengthSq() > 1) _moveDir.normalize();
    spiderRoot.position.addScaledVector(_moveDir, speed * dt);

    // gait più frenetico in sprint (mantiene stepDuration < threshold/speed)
    gait.params.stepDuration = sprinting ? gait.params.stepDurationSprint : gait.params.stepDurationWalk;

    wrapWorld();

    updateGame(dt, clock.elapsedTime, spiderRoot.position);

    curveUniforms.uSpiderPos.value.set(spiderRoot.position.x, spiderRoot.position.z);

    // --- tilt del corpo: pitch quando avanza, roll quando gira ---
    const targetPitch = -move * params.tiltAmount * (sprinting ? 1.6 : 1);
    const targetRoll = (-turn * 0.8 - strafe * 0.9) * params.tiltAmount;
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

    // --- camera: orbit col mouse oppure follow ---
    if (cam.orbitMode) {
      orbit.target.copy(spiderRoot.position);
      orbit.target.y += 0.8;
      orbit.update();
    } else {
      _camGoal.set(0, 0, -FORWARD * params.camDistance)
        .applyQuaternion(spiderRoot.quaternion)
        .add(spiderRoot.position);
      _camGoal.y += params.camHeight;
      camera.position.lerp(_camGoal, 1 - Math.exp(-params.camLag * dt));
      _lookAt.copy(spiderRoot.position); _lookAt.y += 0.8;
      camera.lookAt(_lookAt);
    }
  }

  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') {
    if (paused || isGameOver()) return;   // in pausa/game over il toggle è inerte
    cam.orbitMode = !cam.orbitMode;
    orbit.enabled = cam.orbitMode;
    camCtrl?.updateDisplay();             // tiene la checkbox GUI allineata
    return;
  }
  if (e.code === 'Escape') {
    if (isGameOver()) return;
    paused = !paused;
    if (paused) { showPause(); orbit.enabled = false; }
    else { hidePause(); orbit.enabled = cam.orbitMode; }
  }
});