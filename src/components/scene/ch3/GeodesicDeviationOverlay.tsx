import { useMemo } from "react";
import * as THREE from "three";
import { CurveLine } from "../primitives";
import { integrateGeodesic } from "@/lib/geodesics";
import { sphereMetric } from "@/lib/sphere";
import { useAppState } from "@/stores/app-store";

const BUNDLE_COUNT = 20;
const STEPS = 250;
const DT = 0.015;
const CROSS_STEP = Math.round(1.0 / DT); // every unit of affine parameter

export function GeodesicDeviationOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;
  const spread = state.ch3DeviationSpread;
  const tangentDir = state.ch3TangentDirection;

  const data = useMemo(() => {
    if (!point) return null;
    console.time("geodesicDeviation");

    const [g11, g12, g22] = sphereMetric(point.theta, point.phi, epsilon);

    let centralAngle = 0;
    if (tangentDir) {
      centralAngle = Math.atan2(tangentDir[1], tangentDir[0]);
    }

    // Integrate a dense bundle
    const geodesics: { points: [number, number, number][] }[] = [];

    for (let i = 0; i < BUNDLE_COUNT; i++) {
      const t = (i / (BUNDLE_COUNT - 1) - 0.5) * 2; // -1 to 1
      const angle = centralAngle + t * spread;

      const rawA = Math.cos(angle);
      const rawB = Math.sin(angle);
      const norm2 =
        g11 * rawA * rawA + 2 * g12 * rawA * rawB + g22 * rawB * rawB;
      const vt = rawA / Math.sqrt(norm2);
      const vp = rawB / Math.sqrt(norm2);

      const geo = integrateGeodesic(
        point.theta,
        point.phi,
        vt,
        vp,
        epsilon,
        STEPS,
        DT,
      );
      geodesics.push({ points: geo.points3D });
    }

    // Cross-lines: smooth curves through all geodesics at the same parameter
    const crossLines: {
      points: [number, number, number][];
      spread: number;
    }[] = [];

    for (let step = CROSS_STEP; step < STEPS; step += CROSS_STEP) {
      const pts: [number, number, number][] = [];
      for (let g = 0; g < geodesics.length; g++) {
        const p = geodesics[g].points[step];
        if (p) pts.push(p);
      }
      if (pts.length < 3) continue;

      // Spread = distance from first to last geodesic in the bundle
      const dx = pts[pts.length - 1][0] - pts[0][0];
      const dy = pts[pts.length - 1][1] - pts[0][1];
      const dz = pts[pts.length - 1][2] - pts[0][2];
      crossLines.push({ points: pts, spread: Math.sqrt(dx * dx + dy * dy + dz * dz) });
    }

    console.timeEnd("geodesicDeviation");
    return { geodesics, crossLines };
  }, [point, epsilon, spread, tangentDir]);

  if (!data) return null;

  const maxSpread = Math.max(...data.crossLines.map((c) => c.spread), 0.001);
  const geoColor = new THREE.Color(0.35, 0.35, 0.4);

  return (
    <group>
      {/* Dense geodesic bundle */}
      {data.geodesics.map(({ points }, idx) => (
        <CurveLine
          key={`geo-${idx}`}
          points={points}
          colors={points.map(() => geoColor.clone())}
          renderOrder={5}
          radius={0.003}
        />
      ))}

      {/* Smooth cross-lines at unit parameter intervals */}
      {data.crossLines.map(({ points, spread: sp }, idx) => {
        const t = Math.min(sp / maxSpread, 1);
        const color = new THREE.Color().setHSL(0.33 * (1 - t), 0.7, 0.45);
        return (
          <CurveLine
            key={`cross-${idx}`}
            points={points}
            colors={points.map(() => color.clone())}
            renderOrder={6}
            radius={0.004}
          />
        );
      })}
    </group>
  );
}
