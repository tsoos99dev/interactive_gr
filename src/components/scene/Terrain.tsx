import { useRef, useMemo, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { generateTerrainGeometry } from "@/lib/terrain";
import { terrainSampler } from "@/lib/noise";
import { scalarFunctions } from "@/lib/scalar-functions";
import { atlas, isInChart, type Chart } from "@/lib/charts";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import vertexShader from "@/shaders/terrain.vert.glsl?raw";
import fragmentShader from "@/shaders/terrain.frag.glsl?raw";

const TERRAIN_SIZE = 300;
const RESOLUTION = 384;
const REGEN_THRESHOLD = 60;
const FOG_RADIUS = 35;
const FOG_FALLOFF = 12;
const BG_COLOR = new THREE.Color(0xf0f0f0);
const BASE_COLOR = new THREE.Color(0.92, 0.92, 0.92);
const CHART_GRID_SPACING = 5;

/** Compute per-vertex chart (u,v) coordinates for the active chart */
function computeChartAttrib(geometry: THREE.BufferGeometry, chart: Chart) {
  const posAttr = geometry.getAttribute("position");
  const count = posAttr.count;
  const coords = new Float32Array(count * 2);
  const inDomain = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    if (isInChart(chart, x, z)) {
      const [u, v] = chart.forward(x, z);
      coords[i * 2] = u;
      coords[i * 2 + 1] = v;
      inDomain[i] = 1.0;
    }
  }

  geometry.setAttribute("aChartCoord", new THREE.BufferAttribute(coords, 2));
  geometry.setAttribute("aChartInDomain", new THREE.BufferAttribute(inDomain, 1));
}

