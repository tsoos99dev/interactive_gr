import { type Chart } from "./charts";
import { terrainSampler } from "./noise";
import { field } from "./curves";
import { scalarFunctions } from "./scalar-functions";
import { type VectorFieldSource, type ScalarFnName } from "@/stores/app-store";

export interface VectorFieldSample {
  /** 3D position on the manifold surface */
  pos: [number, number, number];
  /** 3D direction (unnormalized pushforward) */
  dir: [number, number, number];
  /** Magnitude of the direction vector */
  mag: number;
  /** 0 = center, 1 = edge — for fade */
  distNorm: number;
}

/**
 * Compute pushforward basis vectors at (x, z) given a chart.
 * Returns [e1Raw, e2Raw] — unnormalized ∂φ⁻¹/∂u, ∂φ⁻¹/∂v in 3D.
 */
export function pushforwardBasis(
  chart: Chart,
  x: number,
  z: number
): [[number, number, number], [number, number, number]] {
  const [u, v] = chart.forward(x, z);
  const eps = 0.05;

  const [xu1, zu1] = chart.inverse(u + eps, v);
  const [xu0, zu0] = chart.inverse(u - eps, v);
  const dxdu = (xu1 - xu0) / (2 * eps);
  const dzdu = (zu1 - zu0) / (2 * eps);
  const hx = terrainSampler.dhdx(x, z);
  const hz = terrainSampler.dhdz(x, z);
  const dhdu = hx * dxdu + hz * dzdu;

  const [xv1, zv1] = chart.inverse(u, v + eps);
  const [xv0, zv0] = chart.inverse(u, v - eps);
  const dxdv = (xv1 - xv0) / (2 * eps);
  const dzdv = (zv1 - zv0) / (2 * eps);
  const dhdv = hx * dxdv + hz * dzdv;

  return [
    [dxdu, dhdu, dzdu],
    [dxdv, dhdv, dzdv],
  ];
}

/**
 * Compute the forward Jacobian ∂(u,v)/∂(x,z) via finite differences on chart.forward.
 * Returns [[∂u/∂x, ∂u/∂z], [∂v/∂x, ∂v/∂z]].
 */
function forwardJacobian(
  chart: Chart,
  x: number,
  z: number
): [[number, number], [number, number]] {
  const eps = 0.05;
  const [u1, v1] = chart.forward(x + eps, z);
  const [u0, v0] = chart.forward(x - eps, z);
  const [u3, v3] = chart.forward(x, z + eps);
  const [u2, v2] = chart.forward(x, z - eps);
  return [
    [(u1 - u0) / (2 * eps), (u3 - u2) / (2 * eps)],
    [(v1 - v0) / (2 * eps), (v3 - v2) / (2 * eps)],
  ];
}

/**
 * Get (vx, vz) in the (x,z) plane for the given source.
 */
function getFieldXZ(
  source: VectorFieldSource,
  activeScalarFn: ScalarFnName,
  x: number,
  z: number
): [number, number] {
  if (source === "gradient") {
    const fn = scalarFunctions[activeScalarFn];
    const y = terrainSampler.height(x, z);
    const [gx, , gz] = fn.gradient(x, y, z);
    return [gx, gz];
  }
  return field(x, z);
}

export interface VectorFieldAtPoint {
  /** 3D direction (unit) */
  dir3D: [number, number, number];
  /** Chart components (V^u, V^v) */
  chartComponents: [number, number];
  /** Magnitude */
  mag: number;
}

/**
 * Evaluate the vector field at a single point, returning 3D direction and chart components.
 */
export function evaluateVectorFieldAt(
  chart: Chart,
  x: number,
  z: number,
  e1Raw: [number, number, number],
  e2Raw: [number, number, number],
  source: VectorFieldSource,
  activeScalarFn: ScalarFnName,
): VectorFieldAtPoint {
  const [vx, vz] = getFieldXZ(source, activeScalarFn, x, z);

  // Convert to chart components via forward Jacobian
  const [[dudx, dudz], [dvdx, dvdz]] = forwardJacobian(chart, x, z);
  const Vu = dudx * vx + dudz * vz;
  const Vv = dvdx * vx + dvdz * vz;

  // Pushforward to 3D using the provided basis
  const dirX = Vu * e1Raw[0] + Vv * e2Raw[0];
  const dirY = Vu * e1Raw[1] + Vv * e2Raw[1];
  const dirZ = Vu * e1Raw[2] + Vv * e2Raw[2];
  const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

  const dir3D: [number, number, number] =
    mag > 0.0001
      ? [dirX / mag, dirY / mag, dirZ / mag]
      : [1, 0, 0];

  return { dir3D, chartComponents: [Vu, Vv], mag };
}

/**
 * Sample the vector field on a fixed grid in manifold (x,z) space,
 * covering the chart domain.
 */
export function sampleVectorField(
  chart: Chart,
  source: VectorFieldSource,
  activeScalarFn: ScalarFnName,
  gridSize = 18
): VectorFieldSample[] {
  const samples: VectorFieldSample[] = [];

  // Fixed grid in manifold space covering the chart's circular domain
  const r = chart.radius * 0.9;
  const step = (2 * r) / (gridSize - 1);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = chart.center[0] - r + i * step;
      const z = chart.center[1] - r + j * step;

      // Check if within chart domain (circular)
      const dx = x - chart.center[0];
      const dz = z - chart.center[1];
      const distNorm = Math.sqrt(dx * dx + dz * dz) / chart.radius;
      if (distNorm > 0.92) continue;

      const y = terrainSampler.height(x, z);
      const [vx, vz] = getFieldXZ(source, activeScalarFn, x, z);

      // Convert to chart components via forward Jacobian
      const [[dudx, dudz], [dvdx, dvdz]] = forwardJacobian(chart, x, z);
      const Vu = dudx * vx + dudz * vz;
      const Vv = dvdx * vx + dvdz * vz;

      // Pushforward to 3D
      const [e1Raw, e2Raw] = pushforwardBasis(chart, x, z);
      const dirX = Vu * e1Raw[0] + Vv * e2Raw[0];
      const dirY = Vu * e1Raw[1] + Vv * e2Raw[1];
      const dirZ = Vu * e1Raw[2] + Vv * e2Raw[2];
      const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

      if (mag < 0.0001) continue;

      samples.push({
        pos: [x, y, z],
        dir: [dirX / mag, dirY / mag, dirZ / mag],
        mag,
        distNorm,
      });
    }
  }

  return samples;
}
