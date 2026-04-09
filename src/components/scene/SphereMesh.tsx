import { useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { type ThreeEvent } from "@react-three/fiber";
import {
  spherePosition,
  sphereBasis,
  sphereNormal,
  cartesianToSpherical,
  warmNoiseCache,
  SPHERE_SEGMENTS_THETA,
  SPHERE_SEGMENTS_PHI,
} from "@/lib/sphere";
import { gaussianCurvature } from "@/lib/curvature";
import { createSphereMaterial } from "@/shaders/sphere-material";
import { useAppState, useAppDispatch } from "@/stores/app-store";

export function SphereMesh() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const meshRef = useRef<THREE.Mesh>(null);
  const epsilon = state.ch3Bumpiness;
  const showCurvature = state.ch3ShowCurvature;

  const { geometry, material } = useMemo(() => {
    console.time("sphereMesh");
    // Build noise cache upfront so all subsequent calls are fast
    warmNoiseCache(epsilon);
    const nTheta = SPHERE_SEGMENTS_THETA;
    const nPhi = SPHERE_SEGMENTS_PHI;
    const vertexCount = (nTheta + 1) * (nPhi + 1);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const curvatures = new Float32Array(vertexCount);
    const thetas = new Float32Array(vertexCount);
    const phis = new Float32Array(vertexCount);
    const indices: number[] = [];

    for (let i = 0; i <= nTheta; i++) {
      const theta = (i / nTheta) * Math.PI;
      for (let j = 0; j <= nPhi; j++) {
        const phi = (j / nPhi) * 2 * Math.PI;
        const idx = i * (nPhi + 1) + j;

        const pos = spherePosition(theta, phi, epsilon);
        positions[idx * 3] = pos[0];
        positions[idx * 3 + 1] = pos[1];
        positions[idx * 3 + 2] = pos[2];

        const n = sphereNormal(theta, phi, epsilon);
        normals[idx * 3] = n[0];
        normals[idx * 3 + 1] = n[1];
        normals[idx * 3 + 2] = n[2];

        thetas[idx] = theta;
        phis[idx] = phi;

        curvatures[idx] = gaussianCurvature(theta, phi, epsilon);
      }
    }

    for (let i = 0; i < nTheta; i++) {
      for (let j = 0; j < nPhi; j++) {
        const a = i * (nPhi + 1) + j;
        const b = a + nPhi + 1;
        indices.push(a, a + 1, b);
        indices.push(a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("aCurvature", new THREE.BufferAttribute(curvatures, 1));
    geo.setAttribute("aTheta", new THREE.BufferAttribute(thetas, 1));
    geo.setAttribute("aPhi", new THREE.BufferAttribute(phis, 1));
    geo.setIndex(indices);

    const mat = createSphereMaterial();
    mat.uniforms.showCurvature.value = showCurvature ? 1.0 : 0.0;
    console.timeEnd("sphereMesh");
    return { geometry: geo, material: mat.material };
  }, [epsilon, showCurvature]);

  const handleClick = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const p = e.point;
      const { theta, phi } = cartesianToSpherical(p.x, p.y, p.z);
      const { eTheta, ePhi } = sphereBasis(theta, phi, epsilon);
      const n = sphereNormal(theta, phi, epsilon);
      const pos = spherePosition(theta, phi, epsilon);
      dispatch({
        type: "SET_CH3_SELECTED_POINT",
        point: {
          theta,
          phi,
          position: pos,
          eTheta,
          ePhi,
          normal: n,
        },
      });
    },
    [dispatch, epsilon],
  );

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onPointerDown={handleClick}
    />
  );
}
