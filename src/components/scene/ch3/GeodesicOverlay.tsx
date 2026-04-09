import { useMemo } from "react";
import * as THREE from "three";
import { CurveLine, Arrow } from "../primitives";
import { geodesicSpray, integrateGeodesic } from "@/lib/geodesics";
import { sphereMetric } from "@/lib/sphere";
import { useAppState } from "@/stores/app-store";

export function GeodesicOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;
  const mode = state.ch3GeodesicMode;
  const count = state.ch3GeodesicCount;
  const tangentDir = state.ch3TangentDirection;

  const sprayData = useMemo(() => {
    if (!point || mode !== "spray") return null;
    console.log("geodesicSpray START", { theta: point.theta, phi: point.phi, epsilon, count });
    console.time("geodesicSpray");
    const result = geodesicSpray(point.theta, point.phi, epsilon, count);
    console.timeEnd("geodesicSpray");
    console.log("geodesicSpray END, curves:", result.length, "points per curve:", result[0]?.geodesic.points3D.length);
    return result;
  }, [point, epsilon, count, mode]);

  const singleData = useMemo(() => {
    if (!point || mode !== "single" || !tangentDir) return null;
    const [g11, g12, g22] = sphereMetric(point.theta, point.phi, epsilon);
    // Normalize tangent direction to unit speed
    const [a, b] = tangentDir;
    const norm2 = g11 * a * a + 2 * g12 * a * b + g22 * b * b;
    const norm = Math.sqrt(norm2);
    if (norm < 1e-10) return null;
    return integrateGeodesic(
      point.theta,
      point.phi,
      a / norm,
      b / norm,
      epsilon,
      250,
      0.015,
    );
  }, [point, epsilon, tangentDir, mode]);

  if (!point) return null;

  return (
    <group>
      {/* Spray mode */}
      {sprayData &&
        sprayData.map(({ geodesic, hue }, idx) => {
          if (geodesic.points3D.length < 2) return null;
          const color = new THREE.Color().setHSL(hue, 0.8, 0.45);
          const colors = geodesic.points3D.map(() => color.clone());
          return (
            <CurveLine
              key={idx}
              points={geodesic.points3D}
              colors={colors}
              renderOrder={5}
              radius={0.006}
            />
          );
        })}

      {/* Single mode */}
      {singleData && (() => {
        const color = new THREE.Color(0x22aa44);
        const colors = singleData.points3D.map(() => color.clone());
        // Show velocity arrows at intervals
        const arrowInterval = 30;
        const arrows: { origin: THREE.Vector3; dir: THREE.Vector3 }[] = [];
        for (let i = 0; i < singleData.points3D.length; i += arrowInterval) {
          if (i + 1 >= singleData.points3D.length) break;
          const p = singleData.points3D[i];
          const pn = singleData.points3D[Math.min(i + 3, singleData.points3D.length - 1)];
          const dir = new THREE.Vector3(pn[0] - p[0], pn[1] - p[1], pn[2] - p[2]).normalize();
          arrows.push({ origin: new THREE.Vector3(...p), dir });
        }
        return (
          <>
            <CurveLine
              points={singleData.points3D}
              colors={colors}
              renderOrder={5}
              radius={0.008}
            />
            {arrows.map((a, i) => (
              <Arrow
                key={i}
                origin={a.origin}
                direction={a.dir}
                color="#22aa44"
                length={0.12}
              />
            ))}
          </>
        );
      })()}
    </group>
  );
}
