import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { SphereMesh } from "./SphereMesh";
import { Ch3TangentSpace } from "./Ch3TangentSpace";
import { GeodesicOverlay } from "./ch3/GeodesicOverlay";
import { ParallelTransportOverlay } from "./ch3/ParallelTransportOverlay";
import { CovariantDerivOverlay } from "./ch3/CovariantDerivOverlay";
import { GeodesicDeviationOverlay } from "./ch3/GeodesicDeviationOverlay";
import { NormalCoordsOverlay } from "./ch3/NormalCoordsOverlay";
import { useAppState } from "@/stores/app-store";

export function Ch3Scene() {
  const state = useAppState();

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 1.2, 3.0]}
        fov={50}
        near={0.01}
        far={100}
      />
      <OrbitControls
        enablePan={false}
        minDistance={1.8}
        maxDistance={6}
        target={[0, 0, 0]}
        rotateSpeed={0.5}
      />
      <SphereMesh />
      <Ch3TangentSpace />
      {state.ch3ShowGeodesics && <GeodesicOverlay />}
      {state.ch3ShowParallelTransport && <ParallelTransportOverlay />}
      {state.ch3ShowCovariantDeriv && <CovariantDerivOverlay />}
      {state.ch3ShowDeviation && <GeodesicDeviationOverlay />}
      {state.ch3ShowNormalCoords && <NormalCoordsOverlay />}
    </>
  );
}
