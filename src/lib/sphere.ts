import { createNoise2D } from "simplex-noise";

const noise2D_a = createNoise2D(() => 0.42);
const noise2D_b = createNoise2D(() => 0.73);
const noise2D_c = createNoise2D(() => 0.31);
const noise2D_d = createNoise2D(() => 0.89);

/** Sample seamless 2D noise on the sphere via embedding coords */
function sampleNoise(
  noise: ReturnType<typeof createNoise2D>,
  sx: number, sy: number, sz: number,
  freq: number, offset: number,
): number {
  return noise(sx * freq + sy * freq * 0.7, sz * freq + offset);
}

/**
 * Seamless noise on the sphere with terrain-like features:
 * - Broad rolling hills (low freq)
 * - Craters (radial dips from point sources)
 * - Plateaus / mesas (clamped ridges)
 * - Fine detail (high freq octaves)
 */
function sphereNoise(theta: number, phi: number): number {
  const sx = Math.sin(theta) * Math.cos(phi);
  const sy = Math.cos(theta);
  const sz = Math.sin(theta) * Math.sin(phi);

  // ── Base terrain: broad undulation ──
  const broad =
    sampleNoise(noise2D_a, sx, sy, sz, 1.2, 137) * 0.5 +
    sampleNoise(noise2D_b, sx, sy, sz, 1.2, 251) * 0.3;

  // ── Medium detail ──
  const med =
    sampleNoise(noise2D_a, sx, sy, sz, 3.0, 42) * 0.25 +
    sampleNoise(noise2D_b, sx, sy, sz, 3.0, 99) * 0.15;

  // ── Fine detail ──
  const fine =
    sampleNoise(noise2D_a, sx, sy, sz, 7.0, 200) * 0.08 +
    sampleNoise(noise2D_b, sx, sy, sz, 7.0, 333) * 0.05;

  // ── Craters: localized circular depressions ──
  // Use noise to place craters procedurally — where noise exceeds a threshold,
  // create a smooth dip
  const craterField = sampleNoise(noise2D_c, sx, sy, sz, 2.5, 77);
  const craterMask = Math.max(0, craterField - 0.3) / 0.7; // 0 outside, ramps to 1
  const craterDepth = -craterMask * craterMask * 0.6; // smooth quadratic dip

  // ── Plateaus: flat-topped ridges via clamping ──
  const ridgeRaw = sampleNoise(noise2D_d, sx, sy, sz, 1.8, 55);
  const plateau = Math.max(0, ridgeRaw - 0.1) * 0.8; // only positive ridges
  const plateauFlat = Math.min(plateau, 0.35); // clamp top for flat mesa

  // ── Canyons: sharp valleys where noise is strongly negative ──
  const canyonRaw = sampleNoise(noise2D_c, sx, sy, sz, 2.0, 180);
  const canyon = Math.min(0, canyonRaw + 0.2) * 0.7; // negative dips only

  // Combine
  const total = broad + med + fine + craterDepth + plateauFlat + canyon;

  // Normalize to roughly [-1, 1]
  return total * 0.8;
}

const R = 1.0;
const EPS = 0.001;

// ── Noise cache ──
// Cache the noise values on a grid so all derived quantities are cheap.
const NOISE_GRID_THETA = 200;
const NOISE_GRID_PHI = 400;
let noiseGridEpsilon: number | null = null;
let noiseGrid: Float64Array | null = null;

function ensureNoiseCache(epsilon: number) {
  if (noiseGridEpsilon === epsilon && noiseGrid) return;
  console.time("noiseCache");
  noiseGridEpsilon = epsilon;
  if (epsilon === 0) {
    noiseGrid = null;
    console.timeEnd("noiseCache");
    return;
  }
  noiseGrid = new Float64Array(NOISE_GRID_THETA * NOISE_GRID_PHI);
  for (let i = 0; i < NOISE_GRID_THETA; i++) {
    const theta = ((i + 0.5) / NOISE_GRID_THETA) * Math.PI;
    for (let j = 0; j < NOISE_GRID_PHI; j++) {
      const phi = (j / NOISE_GRID_PHI) * 2 * Math.PI;
      noiseGrid[i * NOISE_GRID_PHI + j] = sphereNoise(theta, phi);
    }
  }
  console.timeEnd("noiseCache");
}

