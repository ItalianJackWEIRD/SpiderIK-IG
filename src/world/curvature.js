import * as THREE from 'three';

// Uniforms SHARED across all curved materials: a single update per frame
export const curveUniforms = {
  uSpiderPos: { value: new THREE.Vector2(0, 0) },
  uCurveR: { value: 127 },     // curvature radius: small = small moon
  uHeightMap: { value: null },
  uHeightAmp: { value: 1.8 }, // height of the horizon relief
  uGateStart: { value: 14 },  // relief starts growing from here...
  uGateEnd: { value: 26 },    // ...and reaches full height here (play area: flat)
};

/**
 * Injects the "tiny planet" curvature into a standard material.
 * Vertices are lowered by dist²/R relative to the spider (visual only:
 * game logic stays flat). With withHeight, beyond the gate a relief
 * sampled from the height map is added, with period 40 = the wrap cell,
 * so the horizon is identical before and after the teleport.
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
  // explicit cache key: prevents different variants from sharing the shader
  material.customProgramCacheKey = () => 'curved' + (withHeight ? '+h' : '');
  material.needsUpdate = true;
}