function clearChartAttrib(geometry: THREE.BufferGeometry) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    "aChartCoord",
    new THREE.BufferAttribute(new Float32Array(count * 2), 2)
  );
  geometry.setAttribute(
    "aChartInDomain",
    new THREE.BufferAttribute(new Float32Array(count), 1)
  );
}

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const chunkCenter = useRef<[number, number]>([0, 0]);
  const lastChartName = useRef<string>("");
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Create shader material ONCE — never recreated on re-render
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        uniforms: {
          uCameraWorldPos: { value: new THREE.Vector3(0, 5, 0) },
          uFogRadius: { value: FOG_RADIUS },
          uFogFalloff: { value: FOG_FALLOFF },
          uBaseColor: { value: BASE_COLOR },
          uFogColor: { value: BG_COLOR },
          uShowScalar: { value: false },
          uShowContours: { value: false },
          uScalarMin: { value: -8 },
          uScalarMax: { value: 8 },
          uShowWireframe: { value: false },
          uChartCenters: {
            value: atlas.map(
              (c) => new THREE.Vector4(c.center[0], c.center[1], 0, 0)
            ),
          },
          uChartRadii: { value: atlas.map((c) => c.radius) },
          uChartColors: {
            value: atlas.map((c) => new THREE.Color(c.color)),
          },
          uChartCount: { value: atlas.length },
          uActiveChartIdx: { value: 0 },
          uChartGridSpacing: { value: CHART_GRID_SPACING },
          uChartGridColor: { value: new THREE.Color(atlas[0].color) },
        },
      }),
    []
  );

  const geometry = useMemo(() => {
    const geo = generateTerrainGeometry(
      chunkCenter.current[0],
      chunkCenter.current[1],
      TERRAIN_SIZE,
      RESOLUTION
    );
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkCenter.current[0], chunkCenter.current[1]]);

  // Compute chart coordinate attribute
  useMemo(() => {
    if (state.currentChart) {
      computeChartAttrib(geometry, state.currentChart);
      lastChartName.current = state.currentChart.name;
    } else {
      clearChartAttrib(geometry);
      lastChartName.current = "";
    }
  }, [geometry, state.currentChart]);

  // Compute scalar attribute
  useMemo(() => {
    if (state.activeScalarFn === "none" || !state.showScalarOverlay) return;
    const fn = scalarFunctions[state.activeScalarFn];
    if (!fn) return;

    const posAttr = geometry.getAttribute("position");
    const count = posAttr.count;
    const scalars = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      scalars[i] = fn.compute(x, y, z);
    }

    geometry.setAttribute("aScalar", new THREE.BufferAttribute(scalars, 1));
  }, [geometry, state.activeScalarFn, state.showScalarOverlay]);

  useFrame((r3fState) => {
    const cam = r3fState.camera;
    const u = material.uniforms;

    // Update camera position for fog — this is the critical line
    u.uCameraWorldPos.value.set(cam.position.x, cam.position.y, cam.position.z);
    u.uShowScalar.value = state.showScalarOverlay && state.activeScalarFn !== "none";
    u.uShowContours.value = state.showContours;
    u.uShowWireframe.value = state.showWireframe;

    const chartIdx = state.currentChart
      ? atlas.indexOf(state.currentChart)
      : -1;
    u.uActiveChartIdx.value = chartIdx;
    if (state.currentChart) {
      u.uChartGridColor.value.set(state.currentChart.color);
    }

    if (state.activeScalarFn !== "none") {
      const fn = scalarFunctions[state.activeScalarFn];
      if (fn) {
        u.uScalarMin.value = fn.min;
        u.uScalarMax.value = fn.max;
      }
    }

    // If chart changed, recompute chart coords on current geometry
    const currentChartName = state.currentChart?.name ?? "";
    if (lastChartName.current !== currentChartName && meshRef.current) {
      if (state.currentChart) {
        computeChartAttrib(meshRef.current.geometry, state.currentChart);
      } else {
        clearChartAttrib(meshRef.current.geometry);
      }
      lastChartName.current = currentChartName;
    }

    // Check if we need to regenerate terrain
    const dx = cam.position.x - chunkCenter.current[0];
    const dz = cam.position.z - chunkCenter.current[1];
    if (dx * dx + dz * dz > REGEN_THRESHOLD * REGEN_THRESHOLD) {
      chunkCenter.current = [cam.position.x, cam.position.z];
      const newGeo = generateTerrainGeometry(
        cam.position.x,
        cam.position.z,
        TERRAIN_SIZE,
        RESOLUTION
      );
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = newGeo;

        // Recompute chart coords
        if (state.currentChart) {
          computeChartAttrib(newGeo, state.currentChart);
          lastChartName.current = state.currentChart.name;
        }

        // Recompute scalar attribute for new geometry
        if (state.showScalarOverlay && state.activeScalarFn !== "none") {
          const fn = scalarFunctions[state.activeScalarFn];
          if (fn) {
            const posAttr = newGeo.getAttribute("position");
            const count = posAttr.count;
            const scalars = new Float32Array(count);
            for (let i = 0; i < count; i++) {
              scalars[i] = fn.compute(
                posAttr.getX(i),
                posAttr.getY(i),
                posAttr.getZ(i)
              );
            }
            newGeo.setAttribute(
              "aScalar",
              new THREE.BufferAttribute(scalars, 1)
            );
          }
        }
      }
    }
  });

  const handleClick = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // Always allow point selection
      event.stopPropagation();

      const p = event.point;
      const x = p.x;
      const z = p.z;
      const chart = state.currentChart;

      let e1: [number, number, number];
      let e2: [number, number, number];
      let normal: [number, number, number];

      if (chart && isInChart(chart, x, z)) {
        // Compute chart-aligned basis: ∂/∂u and ∂/∂v
        // Differentiate the inverse map φ⁻¹: (u,v) → (x,z) numerically
        const [u, v] = chart.forward(x, z);
        const eps = 0.05;

        const [xu1, zu1] = chart.inverse(u + eps, v);
        const [xu0, zu0] = chart.inverse(u - eps, v);
        // ∂x/∂u, ∂z/∂u
        const dxdu = (xu1 - xu0) / (2 * eps);
        const dzdu = (zu1 - zu0) / (2 * eps);
        // ∂h/∂u = ∂h/∂x · ∂x/∂u + ∂h/∂z · ∂z/∂u
        const hx = terrainSampler.dhdx(x, z);
        const hz = terrainSampler.dhdz(x, z);
        const dhdu = hx * dxdu + hz * dzdu;

        const [xv1, zv1] = chart.inverse(u, v + eps);
        const [xv0, zv0] = chart.inverse(u, v - eps);
        const dxdv = (xv1 - xv0) / (2 * eps);
        const dzdv = (zv1 - zv0) / (2 * eps);
        const dhdv = hx * dxdv + hz * dzdv;

        // e₁ = (∂x/∂u, ∂h/∂u, ∂z/∂u), e₂ = (∂x/∂v, ∂h/∂v, ∂z/∂v)
        const e1Raw: [number, number, number] = [dxdu, dhdu, dzdu];
        const e2Raw: [number, number, number] = [dxdv, dhdv, dzdv];

        const e1Len = Math.sqrt(e1Raw[0] ** 2 + e1Raw[1] ** 2 + e1Raw[2] ** 2);
        e1 = [e1Raw[0] / e1Len, e1Raw[1] / e1Len, e1Raw[2] / e1Len];

        const e2Len = Math.sqrt(e2Raw[0] ** 2 + e2Raw[1] ** 2 + e2Raw[2] ** 2);
        e2 = [e2Raw[0] / e2Len, e2Raw[1] / e2Len, e2Raw[2] / e2Len];

        // Normal = e₁ × e₂
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        normal = [nx / nLen, ny / nLen, nz / nLen];
      } else {
        // Fallback: world-aligned basis
        const hx = terrainSampler.dhdx(x, z);
        const hz = terrainSampler.dhdz(x, z);

        const e1Len = Math.sqrt(1 + hx * hx);
        e1 = [1 / e1Len, hx / e1Len, 0];

        const e2Len = Math.sqrt(1 + hz * hz);
        e2 = [0, hz / e2Len, 1 / e2Len];

        const nLen = Math.sqrt(hx * hx + 1 + hz * hz);
        normal = [-hx / nLen, 1 / nLen, -hz / nLen];
      }

      dispatch({
        type: "SELECT_POINT",
        point: {
          position: [p.x, p.y, p.z],
          e1,
          e2,
          normal,
        },
      });
    },
    [state.currentChart, dispatch]
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