function cachedNoise(theta: number, phi: number, epsilon: number): number {
  if (epsilon === 0) return 0;
  ensureNoiseCache(epsilon);
  if (!noiseGrid) return 0;

  const ti = (theta / Math.PI) * NOISE_GRID_THETA - 0.5;
  const pi = ((phi % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * NOISE_GRID_PHI;

  const ti0 = Math.max(0, Math.min(NOISE_GRID_THETA - 2, Math.floor(ti)));
  const ti1 = ti0 + 1;
  const ft = Math.max(0, Math.min(1, ti - ti0));

  const pi0 = ((Math.floor(pi) % NOISE_GRID_PHI) + NOISE_GRID_PHI) % NOISE_GRID_PHI;
  const pi1 = (pi0 + 1) % NOISE_GRID_PHI;
  const fp = pi - Math.floor(pi);

  const v00 = noiseGrid[ti0 * NOISE_GRID_PHI + pi0];
  const v01 = noiseGrid[ti0 * NOISE_GRID_PHI + pi1];
  const v10 = noiseGrid[ti1 * NOISE_GRID_PHI + pi0];
  const v11 = noiseGrid[ti1 * NOISE_GRID_PHI + pi1];

  return v00 * (1 - ft) * (1 - fp) + v01 * (1 - ft) * fp +
         v10 * ft * (1 - fp) + v11 * ft * fp;
}

/** Force the noise cache to be built (call from SphereMesh on epsilon change) */
export function warmNoiseCache(epsilon: number) {
  ensureNoiseCache(epsilon);
}

/** 3D position on the (possibly bumpy) sphere — uses exact noise */
export function spherePosition(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number] {
  const r = R + epsilon * sphereNoise(theta, phi);
  const st = Math.sin(theta);
  return [r * st * Math.cos(phi), r * Math.cos(theta), r * st * Math.sin(phi)];
}

/** 3D position using cached noise (fast, for Christoffel finite differences) */
function spherePositionCached(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number] {
  const r = R + epsilon * cachedNoise(theta, phi, epsilon);
  const st = Math.sin(theta);
  return [r * st * Math.cos(phi), r * Math.cos(theta), r * st * Math.sin(phi)];
}

/** Unnormalized tangent basis vectors via finite differences (uses cached noise for speed) */
export function sphereBasis(
  theta: number,
  phi: number,
  epsilon: number,
): { eTheta: [number, number, number]; ePhi: [number, number, number] } {
  const pos = epsilon > 0 ? spherePositionCached : spherePosition;
  const pPlus = pos(theta + EPS, phi, epsilon);
  const pMinus = pos(theta - EPS, phi, epsilon);
  const eTheta: [number, number, number] = [
    (pPlus[0] - pMinus[0]) / (2 * EPS),
    (pPlus[1] - pMinus[1]) / (2 * EPS),
    (pPlus[2] - pMinus[2]) / (2 * EPS),
  ];

  const qPlus = pos(theta, phi + EPS, epsilon);
  const qMinus = pos(theta, phi - EPS, epsilon);
  const ePhi: [number, number, number] = [
    (qPlus[0] - qMinus[0]) / (2 * EPS),
    (qPlus[1] - qMinus[1]) / (2 * EPS),
    (qPlus[2] - qMinus[2]) / (2 * EPS),
  ];

  return { eTheta, ePhi };
}

/** Unit normal via cross product of basis vectors */
export function sphereNormal(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number] {
  const { eTheta, ePhi } = sphereBasis(theta, phi, epsilon);
  const nx = eTheta[1] * ePhi[2] - eTheta[2] * ePhi[1];
  const ny = eTheta[2] * ePhi[0] - eTheta[0] * ePhi[2];
  const nz = eTheta[0] * ePhi[1] - eTheta[1] * ePhi[0];
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return len > 1e-10 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Induced metric g_ij in (theta, phi) coordinates */
export function sphereMetric(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number] {
  const { eTheta, ePhi } = sphereBasis(theta, phi, epsilon);
  return [dot3(eTheta, eTheta), dot3(eTheta, ePhi), dot3(ePhi, ePhi)];
}

/** Inverse metric g^ij */
export function sphereInverseMetric(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number] {
  const [g11, g12, g22] = sphereMetric(theta, phi, epsilon);
  const det = g11 * g22 - g12 * g12;
  return [g22 / det, -g12 / det, g11 / det];
}

/**
 * Christoffel symbols Γ^k_ij via finite differences on the metric.
 * Returns [Γ^1_11, Γ^1_12, Γ^1_22, Γ^2_11, Γ^2_12, Γ^2_22]
 * where index 1=theta, 2=phi.
 */
export function sphereChristoffel(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number, number, number, number] {
  const DEPS = 0.001;

  const gThetaP = sphereMetric(theta + DEPS, phi, epsilon);
  const gThetaM = sphereMetric(theta - DEPS, phi, epsilon);
  const gPhiP = sphereMetric(theta, phi + DEPS, epsilon);
  const gPhiM = sphereMetric(theta, phi - DEPS, epsilon);

  const dg11_dt = (gThetaP[0] - gThetaM[0]) / (2 * DEPS);
  const dg12_dt = (gThetaP[1] - gThetaM[1]) / (2 * DEPS);
  const dg22_dt = (gThetaP[2] - gThetaM[2]) / (2 * DEPS);
  const dg11_dp = (gPhiP[0] - gPhiM[0]) / (2 * DEPS);
  const dg12_dp = (gPhiP[1] - gPhiM[1]) / (2 * DEPS);
  const dg22_dp = (gPhiP[2] - gPhiM[2]) / (2 * DEPS);

  const [gi11, gi12, gi22] = sphereInverseMetric(theta, phi, epsilon);

  // Γ^k_ij = 0.5 * g^{kl} * (∂_i g_{lj} + ∂_j g_{li} - ∂_l g_{ij})
  const dg = [
    [[dg11_dt, dg12_dt], [dg12_dt, dg22_dt]],
    [[dg11_dp, dg12_dp], [dg12_dp, dg22_dp]],
  ];
  const ginv = [[gi11, gi12], [gi12, gi22]];

  const gamma: number[] = [];
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 2; i++) {
      for (let j = i; j < 2; j++) {
        let val = 0;
        for (let l = 0; l < 2; l++) {
          val += ginv[k][l] * (dg[i][l][j] + dg[j][l][i] - dg[l][i][j]);
        }
        gamma.push(0.5 * val);
      }
    }
  }

  return gamma as [number, number, number, number, number, number];
}

/** Convert (θ,φ) coordinate velocity to Christoffel acceleration: -Γ^k_ij v^i v^j */
export function christoffelAccel(
  theta: number,
  phi: number,
  vTheta: number,
  vPhi: number,
  epsilon: number,
): [number, number] {
  const [G0_00, G0_01, G0_11, G1_00, G1_01, G1_11] = sphereChristoffel(theta, phi, epsilon);

  const aTheta = -(
    G0_00 * vTheta * vTheta +
    2 * G0_01 * vTheta * vPhi +
    G0_11 * vPhi * vPhi
  );
  const aPhi = -(
    G1_00 * vTheta * vTheta +
    2 * G1_01 * vTheta * vPhi +
    G1_11 * vPhi * vPhi
  );

  return [aTheta, aPhi];
}

/** Sphere radius constant */
export const SPHERE_RADIUS = R;

/** Theta/phi grid resolution for the mesh */
export const SPHERE_SEGMENTS_THETA = 96;
export const SPHERE_SEGMENTS_PHI = 128;

/** Convert 3D position to (theta, phi) */
export function cartesianToSpherical(x: number, y: number, z: number): { theta: number; phi: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = Math.acos(Math.max(-1, Math.min(1, y / r)));
  let phi = Math.atan2(z, x);
  if (phi < 0) phi += 2 * Math.PI;
  return { theta, phi };
}
