import { Canvas } from "@react-three/fiber";
import { Terrain } from "./Terrain";
import { CameraRig } from "./CameraRig";
import { TangentSpace } from "./TangentSpace";

export function ManifoldScene() {
  return (
    <Canvas
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 5, 0] }}
      style={{ position: "absolute", inset: 0 }}
      onPointerMissed={() => {
        // clicking empty space won't dispatch — handled by Terrain onPointerDown
      }}
    >
      <color attach="background" args={["#f0f0f0"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 80, 50]} intensity={0.8} />
      <CameraRig />
      <Terrain />
      <TangentSpace />
    </Canvas>
  );
}
