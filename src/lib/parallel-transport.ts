import { spherePosition, sphereChristoffel, sphereBasis } from "./sphere";

export interface TransportResult {
  /** 3D positions along the path */
  points3D: [number, number, number][];
  /** Coordinate positions (θ, φ) */
  coords: [number, number][];
  /** Transported vector at each point (coordinate components vθ, vφ) */
  vectors: [number, number][];
  /** 3D transported vectors at each point */
  vectors3D: [number, number, number][];
}

/**
 * Parallel transport a vector along a path defined by coordinate points.
 * Transport equation: dV^k/dt + Γ^k_ij V^i (dx^j/dt) = 0
 */
export function transportAlongPath(
  path: [number, number][],
  V0: [number, number],
  epsilon: number,
): TransportResult {
  const points3D: [number, number, number][] = [];
  const coords: [number, number][] = [];
  const vectors: [number, number][] = [];
  const vectors3D: [number, number, number][] = [];

  let vt = V0[0];
  let vp = V0[1];

  for (let i = 0; i < path.length; i++) {
    const [theta, phi] = path[i];
    points3D.push(spherePosition(theta, phi, epsilon));
    coords.push([theta, phi]);
    vectors.push([vt, vp]);

    // Convert coordinate vector to 3D
    const { eTheta, ePhi } = sphereBasis(theta, phi, epsilon);
    vectors3D.push([
      vt * eTheta[0] + vp * ePhi[0],
      vt * eTheta[1] + vp * ePhi[1],
      vt * eTheta[2] + vp * ePhi[2],
    ]);

    // Transport step
    if (i < path.length - 1) {
      const [nextTheta, nextPhi] = path[i + 1];
      const dTheta = nextTheta - theta;
      const dPhi = nextPhi - phi;

      const [G0_00, G0_01, G0_11, G1_00, G1_01, G1_11] = sphereChristoffel(theta, phi, epsilon);

      // dV^k = -Γ^k_ij V^i dx^j
      const dvt = -(
        G0_00 * vt * dTheta +
        G0_01 * (vt * dPhi + vp * dTheta) +
        G0_11 * vp * dPhi
      );
      const dvp = -(
        G1_00 * vt * dTheta +
        G1_01 * (vt * dPhi + vp * dTheta) +
        G1_11 * vp * dPhi
      );

      vt += dvt;
      vp += dvp;
    }
  }

  return { points3D, coords, vectors, vectors3D };
}

export interface HolonomyResult {
  /** Three legs of the loop, each a TransportResult */
  legs: TransportResult[];
  /** Angle of rotation (radians) */
  holonomyAngle: number;
  /** Initial vector (3D) */
  initialVector3D: [number, number, number];
  /** Final vector (3D) */
  finalVector3D: [number, number, number];
}

/**
 * Compute holonomy around a coordinate-aligned triangular loop.
 * Leg 1: walk along θ by +size
 * Leg 2: walk along φ by +size
 * Leg 3: walk diagonally back to start
 */
export function holonomyLoop(
  theta0: number,
  phi0: number,
  size: number,
  epsilon: number,
): HolonomyResult {
  const substeps = 40;

  // Build path for each leg
  const leg1Path: [number, number][] = [];
  for (let i = 0; i <= substeps; i++) {
    leg1Path.push([theta0 + (size * i) / substeps, phi0]);
  }

  const theta1 = theta0 + size;
  const leg2Path: [number, number][] = [];
  for (let i = 0; i <= substeps; i++) {
    leg2Path.push([theta1, phi0 + (size * i) / substeps]);
  }

  const phi1 = phi0 + size;
  const leg3Path: [number, number][] = [];
  for (let i = 0; i <= substeps; i++) {
    const t = i / substeps;
    leg3Path.push([theta1 * (1 - t) + theta0 * t, phi1 * (1 - t) + phi0 * t]);
  }

  // Initial vector: unit vector along eTheta
  const { eTheta } = sphereBasis(theta0, phi0, epsilon);
  const len = Math.sqrt(eTheta[0] ** 2 + eTheta[1] ** 2 + eTheta[2] ** 2);
  const V0: [number, number] = [1 / len, 0]; // unit speed along theta

  // Transport along each leg
  const r1 = transportAlongPath(leg1Path, V0, epsilon);
  const endV1 = r1.vectors[r1.vectors.length - 1];

  const r2 = transportAlongPath(leg2Path, endV1, epsilon);
  const endV2 = r2.vectors[r2.vectors.length - 1];

  const r3 = transportAlongPath(leg3Path, endV2, epsilon);

  // Compute holonomy angle between initial and final 3D vectors
  const initial3D = r1.vectors3D[0];
  const final3D = r3.vectors3D[r3.vectors3D.length - 1];

  const dotProd =
    initial3D[0] * final3D[0] +
    initial3D[1] * final3D[1] +
    initial3D[2] * final3D[2];
  const magI = Math.sqrt(initial3D[0] ** 2 + initial3D[1] ** 2 + initial3D[2] ** 2);
  const magF = Math.sqrt(final3D[0] ** 2 + final3D[1] ** 2 + final3D[2] ** 2);

  // Use cross product for signed angle
  const cross = [
    initial3D[1] * final3D[2] - initial3D[2] * final3D[1],
    initial3D[2] * final3D[0] - initial3D[0] * final3D[2],
    initial3D[0] * final3D[1] - initial3D[1] * final3D[0],
  ];
  const normal = sphereBasis(theta0, phi0, epsilon);
  const normalVec = [
    normal.eTheta[1] * normal.ePhi[2] - normal.eTheta[2] * normal.ePhi[1],
    normal.eTheta[2] * normal.ePhi[0] - normal.eTheta[0] * normal.ePhi[2],
    normal.eTheta[0] * normal.ePhi[1] - normal.eTheta[1] * normal.ePhi[0],
  ];
  const crossDotN = cross[0] * normalVec[0] + cross[1] * normalVec[1] + cross[2] * normalVec[2];
  const cosAngle = Math.max(-1, Math.min(1, dotProd / (magI * magF)));
  const angle = Math.sign(crossDotN) * Math.acos(cosAngle);

  return {
    legs: [r1, r2, r3],
    holonomyAngle: angle,
    initialVector3D: initial3D,
    finalVector3D: final3D,
  };
}
