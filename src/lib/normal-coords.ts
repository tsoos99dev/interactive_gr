import { integrateGeodesic } from "./geodesics";
import { sphereMetric } from "./sphere";

export interface NormalCoordGrid {
  /** Lines of constant ξ¹ */
  xi1Lines: [number, number, number][][];
  /** Lines of constant ξ² */
  xi2Lines: [number, number, number][][];
}

/**
 * Build Riemann normal coordinate grid by shooting geodesics.
 * Each grid point is exp_p(ξ¹·e₁ + ξ²·e₂) where (e₁, e₂) is the
 * Gram-Schmidt orthonormal frame at p.
 *
 * @param gridLines  Number of coordinate lines drawn per direction
 * @param nSamples   Points per line (controls surface-following smoothness)
 * @param maxRadius  Extent in normal-coordinate space
 * @param stepsPerLine  RK4 steps per geodesic integration
 */
export function normalCoordGrid(
  theta0: number,
  phi0: number,
  epsilon: number,
  gridLines: number = 15,
  nSamples: number = 40,
  maxRadius: number = 0.4,
  stepsPerLine: number = 100,
): NormalCoordGrid {
  const [g11, g12, g22] = sphereMetric(theta0, phi0, epsilon);
  const dt = 1.0 / stepsPerLine;

  // Precompute Gram-Schmidt factors once
  const lenTheta = Math.sqrt(g11);
  const cosAngle = g12 / (lenTheta * Math.sqrt(g22));
  const lenPhiPerp = Math.sqrt(g22 * (1 - cosAngle * cosAngle));

  /** Convert (ξ¹, ξ²) in orthonormal frame to (vθ, vφ) coordinate velocity */
  function toCoordVelocity(xi1: number, xi2: number): [number, number] {
    return [
      xi1 / lenTheta + xi2 * (-g12 / (g11 * lenPhiPerp)),
      xi2 / lenPhiPerp,
    ];
  }

  /** Shoot geodesic and return endpoint */
  function endpoint(xi1: number, xi2: number): [number, number, number] {
    const [vt, vp] = toCoordVelocity(xi1, xi2);
    const geo = integrateGeodesic(theta0, phi0, vt, vp, epsilon, stepsPerLine, dt);
    return geo.points3D[geo.points3D.length - 1];
  }

  // Which ξ values get drawn as lines
  const half = Math.floor(gridLines / 2);
  const lineValues: number[] = [];
  for (let i = -half; i <= half; i++) {
    lineValues.push((i / half) * maxRadius);
  }

  // Dense sample values along each line
  const sampleValues: number[] = [];
  for (let j = 0; j < nSamples; j++) {
    sampleValues.push(((j / (nSamples - 1)) * 2 - 1) * maxRadius);
  }

  // Lines of constant ξ¹ (vary ξ²)
  const xi1Lines: [number, number, number][][] = [];
  for (const xi1 of lineValues) {
    const line: [number, number, number][] = [];
    for (const xi2 of sampleValues) {
      line.push(endpoint(xi1, xi2));
    }
    xi1Lines.push(line);
  }

  // Lines of constant ξ² (vary ξ¹)
  const xi2Lines: [number, number, number][][] = [];
  for (const xi2 of lineValues) {
    const line: [number, number, number][] = [];
    for (const xi1 of sampleValues) {
      line.push(endpoint(xi1, xi2));
    }
    xi2Lines.push(line);
  }

  return { xi1Lines, xi2Lines };
}
