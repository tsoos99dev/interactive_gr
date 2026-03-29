precision highp float;

uniform vec3 uCameraWorldPos;
uniform float uFogRadius;
uniform float uFogFalloff;
uniform vec3 uBaseColor;
uniform vec3 uFogColor;
uniform bool uShowScalar;
uniform bool uShowContours;
uniform float uScalarMin;
uniform float uScalarMax;
uniform bool uShowWireframe;

// Chart boundaries (up to 4 charts: xy = center, z = radius, w = unused)
uniform vec4 uChartCenters[4];
uniform float uChartRadii[4];
uniform vec3 uChartColors[4];
uniform int uChartCount;
uniform int uActiveChartIdx;

// Chart grid
uniform float uChartGridSpacing;
uniform vec3 uChartGridColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vScalar;
varying vec2 vChartCoord;
varying float vChartInDomain;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

void main() {
  // Basic lighting
  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
  float diff = max(dot(vNormal, lightDir), 0.0) * 0.7 + 0.3;
  vec3 color = uBaseColor * diff;

  // Scalar overlay
  if (uShowScalar) {
    float range = uScalarMax - uScalarMin;
    float t = clamp((vScalar - uScalarMin) / max(range, 0.001), 0.0, 1.0);
    float hue = (1.0 - t) * 0.667;
    vec3 scalarColor = hsl2rgb(hue, 0.75, 0.5);
    color = mix(color, scalarColor, 0.45);
  }

  // Contour lines
  if (uShowContours) {
    float range = uScalarMax - uScalarMin;
    float t = (vScalar - uScalarMin) / max(range, 0.001);
    float lines = abs(fract(t * 15.0) - 0.5);
    float contour = smoothstep(0.02, 0.06, lines);
    color *= contour * 0.4 + 0.6;
  }

  // Active chart coordinate grid lines on the terrain
  if (vChartInDomain > 0.5) {
    float spacing = uChartGridSpacing;
    // Use screen-space derivatives for crisp lines at any zoom
    vec2 chartScaled = vChartCoord / spacing;
    vec2 fw = fwidth(chartScaled);
    float lineWidthPx = 1.2; // line width in grid cells, tuned for crispness
    vec2 gridLines = smoothstep(vec2(0.0), fw * lineWidthPx, abs(fract(chartScaled - 0.5) - 0.5));
    float gridMask = 1.0 - min(gridLines.x, gridLines.y);
    color = mix(color, uChartGridColor, gridMask * 0.55);
  }

  // Wireframe grid (stronger)
  if (uShowWireframe) {
    float wfX = abs(fract(vWorldPosition.x * 0.5) - 0.5);
    float wfZ = abs(fract(vWorldPosition.z * 0.5) - 0.5);
    float wf = 1.0 - step(0.48, wfX) * step(0.48, wfZ);
    color = mix(color, vec3(0.55, 0.6, 0.7), wf * 0.35);
  }

  // Chart regions: boundaries + overlap tinting on terrain
  int chartsHere = 0;
  vec3 overlapTint = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= uChartCount) break;
    float cDist = length(vWorldPosition.xz - uChartCenters[i].xy);
    float radius = uChartRadii[i];

    // Count how many charts cover this point
    if (cDist < radius) {
      chartsHere++;
      if (i != uActiveChartIdx) {
        overlapTint = uChartColors[i];
      }
    }

    // Boundary ring
    float ring = 1.0 - smoothstep(0.0, 1.0, abs(cDist - radius));
    float opacity = (i == uActiveChartIdx) ? 0.6 : 0.25;
    color = mix(color, uChartColors[i], ring * opacity);
  }
  // Tint overlap regions
  if (chartsHere > 1) {
    color = mix(color, overlapTint, 0.08);
  }

  // Fog of war
  float dist = length(vWorldPosition.xz - uCameraWorldPos.xz);
  float fogFactor = smoothstep(uFogRadius - uFogFalloff, uFogRadius, dist);
  color = mix(color, uFogColor, fogFactor);

  float alpha = 0.55 * (1.0 - smoothstep(uFogRadius - 5.0, uFogRadius, dist));

  gl_FragColor = vec4(color, alpha);
}
