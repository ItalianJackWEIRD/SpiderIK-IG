import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { solveLeg } from './ik/fabrik.js';

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
scene.add(new THREE.GridHelper(10, 10));

// ---- Target IK visibile e controllabile ----
const ikTarget = new THREE.Mesh(
  new THREE.SphereGeometry(0.06),
  new THREE.MeshBasicMaterial({ color: 0xff3355 })
);
ikTarget.position.set(1.2, 0, 0.8);
scene.add(ikTarget);

const gui = new GUI();
gui.add(ikTarget.position, 'x', -3, 3, 0.01);
gui.add(ikTarget.position, 'y', 0, 2.5, 0.01);
gui.add(ikTarget.position, 'z', -3, 3, 0.01);

// ---- Caricamento ragno ----
let testChain = null;

const loader = new FBXLoader();
loader.load('models/spider.fbx', (fbx) => {
  // Scala auto-normalizzata: apertura zampe ~2.5 unità
  const size = new THREE.Box3().setFromObject(fbx).getSize(new THREE.Vector3());
  fbx.scale.setScalar(2.5 / Math.max(size.x, size.z));
  fbx.updateMatrixWorld(true);

  // Appoggia i piedi sulla griglia (y=0)
  const box = new THREE.Box3().setFromObject(fbx);
  fbx.position.y -= box.min.y;
  fbx.updateMatrixWorld(true);

  scene.add(fbx);
  scene.add(new THREE.SkeletonHelper(fbx));

  // Catena di test: zampa front-left (l_thigh → l_calf → l_foot)
  testChain = ['l_thigh', 'l_calf', 'l_foot'].map(n => fbx.getObjectByName(n));
  console.log('Catena di test:', testChain.map(b => b?.name));

  // Piazza il target dov'è ora il piede, per partire senza scatti
  testChain[2].getWorldPosition(ikTarget.position);
}, undefined, (err) => console.error('Errore FBX:', err));

renderer.setAnimationLoop(() => {
  if (testChain) solveLeg(testChain, ikTarget.position);
  controls.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});