import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import { generateCurve } from "@/lib/curves";

const PLANE_SIZE = 6;
const GRID_DIVISIONS = 6;
const ARROW_LENGTH = 1.0;
const ARROW_HEAD_LENGTH = 0.2;
const ARROW_HEAD_WIDTH = 0.08;

function Arrow({
  origin,
  direction,
  color,
  length = ARROW_LENGTH,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  color: string;
  length?: number;
}) {
  const shaftGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(
      ARROW_HEAD_WIDTH * 0.4,
      ARROW_HEAD_WIDTH * 0.4,
      length - ARROW_HEAD_LENGTH,
      8
    );
    geo.translate(0, (length - ARROW_HEAD_LENGTH) / 2, 0);
    return geo;
  }, [length]);

  const headGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(ARROW_HEAD_WIDTH, ARROW_HEAD_LENGTH, 8);
    geo.translate(0, length - ARROW_HEAD_LENGTH / 2, 0);
    return geo;
  }, [length]);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    );
    return q;
  }, [direction]);

  return (
    <group position={origin} quaternion={quaternion}>
      <mesh geometry={shaftGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh geometry={headGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function TangentPlaneGrid({
  origin,
  e1,
  e2,
}: {
  origin: THREE.Vector3;
  e1: THREE.Vector3;
  e2: THREE.Vector3;
}) {
  const gridGeo = useMemo(() => {
    const positions: number[] = [];
    const half = PLANE_SIZE / 2;
    const step = PLANE_SIZE / GRID_DIVISIONS;

    // Lines along e1 direction (varying e2)
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const t = -half + i * step;
      const sx = t * e2.x - half * e1.x;
      const sy = t * e2.y - half * e1.y;
      const sz = t * e2.z - half * e1.z;
      const ex = t * e2.x + half * e1.x;
      const ey = t * e2.y + half * e1.y;
      const ez = t * e2.z + half * e1.z;
      positions.push(sx, sy, sz, ex, ey, ez);
    }

    // Lines along e2 direction (varying e1)
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const t = -half + i * step;
      const sx = t * e1.x - half * e2.x;
      const sy = t * e1.y - half * e2.y;
      const sz = t * e1.z - half * e2.z;
      const ex = t * e1.x + half * e2.x;
      const ey = t * e1.y + half * e2.y;
      const ez = t * e1.z + half * e2.z;
      positions.push(sx, sy, sz, ex, ey, ez);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    return geo;
  }, [e1, e2]);

  const planeGeo = useMemo(() => {
    const half = PLANE_SIZE / 2;
    const c00 = [-half * e1.x - half * e2.x, -half * e1.y - half * e2.y, -half * e1.z - half * e2.z];
    const c10 = [ half * e1.x - half * e2.x,  half * e1.y - half * e2.y,  half * e1.z - half * e2.z];
    const c01 = [-half * e1.x + half * e2.x, -half * e1.y + half * e2.y, -half * e1.z + half * e2.z];
    const c11 = [ half * e1.x + half * e2.x,  half * e1.y + half * e2.y,  half * e1.z + half * e2.z];

    const positions = new Float32Array([
      ...c00, ...c10, ...c11,
      ...c00, ...c11, ...c01,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [e1, e2]);

  return (
    <group position={origin}>
      {/* Solid translucent plane aligned to e1/e2 */}
      <mesh geometry={planeGeo} renderOrder={1}>
        <meshBasicMaterial
          color="#667788"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Grid lines built from e1/e2 basis */}
      <lineSegments geometry={gridGeo} renderOrder={2}>
        <lineBasicMaterial
          color="#333333"
          transparent
          opacity={0.6}
          depthWrite={false}
          depthTest={false}
        />
      </lineSegments>
    </group>
  );
}

/** Vertex-colored line strip (replaces drei Line for WebGPU compat) */
function CurveLine({
  points,
  colors,
  renderOrder,
}: {
  points: [number, number, number][];
  colors: THREE.Color[];
  renderOrder: number;
}) {
  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colorArr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i][0];
      positions[i * 3 + 1] = points[i][1];
      positions[i * 3 + 2] = points[i][2];
      colorArr[i * 3] = colors[i].r;
      colorArr[i * 3 + 1] = colors[i].g;
      colorArr[i * 3 + 2] = colors[i].b;
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.renderOrder = renderOrder;
    return obj;
  }, [points, colors, renderOrder]);

  return <primitive object={lineObj} />;
}

export function TangentSpace() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const point = state.selectedPoint;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        dispatch({ type: "CLEAR_SELECTION" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dispatch]);

  if (!point || !state.tangentSpaceMode) return null;

  const origin = new THREE.Vector3(...point.position);
  const e1 = new THREE.Vector3(...point.e1);
  const e2 = new THREE.Vector3(...point.e2);

  // Curve through selected point — tangent computed in chart coords when available
  const curve = useMemo(() => {
    if (!state.showCurve) return null;
    const chart = state.currentChart ?? undefined;
    return generateCurve(
      point.position[0],
      point.position[2],
      chart ? { forward: chart.forward } : undefined,
      point.e1Raw,
      point.e2Raw,
    );
  }, [point.position, point.e1Raw, point.e2Raw, state.showCurve, state.currentChart]);
  const curvePoints = curve?.points3D ?? null;

  // Fade factor: 0 at endpoints, 1 at center
  const fadeFn = (i: number, n: number) => {
    const mid = Math.floor(n / 2);
    const d = Math.abs(i - mid) / Math.max(mid, 1);
    return 1 - d * d; // gentle quadratic fade
  };

  // Vertex colors: fade from dark at center to background at endpoints
  const curveColors = useMemo(() => {
    if (!curvePoints) return null;
    const n = curvePoints.length;
    const dark = new THREE.Color(0.12, 0.12, 0.12);
    const bg = new THREE.Color(0.94, 0.94, 0.94);
    return curvePoints.map((_, i) => dark.clone().lerp(bg, 1 - fadeFn(i, n)));
  }, [curvePoints]);

  // Adaptive parameterization ticks: multiple resolution layers so existing
  // ticks stay put and finer ones appear between them as λ changes.
  const curveTicks = useMemo(() => {
    if (!curvePoints) return null;
    const n = curvePoints.length;
    const mid = Math.floor(n / 2);
    const ticks: { pos: [number, number, number]; label: string; fade: number }[] = [];
    const maxArc = Math.floor(mid * 0.6);
    const lambda = state.paramScale;
    const sMax = lambda * 2;

    // Hierarchical layers: each step is a subdivision of the previous.
    // We include all layers whose step produces at least ~3 ticks per side
    // that fit on the visible curve.
    const layers = [10, 5, 2, 1, 0.5];
    const seen = new Set<number>();

    for (const step of layers) {
      if (sMax / step < 1.5) continue;
      if (sMax / step > 8) continue;

      for (let k = 0; k * step <= sMax * 1.05; k++) {
        for (const s of k === 0 ? [0] : [k * step, -k * step]) {
          // Quantise to avoid float drift
          const key = Math.round(s * 10000);
          if (seen.has(key)) continue;
          seen.add(key);

          const t = s / lambda;
          const idx = mid + Math.round((Math.sinh(t) / Math.sinh(2)) * maxArc);
          if (idx < 0 || idx >= n) continue;
          const p = curvePoints[idx];

          // Format with just enough decimals for the step size
          const decimals = step < 0.05 ? 3 : step < 0.5 ? 2 : step < 1 ? 1 : 0;
          const label = s.toFixed(decimals).replace(/\.?0+$/, "") || "0";
          ticks.push({ pos: p, label, fade: fadeFn(idx, n) });
        }
      }
    }
    return ticks;
  }, [curvePoints, state.paramScale]);

  // Selected tangent vector: v = a·e₁ + b·e₂
  const tv = state.tangentVector;
  const vecDir = useMemo(() => {
    if (!tv) return null;
    const [a, b] = tv;
    const dir = new THREE.Vector3(
      a * e1.x + b * e2.x,
      a * e1.y + b * e2.y,
      a * e1.z + b * e2.z
    );
    return dir;
  }, [tv, e1, e2]);

  return (
    <group>
      {/* Tangent plane with grid */}
      <TangentPlaneGrid origin={origin} e1={e1} e2={e2} />

      {/* Basis vectors */}
      <Arrow origin={origin} direction={e1} color="#ff4444" />
      <Arrow origin={origin} direction={e2} color="#4488ff" />

      {/* Labels at arrow tips */}
      <Html
        position={[
          origin.x + e1.x * (ARROW_LENGTH + 0.15),
          origin.y + e1.y * (ARROW_LENGTH + 0.15),
          origin.z + e1.z * (ARROW_LENGTH + 0.15),
        ]}
        style={{ pointerEvents: "none" }}
      >
        <span style={{ color: "#ff4444", fontSize: 13, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
          ∂/∂u
        </span>
      </Html>
      <Html
        position={[
          origin.x + e2.x * (ARROW_LENGTH + 0.15),
          origin.y + e2.y * (ARROW_LENGTH + 0.15),
          origin.z + e2.z * (ARROW_LENGTH + 0.15),
        ]}
        style={{ pointerEvents: "none" }}
      >
        <span style={{ color: "#4488ff", fontSize: 13, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
          ∂/∂v
        </span>
      </Html>

      {/* Selected tangent vector (green) */}
      {vecDir && (
        <>
          <Arrow
            origin={origin}
            direction={vecDir.clone().normalize()}
            color="#22aa44"
            length={vecDir.length()}
          />
          <Html
            position={[
              origin.x + vecDir.x,
              origin.y + vecDir.y + 0.15,
              origin.z + vecDir.z,
            ]}
            style={{ pointerEvents: "none" }}
          >
            <span style={{ color: "#22aa44", fontSize: 12, fontWeight: 700, fontFamily: "monospace", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
              v
            </span>
          </Html>
        </>
      )}

      {/* Point marker */}
      <mesh position={origin}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ffcc00" />
      </mesh>
      <Html
        position={[origin.x, origin.y + 0.25, origin.z]}
        style={{ pointerEvents: "none" }}
      >
        <span style={{ color: "#aa8800", fontSize: 11, fontWeight: 600, fontFamily: "monospace", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
          p
        </span>
      </Html>

      {/* Curve through the selected point */}
      {state.showCurve && curvePoints && curveColors && (
        <>
          <CurveLine
            points={curvePoints}
            colors={curveColors}
            renderOrder={3}
          />
          {/* Parameter tick marks */}
          {curveTicks?.map((tick, i) => (
            <group key={i}>
              <mesh position={tick.pos} renderOrder={4}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshBasicMaterial
                  color="#000000"
                  transparent
                  opacity={tick.fade}
                  depthTest={false}
                />
              </mesh>
              <Html
                position={[tick.pos[0], tick.pos[1] + 0.18, tick.pos[2]]}
                style={{ pointerEvents: "none", opacity: tick.fade }}
              >
                <span style={{ color: "#000", fontSize: 9, fontFamily: "monospace", whiteSpace: "nowrap", textShadow: "0 0 3px rgba(255,255,255,0.9)" }}>
                  {tick.label === "0.0" ? "γ(0)" : `γ(${tick.label})`}
                </span>
              </Html>
            </group>
          ))}
          {/* Tangent to curve γ'(0) — length reflects parameterization */}
          {curve?.tangent3D && (() => {
            const scaledLen = curve.tangentMagnitude * state.paramScale;
            const arrowLen = Math.max(scaledLen, 0.05);
            const tipOffset = arrowLen + 0.15;
            return (
              <>
                <Arrow
                  origin={origin}
                  direction={new THREE.Vector3(...curve.tangent3D)}
                  color="#000000"
                  length={arrowLen}
                />
                <Html
                  position={[
                    origin.x + curve.tangent3D[0] * tipOffset,
                    origin.y + curve.tangent3D[1] * tipOffset,
                    origin.z + curve.tangent3D[2] * tipOffset,
                  ]}
                  style={{ pointerEvents: "none" }}
                >
                  <span style={{ color: "#000", fontSize: 12, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
                    γ′(0)
                  </span>
                </Html>
              </>
            );
          })()}
        </>
      )}
    </group>
  );
}
