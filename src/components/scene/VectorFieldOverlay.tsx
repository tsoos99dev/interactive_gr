import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useAppState } from "@/stores/app-store";
import { sampleVectorField } from "@/lib/vector-fields";

const MAX_ARROWS = 400;
const ARROW_LENGTH = 1.5;
const FADE_NEAR = 10;
const FADE_FAR = 80;

/**
 * Arrow geometry centered at origin, pointing along +Y.
 * The shaft runs from -halfShaft to +halfShaft, head sits on top.
 * Total length = 1.0 (unit), scaled per-instance.
 */
function createArrowGeo(): THREE.BufferGeometry {
  const shaftRadius = 0.03;
  const headRadius = 0.08;
  const headLength = 0.25;
  const shaftLength = 1.0 - headLength;

  const shaft = new THREE.CylinderGeometry(
    shaftRadius,
    shaftRadius,
    shaftLength,
    6,
  );
  // Center shaft so the arrow base is at y=0, tip at y=1
  shaft.translate(0, shaftLength / 2, 0);

  const head = new THREE.ConeGeometry(headRadius, headLength, 6);
  head.translate(0, shaftLength + headLength / 2, 0);

  const merged = mergeGeometries([shaft, head]);
  if (!merged) throw new Error("Failed to merge arrow geometry");
  return merged;
}

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _color = new THREE.Color();
const _baseColor = new THREE.Color(0.15, 0.5, 0.15);
const _bgColor = new THREE.Color(0.97, 0.97, 0.97); // match page background

export function VectorFieldOverlay() {
  const state = useAppState();
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  const arrowGeo = useMemo(() => createArrowGeo(), []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        depthWrite: false,
      }),
    [],
  );

  // Compute samples once when chart/source/scalar changes
  const samples = useMemo(() => {
    const chart = state.currentChart;
    if (!chart) return [];
    return sampleVectorField(
      chart,
      state.vectorFieldSource,
      state.activeScalarFn,
      18,
    );
  }, [state.currentChart, state.vectorFieldSource, state.activeScalarFn]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const count = Math.min(samples.length, MAX_ARROWS);
    mesh.count = count;
    if (count === 0) return;

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    for (let i = 0; i < count; i++) {
      const s = samples[i];

      // Distance fade
      const dx = s.pos[0] - camX;
      const dy = s.pos[1] - camY;
      const dz = s.pos[2] - camZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distFade =
        1 -
        Math.max(0, Math.min(1, (dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));

      // Chart boundary fade
      const edgeFade = 1 - Math.pow(Math.max(s.distNorm - 0.6, 0) / 0.35, 2);
      const fade = distFade * edgeFade;

      // Scale by field magnitude and fade
      const length = fade > 0.01 ? Math.min(s.mag, 3) * ARROW_LENGTH * fade : 0;

      _dir.set(s.dir[0], s.dir[1], s.dir[2]);
      _dummy.position.set(s.pos[0], s.pos[1], s.pos[2]);
      _dummy.quaternion.setFromUnitVectors(_up, _dir);
      // Scale: length along the arrow axis, thin cross-section
      _dummy.scale.set(length, length, length);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      // Lerp color toward background for smooth fade
      _color.copy(_baseColor).lerp(_bgColor, 1 - fade);
      mesh.setColorAt(i, _color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[arrowGeo, material, MAX_ARROWS]}
      frustumCulled={false}
      renderOrder={5}
    />
  );
}
