import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { Terrain } from "./Terrain";
import { CameraRig } from "./CameraRig";
import { TangentSpace } from "./TangentSpace";
import { VectorFieldOverlay } from "./VectorFieldOverlay";
import { MetricOverlay } from "./MetricOverlay";
import { LieBracketOverlay } from "./LieBracketOverlay";
import { Ch3Scene } from "./Ch3Scene";
import { useAppState } from "@/stores/app-store";

const createRenderer = (async (props: any) => {
  const renderer = new WebGPURenderer({
    canvas: props.canvas,
    antialias: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  await renderer.init();
  return renderer;
}) as any;

function Chapter2Content() {
  const state = useAppState();
  return (
    <>
      <CameraRig />
      <Terrain />
      <TangentSpace />
      {state.showVectorField && <VectorFieldOverlay />}
      {state.showMetricTensor && <MetricOverlay />}
      {state.showLieBracket && <LieBracketOverlay />}
    </>
  );
}

function SceneContent() {
  const state = useAppState();
  return (
    <>
      <color attach="background" args={["#f8f8f8"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 80, 50]} intensity={0.8} />
      {state.activeScene === "chapter2" && <Chapter2Content />}
      {state.activeScene === "chapter3" && <Ch3Scene />}
    </>
  );
}

export function ManifoldScene() {
  return (
    <Canvas
      gl={createRenderer}
      flat
      camera={{ fov: 70, near: 0.1, far: 500, position: [0, 5, 0] }}
      style={{ position: "absolute", inset: 0 }}
      onPointerMissed={() => {
        // clicking empty space won't dispatch — handled by Terrain onPointerDown
      }}
    >
      <SceneContent />
    </Canvas>
  );
}
