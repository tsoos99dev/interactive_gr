import { type FieldId } from "@/stores/app-store";
import { field } from "./curves";
import { scalarFunctions } from "./scalar-functions";
import { terrainSampler } from "./noise";
import { type Chart } from "./charts";
import { pushforwardBasis } from "./vector-fields";

/**
 * Get a vector field function (x,z) → [vx,vz] for the given field ID.
 */
export function getFieldFunction(
  id: FieldId
): (x: number, z: number) => [number, number] {
  if (id === "noise") return field;

  const scalarName = id.replace("grad-", "");
  const fn = scalarFunctions[scalarName];
  if (!fn) return field;

  return (x: number, z: number) => {
    const y = terrainSampler.height(x, z);
    const [gx, , gz] = fn.gradient(x, y, z);
    return [gx, gz];
  };
}

/**
 * RK4-integrate a field in the (x,z) plane, recording intermediate points.
 */
function integrateField(
  fieldFn: (x: number, z: number) => [number, number],
  x0: number,
  z0: number,
  epsilon: number,
  substeps: number
): [number, number][] {
  const dt = epsilon / substeps;
  const points: [number, number][] = [[x0, z0]];
  let x = x0;
  let z = z0;

  for (let i = 0; i < substeps; i++) {
    const [k1x, k1z] = fieldFn(x, z);
    const [k2x, k2z] = fieldFn(x + k1x * dt * 0.5, z + k1z * dt * 0.5);
    const [k3x, k3z] = fieldFn(x + k2x * dt * 0.5, z + k2z * dt * 0.5);
    const [k4x, k4z] = fieldFn(x + k3x * dt, z + k3z * dt);

    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    points.push([x, z]);
  }

  return points;
}

/** Negate a field function */
function negateField(
  fieldFn: (x: number, z: number) => [number, number]
): (x: number, z: number) => [number, number] {
  return (x, z) => {
    const [vx, vz] = fieldFn(x, z);
    return [-vx, -vz];
  };
}

export interface LieBracketResult {
  /** 4 legs of the parallelogram, each as 3D points */
  legs: {
    points: [number, number, number][];
    color: string;
  }[];
  /** The gap vector at the end (3D) */
  gap3D: [number, number, number];
  /** The bracket vector [X,Y] ≈ gap/ε² (3D) */
  bracket3D: [number, number, number];
  /** Bracket magnitude */
  bracketMag: number;
  /** Chart components of bracket (if chart available) */
  bracketChart: [number, number] | null;
  /** Start point in 3D */
  startPos: [number, number, number];
  /** End point in 3D (should be close to start if bracket is small) */
  endPos: [number, number, number];
}

/**
 * Compute the Lie bracket visualization at a point.
 * Flow along X by ε, then Y by ε, then -X by ε, then -Y by ε.
 * The gap ≈ ε²[X,Y].
 */
export function computeLieBracket(
  fieldXId: FieldId,
  fieldYId: FieldId,
  x0: number,
  z0: number,
  epsilon = 2.0,
  substeps = 15,
  chart?: Chart
): LieBracketResult {
  const fieldX = getFieldFunction(fieldXId);
  const fieldY = getFieldFunction(fieldYId);

  // Leg 1: flow along X
  const leg1XZ = integrateField(fieldX, x0, z0, epsilon, substeps);
  const [x1, z1] = leg1XZ[leg1XZ.length - 1];

  // Leg 2: flow along Y
  const leg2XZ = integrateField(fieldY, x1, z1, epsilon, substeps);
  const [x2, z2] = leg2XZ[leg2XZ.length - 1];

  // Leg 3: flow along -X
  const leg3XZ = integrateField(negateField(fieldX), x2, z2, epsilon, substeps);
  const [x3, z3] = leg3XZ[leg3XZ.length - 1];

  // Leg 4: flow along -Y
  const leg4XZ = integrateField(negateField(fieldY), x3, z3, epsilon, substeps);
  const [xEnd, zEnd] = leg4XZ[leg4XZ.length - 1];

  // Lift all legs to 3D
  const lift = (pts: [number, number][]): [number, number, number][] =>
    pts.map(([x, z]) => [x, terrainSampler.height(x, z), z]);

  const legs = [
    { points: lift(leg1XZ), color: "#dd3333" },    // X: red
    { points: lift(leg2XZ), color: "#3333dd" },    // Y: blue
    { points: lift(leg3XZ), color: "#882222" },    // -X: dark red
    { points: lift(leg4XZ), color: "#222288" },    // -Y: dark blue
  ];

  const y0 = terrainSampler.height(x0, z0);
  const yEnd = terrainSampler.height(xEnd, zEnd);
  const startPos: [number, number, number] = [x0, y0, z0];
  const endPos: [number, number, number] = [xEnd, yEnd, zEnd];

  // Gap = end - start
  const gapX = xEnd - x0;
  const gapY = yEnd - y0;
  const gapZ = zEnd - z0;
  const gap3D: [number, number, number] = [gapX, gapY, gapZ];

  // Bracket ≈ gap / ε²
  const eps2 = epsilon * epsilon;
  const bracket3D: [number, number, number] = [
    gapX / eps2,
    gapY / eps2,
    gapZ / eps2,
  ];
  const bracketMag = Math.sqrt(
    bracket3D[0] ** 2 + bracket3D[1] ** 2 + bracket3D[2] ** 2
  );

  // Convert to chart components if chart available
  let bracketChart: [number, number] | null = null;
  if (chart) {
    const [e1Raw, e2Raw] = pushforwardBasis(chart, x0, z0);
    // Solve bracket3D = a·e1Raw + b·e2Raw for (a,b) via least squares on 2 components
    // Using x and z components: [e1x e2x; e1z e2z] [a;b] = [bx; bz]
    const det =
      e1Raw[0] * e2Raw[2] - e1Raw[2] * e2Raw[0];
    if (Math.abs(det) > 0.0001) {
      bracketChart = [
        (bracket3D[0] * e2Raw[2] - bracket3D[2] * e2Raw[0]) / det,
        (e1Raw[0] * bracket3D[2] - e1Raw[2] * bracket3D[0]) / det,
      ];
    }
  }

  return {
    legs,
    gap3D,
    bracket3D,
    bracketMag,
    bracketChart,
    startPos,
    endPos,
  };
}
