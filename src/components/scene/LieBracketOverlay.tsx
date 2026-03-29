import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useAppState } from "@/stores/app-store";
import { computeLieBracket } from "@/lib/lie-bracket";
import { Arrow, CurveLine } from "./primitives";

const EPSILON = 2.0;

export function LieBracketOverlay() {
  const state = useAppState();
  const point = state.selectedPoint;
  const chart = state.currentChart;

  const result = useMemo(() => {
    if (!point) return null;
    const [x, , z] = point.position;
    return computeLieBracket(
      state.lieBracketFieldX,
      state.lieBracketFieldY,
      x,
      z,
      EPSILON,
      15,
      chart ?? undefined
    );
  }, [
    point?.position[0],
    point?.position[2],
    state.lieBracketFieldX,
    state.lieBracketFieldY,
    chart,
  ]);

  if (!point || !result) return null;

  const origin = new THREE.Vector3(...point.position);
  const endPos = new THREE.Vector3(...result.endPos);

  // Bracket arrow direction & length
  const bracketDir = new THREE.Vector3(...result.bracket3D);
  const bracketLen = result.bracketMag;

  return (
    <group>
      {/* 4 legs of the parallelogram */}
      {result.legs.map((leg, i) => {
        const c = new THREE.Color(leg.color);
        const colors = leg.points.map(() => c.clone());
        return (
          <CurveLine
            key={i}
            points={leg.points}
            colors={colors}
            renderOrder={6}
          />
        );
      })}

      {/* Bracket arrow at the selected point (it's a tangent vector at P) */}
      {bracketLen > 0.01 && (
        <>
          <Arrow
            origin={origin}
            direction={bracketDir.clone().normalize()}
            color="#ff8800"
            length={Math.min(bracketLen * 4, 3)}
          />
          <Html
            position={[
              origin.x + result.bracket3D[0] * 0.5,
              origin.y + result.bracket3D[1] * 0.5 + 0.3,
              origin.z + result.bracket3D[2] * 0.5,
            ]}
            style={{ pointerEvents: "none" }}
          >
            <span
              style={{
                color: "#ff8800",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "monospace",
                whiteSpace: "nowrap",
                textShadow: "0 0 4px rgba(255,255,255,0.9)",
              }}
            >
              [X, Y]
            </span>
          </Html>
        </>
      )}

      {/* Small marker at gap endpoint */}
      <mesh position={endPos}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ff8800" />
      </mesh>
    </group>
  );
}
