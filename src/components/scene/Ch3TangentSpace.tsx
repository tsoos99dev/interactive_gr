import { useMemo } from "react";
import * as THREE from "three";
import { Arrow } from "./primitives";
import { useAppState } from "@/stores/app-store";

export function Ch3TangentSpace() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;

  // One grid cell = π/24 radians
  const CELL = Math.PI / 24;

  const arrows = useMemo(() => {
    if (!point) return null;
    const origin = new THREE.Vector3(...point.position);
    const eT = new THREE.Vector3(...point.eTheta);
    const eP = new THREE.Vector3(...point.ePhi);
    // Arrow lengths = one grid cell in each direction
    const lenTheta = eT.length() * CELL;
    const lenPhi = eP.length() * CELL;
    return {
      origin,
      eTheta: eT.normalize(),
      ePhi: eP.normalize(),
      lenTheta,
      lenPhi,
    };
  }, [point]);

  if (!arrows) return null;

  return (
    <group>
      <Arrow
        origin={arrows.origin}
        direction={arrows.eTheta}
        color="#cc3333"
        length={arrows.lenTheta}
      />
      <Arrow
        origin={arrows.origin}
        direction={arrows.ePhi}
        color="#3366cc"
        length={arrows.lenPhi}
      />
      <mesh position={arrows.origin}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#222222" depthTest={false} />
      </mesh>
    </group>
  );
}
