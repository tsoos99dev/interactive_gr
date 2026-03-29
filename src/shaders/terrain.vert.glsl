attribute float aScalar;
attribute vec2 aChartCoord;
attribute float aChartInDomain;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vScalar;
varying vec2 vChartCoord;
varying float vChartInDomain;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vScalar = aScalar;
  vChartCoord = aChartCoord;
  vChartInDomain = aChartInDomain;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
