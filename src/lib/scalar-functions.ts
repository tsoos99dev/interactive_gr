export interface ScalarFunction {
  name: string;
  label: string;
  compute: (x: number, y: number, z: number) => number;
  /** Partial derivative: (df/dx, df/dy, df/dz) in embedding coords */
  gradient: (x: number, y: number, z: number) => [number, number, number];
  min: number;
  max: number;
}

/**
 * Scale factor applied to gradients so they're visually comparable to the
 * unit-length noise field.  The scalar functions vary slowly (frequencies
 * ~0.05–0.15), giving raw gradient magnitudes around 0.1.  Multiplying by
 * GRAD_SCALE brings them up to O(1).
 */
const GRAD_SCALE = 8;

export const scalarFunctions: Record<string, ScalarFunction> = {
  temperature: {
    name: "temperature",
    label: "f₁ Temperature",
    // Slowly varying warm/cool regions
    compute: (x, _y, z) =>
      Math.sin(0.08 * x + 0.3) * Math.cos(0.11 * z - 0.5) +
      0.5 * Math.sin(0.05 * x - 0.06 * z),
    gradient: (x, _y, z) => [
      GRAD_SCALE *
        (0.08 * Math.cos(0.08 * x + 0.3) * Math.cos(0.11 * z - 0.5) +
          0.5 * 0.05 * Math.cos(0.05 * x - 0.06 * z)),
      0,
      GRAD_SCALE *
        (Math.sin(0.08 * x + 0.3) * -0.11 * Math.sin(0.11 * z - 0.5) +
          0.5 * -0.06 * Math.cos(0.05 * x - 0.06 * z)),
    ],
    min: -1.5,
    max: 1.5,
  },
  pressure: {
    name: "pressure",
    label: "f₂ Pressure",
    // Concentric-ish ripples
    compute: (x, _y, z) => {
      const r = Math.sqrt(x * x + z * z) * 0.12;
      return Math.cos(r * 3.0 + 1.0) * Math.exp(-r * 0.3);
    },
    gradient: (x, _y, z) => {
      const r = Math.sqrt(x * x + z * z) * 0.12;
      const rSafe = Math.max(r, 0.001);
      const drdx = (x * 0.12 * 0.12) / rSafe;
      const drdz = (z * 0.12 * 0.12) / rSafe;
      const d =
        -Math.sin(r * 3.0 + 1.0) * 3.0 * Math.exp(-r * 0.3) +
        Math.cos(r * 3.0 + 1.0) * -0.3 * Math.exp(-r * 0.3);
      return [GRAD_SCALE * d * drdx, 0, GRAD_SCALE * d * drdz];
    },
    min: -1,
    max: 1,
  },
  density: {
    name: "density",
    label: "f₃ Density",
    // Diagonal wave pattern
    compute: (x, _y, z) =>
      Math.sin(0.15 * x + 0.1 * z) + 0.4 * Math.cos(0.2 * z - 0.08 * x + 2),
    gradient: (x, _y, z) => [
      GRAD_SCALE *
        (0.15 * Math.cos(0.15 * x + 0.1 * z) +
          0.4 * 0.08 * Math.sin(0.2 * z - 0.08 * x + 2)),
      0,
      GRAD_SCALE *
        (0.1 * Math.cos(0.15 * x + 0.1 * z) +
          0.4 * -0.2 * Math.sin(0.2 * z - 0.08 * x + 2)),
    ],
    min: -1.4,
    max: 1.4,
  },
};
