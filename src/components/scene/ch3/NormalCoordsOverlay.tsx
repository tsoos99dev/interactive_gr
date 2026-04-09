import { useMemo } from "react";
import * as THREE from "three";
import { CurveLine } from "../primitives";
import { normalCoordGrid } from "@/lib/normal-coords";
import { useAppState } from "@/stores/app-store";

const XI1_COLOR = new THREE.Color(0.7, 0.25, 0.25); // reddish
const XI2_COLOR = new THREE.Color(0.25, 0.35, 0.7); // bluish

export function NormalCoordsOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;

  const grid = useMemo(() => {
    if (!point) return null;
    console.time("normalCoordGrid");
    const result = normalCoordGrid(point.theta, point.phi, epsilon, 15, 40, 0.4, 100);
    console.timeEnd("normalCoordGrid");
    return result;
  }, [point, epsilon]);

  if (!grid) return null;

  return (
    <group>
      {/* ξ¹ lines (constant ξ¹, red) */}
      {grid.xi1Lines.map((line, idx) => {
        if (line.length < 2) return null;
        const t = idx / (grid.xi1Lines.length - 1);
        const alpha = 1 - 0.5 * Math.abs(t - 0.5) * 2; // brighter near center
        const color = XI1_COLOR.clone().multiplyScalar(0.5 + 0.5 * alpha);
        return (
          <CurveLine
            key={`xi1-${idx}`}
            points={line}
            colors={line.map(() => color.clone())}
            renderOrder={4}
            radius={0.004}
          />
        );
      })}

      {/* ξ² lines (constant ξ², blue) */}
      {grid.xi2Lines.map((line, idx) => {
        if (line.length < 2) return null;
        const t = idx / (grid.xi2Lines.length - 1);
        const alpha = 1 - 0.5 * Math.abs(t - 0.5) * 2;
        const color = XI2_COLOR.clone().multiplyScalar(0.5 + 0.5 * alpha);
        return (
          <CurveLine
            key={`xi2-${idx}`}
            points={line}
            colors={line.map(() => color.clone())}
            renderOrder={4}
            radius={0.004}
          />
        );
      })}
    </group>
  );
}
