import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAppState } from "@/stores/app-store";
import { sampleMetricEllipses } from "@/lib/metric";

const FADE_NEAR = 10;
const FADE_FAR = 80;

interface EllipseInfo {
  center: [number, number, number];
  distNorm: number;
  fillStart: number; // index into fill vertex array
  fillCount: number;
  lineStart: number; // index into line vertex array
  lineCount: number;
}

const _baseColor = new THREE.Color(0.55, 0.2, 0.55);
const _bgColor = new THREE.Color(0.97, 0.97, 0.97);

export function MetricOverlay() {
  const state = useAppState();
  const ellipseInfoRef = useRef<EllipseInfo[]>([]);

  const { fillGeo, lineGeo } = useMemo(() => {
    const chart = state.currentChart;
    if (!chart) {
      ellipseInfoRef.current = [];
      return { fillGeo: null, lineGeo: null };
    }

    const ellipses = sampleMetricEllipses(chart, 12, 1.0);
    const infos: EllipseInfo[] = [];

    const fillPositions: number[] = [];
    const fillColors: number[] = [];
    const linePositions: number[] = [];
    const lineColors: number[] = [];

    for (const { vertices, distNorm } of ellipses) {
      const n = vertices.length - 1;
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < n; k++) {
        cx += vertices[k][0]; cy += vertices[k][1]; cz += vertices[k][2];
      }
      cx /= n; cy /= n; cz /= n;

      const fillStart = fillColors.length / 3;
      const lineStart = lineColors.length / 3;

      for (let k = 0; k < n; k++) {
        const p0 = vertices[k];
        const p1 = vertices[(k + 1) % n];

        fillPositions.push(cx, cy, cz, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
        for (let t = 0; t < 3; t++) fillColors.push(0.55, 0.2, 0.55);

        linePositions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
        for (let t = 0; t < 2; t++) lineColors.push(0.55, 0.2, 0.55);
      }

      infos.push({
        center: [cx, cy, cz],
        distNorm,
        fillStart,
        fillCount: n * 3,
        lineStart,
        lineCount: n * 2,
      });
    }

    ellipseInfoRef.current = infos;

    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(fillPositions, 3));
    fg.setAttribute("color", new THREE.Float32BufferAttribute(fillColors, 3));

    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));

    return { fillGeo: fg, lineGeo: lg };
  }, [state.currentChart]);

  const fillMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.12,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  useFrame(({ camera }) => {
    if (!fillGeo || !lineGeo) return;
    const infos = ellipseInfoRef.current;
    if (infos.length === 0) return;

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    const fCol = (fillGeo.getAttribute("color") as THREE.Float32BufferAttribute).array as Float32Array;
    const lCol = (lineGeo.getAttribute("color") as THREE.Float32BufferAttribute).array as Float32Array;

    for (const info of infos) {
      const dx = info.center[0] - camX;
      const dy = info.center[1] - camY;
      const dz = info.center[2] - camZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const distFade = 1 - Math.max(0, Math.min(1, (dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
      const edgeFade = 1 - Math.pow(Math.max(info.distNorm - 0.6, 0) / 0.35, 2);
      const fade = distFade * edgeFade;

      const color = _baseColor.clone().lerp(_bgColor, 1 - fade);

      // Update fill vertex colors
      for (let i = 0; i < info.fillCount; i++) {
        const idx = (info.fillStart + i) * 3;
        fCol[idx] = color.r;
        fCol[idx + 1] = color.g;
        fCol[idx + 2] = color.b;
      }

      // Update line vertex colors
      for (let i = 0; i < info.lineCount; i++) {
        const idx = (info.lineStart + i) * 3;
        lCol[idx] = color.r;
        lCol[idx + 1] = color.g;
        lCol[idx + 2] = color.b;
      }
    }

    (fillGeo.getAttribute("color") as THREE.Float32BufferAttribute).needsUpdate = true;
    (lineGeo.getAttribute("color") as THREE.Float32BufferAttribute).needsUpdate = true;
  });

  if (!fillGeo || !lineGeo) return null;

  return (
    <group>
      <mesh
        geometry={fillGeo}
        material={fillMat}
        frustumCulled={false}
        renderOrder={4}
      />
      <lineSegments
        geometry={lineGeo}
        material={lineMat}
        frustumCulled={false}
        renderOrder={5}
      />
    </group>
  );
}
