import * as THREE from 'three';

// Uniforms CONDIVISI tra tutti i materiali curvati: un solo update per frame
export const curveUniforms = {
  uSpiderPos: { value: new THREE.Vector2(0, 0) },
  uCurveR: { value: 127 },     // raggio di curvatura: piccolo = luna piccola
  uHeightMap: { value: null },
  uHeightAmp: { value: 1.8 }, // altezza dei rilievi all'orizzonte
  uGateStart: { value: 14 },  // da qui i rilievi iniziano a crescere...
  uGateEnd: { value: 26 },    // ...e qui sono al massimo (zona di gioco: piatta)
};

/**
 * Inietta la curvatura "tiny planet" in un materiale standard.
 * I vertici vengono abbassati di dist²/R rispetto al ragno (solo visivo:
 * la logica di gioco resta piatta). Con withHeight, oltre il gate viene
 * sommato un rilievo campionato dalla height map, con periodo 40 = la
 * cella del wrap, così l'orizzonte è identico prima e dopo il teletrasporto.
 */
export function makeCurved(material, { withHeight = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, curveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform vec2 uSpiderPos;
        uniform float uCurveR;
        ${withHeight ? `
        uniform sampler2D uHeightMap;
        uniform float uHeightAmp;
        uniform float uGateStart;
        uniform float uGateEnd;` : ''}
      `)
      .replace('#include <project_vertex>', `
        vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
        vec2 dCurve = worldPos4.xz - uSpiderPos;
        worldPos4.y -= dot(dCurve, dCurve) / uCurveR;
        ${withHeight ? `
        float hGate = smoothstep(uGateStart, uGateEnd, length(dCurve));
        float h = texture2D(uHeightMap, worldPos4.xz / 40.0).r;
        worldPos4.y += h * uHeightAmp * hGate;` : ''}
        vec4 mvPosition = viewMatrix * worldPos4;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
  // chiave di cache esplicita: evita che varianti diverse condividano lo shader
  material.customProgramCacheKey = () => 'curved' + (withHeight ? '+h' : '');
  material.needsUpdate = true;
}