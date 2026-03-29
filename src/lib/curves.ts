import { createNoise2D } from "simplex-noise";
import { terrainSampler } from "./noise";

/**
 * Generate a curve on the manifold passing through (x0, z0).
 * Uses a smooth vector field derived from a separate noise function,
 * integrated forward and backward via RK4.
 *
 * The vector field is deterministic and smooth, so nearby points
 * produce similar curves.
 */

// Separate noise for the vector field direction
const fieldNoise = createNoise2D(() => 0.42);
const fieldNoise2 = createNoise2D(() => 0.87);

const FIELD_SCALE = 0.04;

/** Smooth vector field on the (x,z) plane */
export function field(x: number, z: number): [number, number] {
  // Use two noise channels to get a smooth 2D direction
  const vx = fieldNoise(x * FIELD_SCALE, z * FIELD_SCALE);
  const vz = fieldNoise2(x * FIELD_SCALE, z * FIELD_SCALE);
  const len = Math.sqrt(vx * vx + vz * vz);
  if (len < 0.001) return [1, 0];
  return [vx / len, vz / len];
}

/** RK4 step for the vector field */
function rk4Step(
  x: number,
  z: number,
  dt: number
): [number, number] {
  const [k1x, k1z] = field(x, z);
  const [k2x, k2z] = field(x + k1x * dt * 0.5, z + k1z * dt * 0.5);
  const [k3x, k3z] = field(x + k2x * dt * 0.5, z + k2z * dt * 0.5);
  const [k4x, k4z] = field(x + k3x * dt, z + k3z * dt);

  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z),
  ];
}

export interface ManifoldCurve {
  /** 3D points on the surface: [x, y, z][] */
  points3D: [number, number, number][];
  /** 2D points on the (x,z) plane */
  pointsXZ: [number, number][];
  /** Unit-length tangent direction γ'(0) in 3D embedding coords */
  tangent3D: [number, number, number];
  /** |γ'(0)| before normalization (in embedding-space units per parameter unit) */
  tangentMagnitude: number;
  /** Chart-coordinate components [du/dt, dv/dt] (null if no chart) */
  tangentChart: [number, number] | null;
}

/**
 * Generate a curve passing through (x0, z0) on the manifold.
 * Integrates the vector field forward and backward.
 *
 * When a chart and its raw (unnormalized) basis vectors are provided,
 * the tangent γ'(0) is computed as d(x^μ)/dt in chart coordinates,
 * then reconstructed in the 3D embedding via the pushforward.
 */
export function generateCurve(
  x0: number,
  z0: number,
  chart?: { forward: (x: number, z: number) => [number, number] },
  e1Raw?: [number, number, number],
  e2Raw?: [number, number, number],
  steps = 150,
  dt = 0.2
): ManifoldCurve {
  const forwardXZ: [number, number][] = [[x0, z0]];
  const backwardXZ: [number, number][] = [];

  // Integrate forward
  let x = x0,
    z = z0;
  for (let i = 0; i < steps; i++) {
    [x, z] = rk4Step(x, z, dt);
    forwardXZ.push([x, z]);
  }

  // Integrate backward
  x = x0;
  z = z0;
  for (let i = 0; i < steps; i++) {
    [x, z] = rk4Step(x, z, -dt);
    backwardXZ.push([x, z]);
  }

  // Combine: backward (reversed) + forward
  backwardXZ.reverse();
  const pointsXZ = [...backwardXZ, ...forwardXZ];

  // Lift to 3D
  const points3D = pointsXZ.map(
    ([px, pz]) =>
      [px, terrainSampler.height(px, pz), pz] as [number, number, number]
  );

  // Compute tangent γ'(0) via central difference at the midpoint
  const mid = backwardXZ.length; // index of (x0, z0) in the combined array
  const ip = Math.min(mid + 1, pointsXZ.length - 1);
  const im = Math.max(mid - 1, 0);

  let tangent3D: [number, number, number];
  let tangentMagnitude: number;
  let tangentChart: [number, number] | null = null;

  if (chart && e1Raw && e2Raw) {
    // GR-style: compute tangent components in chart coordinates dxᵘ/dt
    const [u_p, v_p] = chart.forward(pointsXZ[ip][0], pointsXZ[ip][1]);
    const [u_m, v_m] = chart.forward(pointsXZ[im][0], pointsXZ[im][1]);
    const dudt = (u_p - u_m) / ((ip - im) * dt);
    const dvdt = (v_p - v_m) / ((ip - im) * dt);
    tangentChart = [dudt, dvdt];

    // Reconstruct 3D tangent via pushforward: γ'= (du/dt)·∂φ⁻¹/∂u + (dv/dt)·∂φ⁻¹/∂v
    const tx = dudt * e1Raw[0] + dvdt * e2Raw[0];
    const ty = dudt * e1Raw[1] + dvdt * e2Raw[1];
    const tz = dudt * e1Raw[2] + dvdt * e2Raw[2];
    tangentMagnitude = Math.sqrt(tx * tx + ty * ty + tz * tz);
    tangent3D = tangentMagnitude > 0.001
      ? [tx / tangentMagnitude, ty / tangentMagnitude, tz / tangentMagnitude]
      : [1, 0, 0];
  } else {
    // Fallback: embedding-coordinate finite difference (per parameter unit)
    const dx = (points3D[ip][0] - points3D[im][0]) / ((ip - im) * dt);
    const dy = (points3D[ip][1] - points3D[im][1]) / ((ip - im) * dt);
    const dz = (points3D[ip][2] - points3D[im][2]) / ((ip - im) * dt);
    tangentMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
    tangent3D = tangentMagnitude > 0.001
      ? [dx / tangentMagnitude, dy / tangentMagnitude, dz / tangentMagnitude]
      : [1, 0, 0];
  }

  return { points3D, pointsXZ, tangent3D, tangentMagnitude, tangentChart };
}
