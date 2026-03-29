import { type Chart } from "./charts";
import { pushforwardBasis } from "./vector-fields";
import { terrainSampler } from "./noise";

export interface MetricEllipse {
  /** 3D vertices of the ellipse polyline (closed) */
  vertices: [number, number, number][];
  /** 0 = center, 1 = edge — for fade */
  distNorm: number;
}

const ELLIPSE_SEGMENTS = 20;

/**
 * Compute the induced metric ellipse at a point.
 * The "unit circle" g_ij V^i V^j = 1 is an ellipse in chart coordinates.
 */
function metricEllipseAt(
  chart: Chart,
  x: number,
  z: number,
  scale: number
): [number, number, number][] {
  const [e1Raw, e2Raw] = pushforwardBasis(chart, x, z);

  // Metric components: g_ij = e_i · e_j
  const g11 =
    e1Raw[0] * e1Raw[0] + e1Raw[1] * e1Raw[1] + e1Raw[2] * e1Raw[2];
  const g12 =
    e1Raw[0] * e2Raw[0] + e1Raw[1] * e2Raw[1] + e1Raw[2] * e2Raw[2];
  const g22 =
    e2Raw[0] * e2Raw[0] + e2Raw[1] * e2Raw[1] + e2Raw[2] * e2Raw[2];

  // Eigendecompose the 2×2 symmetric matrix
  const trace = g11 + g22;
  const det = g11 * g22 - g12 * g12;
  const disc = Math.sqrt(Math.max(trace * trace / 4 - det, 0));
  const lambda1 = trace / 2 + disc;
  const lambda2 = trace / 2 - disc;

  // Eigenvector angle
  const angle = Math.atan2(g12, lambda1 - g22);

  // Semi-axes in chart space: g(v,v) = 1 → 1/√λ in eigenbasis
  const a = scale / Math.sqrt(Math.max(lambda1, 0.001));
  const b = scale / Math.sqrt(Math.max(lambda2, 0.001));
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Use normalized basis for 3D display so the chart-space ellipse shape
  // is visible. Using e1Raw/e2Raw would cancel the metric distortion
  // (since g(v,v) = |pushforward(v)|² = 1 is always a circle in 3D).
  const e1Len = Math.sqrt(g11);
  const e2Len = Math.sqrt(g22);
  const e1Norm: [number, number, number] = [e1Raw[0] / e1Len, e1Raw[1] / e1Len, e1Raw[2] / e1Len];
  const e2Norm: [number, number, number] = [e2Raw[0] / e2Len, e2Raw[1] / e2Len, e2Raw[2] / e2Len];

  const y = terrainSampler.height(x, z);
  const vertices: [number, number, number][] = [];

  for (let k = 0; k <= ELLIPSE_SEGMENTS; k++) {
    const theta = (k / ELLIPSE_SEGMENTS) * Math.PI * 2;
    // Axis-aligned ellipse in eigenbasis
    const up = a * Math.cos(theta);
    const vp = b * Math.sin(theta);
    // Rotate back to chart coords
    const du = up * cosA - vp * sinA;
    const dv = up * sinA + vp * cosA;
    // Map to 3D using normalized basis (preserves chart-space shape)
    const vx = du * e1Norm[0] + dv * e2Norm[0];
    const vy = du * e1Norm[1] + dv * e2Norm[1];
    const vz = du * e1Norm[2] + dv * e2Norm[2];
    vertices.push([x + vx, y + vy, z + vz]);
  }

  return vertices;
}

export interface MetricEllipseParams {
  /** Semi-axis lengths in chart space */
  a: number;
  b: number;
  /** Rotation angle of the ellipse in the chart (e1,e2) frame */
  angle: number;
  /** Metric components */
  g11: number;
  g12: number;
  g22: number;
}

/**
 * Compute the metric ellipse parameters at a point (for 2D minimap rendering).
 */
export function metricEllipseParams(
  chart: Chart,
  x: number,
  z: number,
  scale = 0.8,
): MetricEllipseParams {
  const [e1Raw, e2Raw] = pushforwardBasis(chart, x, z);

  const g11 =
    e1Raw[0] * e1Raw[0] + e1Raw[1] * e1Raw[1] + e1Raw[2] * e1Raw[2];
  const g12 =
    e1Raw[0] * e2Raw[0] + e1Raw[1] * e2Raw[1] + e1Raw[2] * e2Raw[2];
  const g22 =
    e2Raw[0] * e2Raw[0] + e2Raw[1] * e2Raw[1] + e2Raw[2] * e2Raw[2];

  const trace = g11 + g22;
  const det = g11 * g22 - g12 * g12;
  const disc = Math.sqrt(Math.max(trace * trace / 4 - det, 0));
  const lambda1 = trace / 2 + disc;
  const lambda2 = trace / 2 - disc;

  const angle = Math.atan2(g12, lambda1 - g22);
  const a = scale / Math.sqrt(Math.max(lambda1, 0.001));
  const b = scale / Math.sqrt(Math.max(lambda2, 0.001));

  return { a, b, angle, g11, g12, g22 };
}

/**
 * Sample metric ellipses on a fixed grid in manifold (x,z) space,
 * covering the chart domain.
 */
export function sampleMetricEllipses(
  chart: Chart,
  gridSize = 12,
  scale = 1.0
): MetricEllipse[] {
  const ellipses: MetricEllipse[] = [];

  const r = chart.radius * 0.9;
  const step = (2 * r) / (gridSize - 1);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = chart.center[0] - r + i * step;
      const z = chart.center[1] - r + j * step;

      const dx = x - chart.center[0];
      const dz = z - chart.center[1];
      const distNorm = Math.sqrt(dx * dx + dz * dz) / chart.radius;
      if (distNorm > 0.92) continue;

      const vertices = metricEllipseAt(chart, x, z, scale);
      ellipses.push({ vertices, distNorm });
    }
  }

  return ellipses;
}
