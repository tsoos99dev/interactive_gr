import { spherePosition, christoffelAccel, sphereMetric } from "./sphere";

export interface GeodesicResult {
  points3D: [number, number, number][];
  coords: [number, number][];
  velocities: [number, number][];
}

/**
 * Integrate a geodesic using RK4.
 * Integrates in coordinate space, then lifts to 3D at the end.
 */
export function integrateGeodesic(
  theta0: number,
  phi0: number,
  vTheta0: number,
  vPhi0: number,
  epsilon: number,
  steps: number,
  dt: number,
): GeodesicResult {
  const coords: [number, number][] = [];
  const velocities: [number, number][] = [];

  let theta = theta0;
  let phi = phi0;
  let vt = vTheta0;
  let vp = vPhi0;

  coords.push([theta, phi]);
  velocities.push([vt, vp]);

  for (let i = 0; i < steps; i++) {
    const deriv = (
      t: number,
      p: number,
      dvt: number,
      dvp: number,
    ): [number, number, number, number] => {
      const [at, ap] = christoffelAccel(t, p, dvt, dvp, epsilon);
      return [dvt, dvp, at, ap];
    };

    const k1 = deriv(theta, phi, vt, vp);
    const k2 = deriv(
      theta + k1[0] * dt * 0.5,
      phi + k1[1] * dt * 0.5,
      vt + k1[2] * dt * 0.5,
      vp + k1[3] * dt * 0.5,
    );
    const k3 = deriv(
      theta + k2[0] * dt * 0.5,
      phi + k2[1] * dt * 0.5,
      vt + k2[2] * dt * 0.5,
      vp + k2[3] * dt * 0.5,
    );
    const k4 = deriv(
      theta + k3[0] * dt,
      phi + k3[1] * dt,
      vt + k3[2] * dt,
      vp + k3[3] * dt,
    );

    const newTheta = theta + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    const newPhi = phi + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    const newVt = vt + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    const newVp = vp + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

    if (
      !isFinite(newTheta) ||
      !isFinite(newPhi) ||
      !isFinite(newVt) ||
      !isFinite(newVp)
    )
      break;

    theta = newTheta;
    phi = newPhi;
    vt = newVt;
    vp = newVp;

    if (theta < 0.01) {
      theta = 0.01;
      vt = Math.abs(vt);
    }
    if (theta > Math.PI - 0.01) {
      theta = Math.PI - 0.01;
      vt = -Math.abs(vt);
    }

    phi = ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    coords.push([theta, phi]);
    velocities.push([vt, vp]);
  }

  // Lift all points to 3D, offset slightly above surface so tubes don't clip
  const LIFT = 0.008;
  const points3D: [number, number, number][] = [];
  for (let i = 0; i < coords.length; i++) {
    const p = spherePosition(coords[i][0], coords[i][1], epsilon);
    // For a sphere at origin, outward normal ≈ normalize(p)
    const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
    const s = LIFT / len;
    points3D.push([p[0] + p[0] * s, p[1] + p[1] * s, p[2] + p[2] * s]);
  }

  return { points3D, coords, velocities };
}

/**
 * Shoot geodesics in equally-spaced directions from a point.
 */
export function geodesicSpray(
  theta0: number,
  phi0: number,
  epsilon: number,
  nDirs: number,
  radius: number = 3.5,
  steps: number = 350,
): { geodesic: GeodesicResult; hue: number }[] {
  const [g11, g12, g22] = sphereMetric(theta0, phi0, epsilon);

  // Build the same Gram-Schmidt orthonormal frame as NormalCoordsOverlay
  const lenTheta = Math.sqrt(g11);
  const cosAngle = g12 / (lenTheta * Math.sqrt(g22));
  const lenPhiPerp = Math.sqrt(g22 * (1 - cosAngle * cosAngle));
  const g12Factor = -g12 / (g11 * lenPhiPerp);

  // Match NormalCoordsOverlay parameterization: encode distance in velocity,
  // integrate over t ∈ [0, 1] so endpoints land at geodesic distance = radius.
  const dt = 1.0 / steps;

  const results: { geodesic: GeodesicResult; hue: number }[] = [];

  console.time("firstGeodesic");
  for (let i = 0; i < nDirs; i++) {
    if (i === 1) {
      console.timeEnd("firstGeodesic");
    }
    const angle = (2 * Math.PI * i) / nDirs;
    const xi1 = Math.cos(angle) * radius;
    const xi2 = Math.sin(angle) * radius;
    const vt = xi1 / lenTheta + xi2 * g12Factor;
    const vp = xi2 / lenPhiPerp;

    const geodesic = integrateGeodesic(
      theta0,
      phi0,
      vt,
      vp,
      epsilon,
      steps,
      dt,
    );
    results.push({ geodesic, hue: i / nDirs });
  }

  return results;
}
