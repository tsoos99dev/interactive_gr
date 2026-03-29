/**
 * Atlas of coordinate charts covering the manifold.
 *
 * Each chart defines a diffeomorphism φ: U ⊂ M → R² from a patch of the
 * manifold into a coordinate plane, and its inverse φ⁻¹: R² → U.
 *
 * The coordinate systems are deliberately non-trivial curvilinear systems
 * so the minimap shows genuinely curved coordinate grids.
 */

export interface Chart {
  name: string;
  label: string;
  /** Center of the chart patch on the manifold (x, z) */
  center: [number, number];
  /** Radius of coverage on the manifold */
  radius: number;
  /** Forward map: manifold point (x,z) → chart coordinates (u,v) */
  forward: (x: number, z: number) => [number, number];
  /** Inverse map: chart coordinates (u,v) → manifold point (x,z) */
  inverse: (u: number, v: number) => [number, number];
  /** Color used to tint this chart's boundary on the terrain */
  color: string;
}

// Chart A: "Twisted" coordinates centered at origin
// A rotation that increases with distance — coordinate lines spiral
const TWIST_RATE = 0.06;

const chartA: Chart = {
  name: "twisted",
  label: "φ₁ Twisted",
  center: [0, 0],
  radius: 40,
  color: "#6688bb",
  forward(x, z) {
    const cx = 0, cz = 0;
    const dx = x - cx, dz = z - cz;
    const r = Math.sqrt(dx * dx + dz * dz);
    const theta = Math.atan2(dz, dx);
    const twisted = theta + TWIST_RATE * r;
    return [r * Math.cos(twisted), r * Math.sin(twisted)];
  },
  inverse(u, v) {
    const r = Math.sqrt(u * u + v * v);
    const thetaTwisted = Math.atan2(v, u);
    const theta = thetaTwisted - TWIST_RATE * r;
    return [r * Math.cos(theta), r * Math.sin(theta)];
  },
};

// Chart B: "Exponential" coordinates centered at (45, 30)
// Logarithmic radial compression — center is magnified, edges compressed
const chartB: Chart = {
  name: "logarithmic",
  label: "φ₂ Logarithmic",
  center: [45, 30],
  radius: 40,
  color: "#bb7744",
  forward(x, z) {
    const cx = 45, cz = 30;
    const dx = x - cx, dz = z - cz;
    const r = Math.sqrt(dx * dx + dz * dz);
    const theta = Math.atan2(dz, dx);
    const rMapped = Math.sign(r) * Math.log(1 + r) * 8;
    return [rMapped * Math.cos(theta), rMapped * Math.sin(theta)];
  },
  inverse(u, v) {
    const rMapped = Math.sqrt(u * u + v * v);
    const theta = Math.atan2(v, u);
    const r = Math.exp(rMapped / 8) - 1;
    return [45 + r * Math.cos(theta), 30 + r * Math.sin(theta)];
  },
};

// Chart C: "Sinusoidal" / wavy coordinates centered at (-40, 20)
// Coordinate lines are wavy — a shearing deformation
const WAVE_AMP = 3.0;
const WAVE_FREQ = 0.15;

const chartC: Chart = {
  name: "sinusoidal",
  label: "φ₃ Sinusoidal",
  center: [-40, 20],
  radius: 40,
  color: "#88aa55",
  forward(x, z) {
    const cx = -40, cz = 20;
    const dx = x - cx, dz = z - cz;
    return [
      dx + WAVE_AMP * Math.sin(WAVE_FREQ * dz),
      dz + WAVE_AMP * Math.sin(WAVE_FREQ * dx),
    ];
  },
  inverse(u, v) {
    // Newton iteration to invert (3 steps is plenty)
    let dx = u, dz = v;
    for (let i = 0; i < 5; i++) {
      const fu = dx + WAVE_AMP * Math.sin(WAVE_FREQ * dz) - u;
      const fv = dz + WAVE_AMP * Math.sin(WAVE_FREQ * dx) - v;
      // Jacobian: [[1, A*k*cos(k*dz)], [A*k*cos(k*dx), 1]]
      const j00 = 1;
      const j01 = WAVE_AMP * WAVE_FREQ * Math.cos(WAVE_FREQ * dz);
      const j10 = WAVE_AMP * WAVE_FREQ * Math.cos(WAVE_FREQ * dx);
      const j11 = 1;
      const det = j00 * j11 - j01 * j10;
      dx -= (j11 * fu - j01 * fv) / det;
      dz -= (-j10 * fu + j00 * fv) / det;
    }
    return [-40 + dx, 20 + dz];
  },
};

// Chart D: "Skewed" coordinates centered at (20, -40)
// A gentle linear shear — coordinate axes are non-orthogonal
const SKEW = 0.4;

const chartD: Chart = {
  name: "skewed",
  label: "φ₄ Skewed",
  center: [20, -40],
  radius: 40,
  color: "#aa5588",
  forward(x, z) {
    const dx = x - 20, dz = z - (-40);
    return [dx + SKEW * dz, dz + SKEW * dx];
  },
  inverse(u, v) {
    // Invert the linear map [[1, s], [s, 1]]
    const det = 1 - SKEW * SKEW;
    const dx = (u - SKEW * v) / det;
    const dz = (v - SKEW * u) / det;
    return [20 + dx, -40 + dz];
  },
};

export const atlas: Chart[] = [chartA, chartB, chartC, chartD];

/** Check if a point is inside a chart's domain */
export function isInChart(chart: Chart, x: number, z: number): boolean {
  const dx = x - chart.center[0];
  const dz = z - chart.center[1];
  return dx * dx + dz * dz < chart.radius * chart.radius;
}

/** Distance from point to chart center, normalized by radius (0 = center, 1 = edge) */
export function chartDistance(chart: Chart, x: number, z: number): number {
  const dx = x - chart.center[0];
  const dz = z - chart.center[1];
  return Math.sqrt(dx * dx + dz * dz) / chart.radius;
}

/**
 * Pick the active chart with hysteresis: stay in current chart while inside it,
 * switch only when we leave it (picking the best alternative).
 * Returns null if outside all charts.
 */
export function pickChart(
  x: number,
  z: number,
  current: Chart | null
): Chart | null {
  // Stay in current chart if still inside
  if (current && isInChart(current, x, z)) {
    return current;
  }
  // Find the chart we're most centrally inside
  let best: Chart | null = null;
  let bestNormDist = Infinity;
  for (const chart of atlas) {
    const nd = chartDistance(chart, x, z);
    if (nd < 1 && nd < bestNormDist) {
      bestNormDist = nd;
      best = chart;
    }
  }
  return best;
}

/** Return all charts that contain point (x, z) */
export function chartsContaining(x: number, z: number): Chart[] {
  return atlas.filter((c) => isInChart(c, x, z));
}
