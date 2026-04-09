import { useMemo } from "react";
import * as THREE from "three";
import { CurveLine, Arrow } from "../primitives";
import { holonomyLoop } from "@/lib/parallel-transport";
import { useAppState } from "@/stores/app-store";

const LEG_COLORS = ["#cc4444", "#4488cc", "#888888"] as const;

export function ParallelTransportOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;
  const loopSize = state.ch3LoopSize;

  const result = useMemo(() => {
    if (!point) return null;
    const maxSize = Math.min(loopSize, point.theta - 0.05, Math.PI - point.theta - 0.05);
    if (maxSize < 0.05) return null;
    console.time("holonomyLoop");
    const r = holonomyLoop(point.theta, point.phi, maxSize, epsilon);
    console.timeEnd("holonomyLoop");
    return r;
  }, [point, loopSize, epsilon]);

  if (!point || !result) return null;

  // Show transported vectors along each leg (every few points)
  const vectorInterval = 5;

  return (
    <group>
      {/* Loop legs */}
      {result.legs.map((leg, legIdx) => {
        const color = new THREE.Color(LEG_COLORS[legIdx]);
        const colors = leg.points3D.map(() => color.clone());
        return (
          <CurveLine
            key={`leg-${legIdx}`}
            points={leg.points3D}
            colors={colors}
            renderOrder={6}
            radius={0.008}
          />
        );
      })}

      {/* Transported vectors along the path */}
      {result.legs.map((leg, legIdx) =>
        leg.vectors3D
          .filter((_, i) => i % vectorInterval === 0)
          .map((v, i) => {
            const ptIdx = i * vectorInterval;
            const p = leg.points3D[ptIdx];
            const dir = new THREE.Vector3(v[0], v[1], v[2]);
            const len = dir.length();
            if (len < 1e-10) return null;
            dir.normalize();
            // Color gradient: cyan to magenta along transport
            const progress =
              (legIdx + ptIdx / leg.points3D.length) / result.legs.length;
            const color = new THREE.Color().setHSL(
              0.5 - progress * 0.3,
              0.7,
              0.45,
            );
            return (
              <Arrow
                key={`v-${legIdx}-${i}`}
                origin={new THREE.Vector3(...p)}
                direction={dir}
                color={"#" + color.getHexString()}
                length={0.1}
              />
            );
          }),
      )}

      {/* Initial vector (solid, at start) */}
      <Arrow
        origin={new THREE.Vector3(...result.legs[0].points3D[0])}
        direction={
          new THREE.Vector3(...result.initialVector3D).normalize()
        }
        color="#00cccc"
        length={0.12}
      />

      {/* Final vector (at same point, different color) */}
      <Arrow
        origin={new THREE.Vector3(...result.legs[0].points3D[0])}
        direction={
          new THREE.Vector3(...result.finalVector3D).normalize()
        }
        color="#cc00cc"
        length={0.12}
      />
    </group>
  );
}
