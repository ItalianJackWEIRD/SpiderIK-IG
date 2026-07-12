import * as THREE from 'three';

export const curveUniforms = {
  uSpiderPos: { value: new THREE.Vector2(0, 0) },
  uCurveR: { value: 127 },
  uHeightMap: { value: null },
  uHeightAmp: { value: 1.8 },
  uGateStart: { value: 14 },
  uGateEnd: { value: 26 },
};


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
  material.customProgramCacheKey = () => 'curved' + (withHeight ? '+h' : '');
  material.needsUpdate = true;
}