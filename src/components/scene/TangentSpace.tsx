import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
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
      // Start point: origin + t*e2 - half*e1
      const sx = t * e2.x - half * e1.x;
      const sy = t * e2.y - half * e1.y;
      const sz = t * e2.z - half * e1.z;
      // End point: origin + t*e2 + half*e1
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
    // Quad corners: origin ± half*e1 ± half*e2
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

  // Curve through selected point
  const curve = useMemo(() => {
    if (!state.showCurve) return null;
    return generateCurve(point.position[0], point.position[2]);
  }, [point.position, state.showCurve]);
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

  // Nonlinear parameterization ticks: t = sinh(s) style spacing
  const curveTicks = useMemo(() => {
    if (!curvePoints) return null;
    const n = curvePoints.length;
    const mid = Math.floor(n / 2);
    const ticks: { pos: [number, number, number]; label: string; fade: number }[] = [];
    const params = [-2.0, -1.0, -0.5, 0, 0.5, 1.0, 2.0];
    const maxArc = Math.floor(mid * 0.6); // ticks use 60% of curve, rest is fade tail
    for (const t of params) {
      const idx = mid + Math.round((Math.sinh(t) / Math.sinh(2)) * maxArc);
      if (idx < 0 || idx >= n) continue;
      const p = curvePoints[idx];
      ticks.push({ pos: p, label: `${t.toFixed(1)}`, fade: fadeFn(idx, n) });
    }
    return ticks;
  }, [curvePoints]);

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
          <Line
            points={curvePoints}
            vertexColors={curveColors}
            lineWidth={2}
            depthTest={false}
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
          {/* Tangent to curve γ'(0) */}
          {curve?.tangent3D && (
            <>
              <Arrow
                origin={origin}
                direction={new THREE.Vector3(...curve.tangent3D)}
                color="#000000"
                length={ARROW_LENGTH}
              />
              <Html
                position={[
                  origin.x + curve.tangent3D[0] * (ARROW_LENGTH + 0.15),
                  origin.y + curve.tangent3D[1] * (ARROW_LENGTH + 0.15),
                  origin.z + curve.tangent3D[2] * (ARROW_LENGTH + 0.15),
                ]}
                style={{ pointerEvents: "none" }}
              >
                <span style={{ color: "#000", fontSize: 12, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
                  γ′(0)
                </span>
              </Html>
            </>
          )}
        </>
      )}
    </group>
  );
}
