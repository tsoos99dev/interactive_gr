import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { CurveLine } from "../primitives";
import { integrateGeodesic } from "@/lib/geodesics";
import { sphereMetric } from "@/lib/sphere";
import { useAppState } from "@/stores/app-store";

const XI1_COLOR = new THREE.Color(0.7, 0.25, 0.25);
const XI2_COLOR = new THREE.Color(0.25, 0.35, 0.7);

const GRID_LINES = 15;
const N_SAMPLES = 41; // odd so there's a true center sample
const MAX_RADIUS = 0.4;
const STEPS_PER_GEO = 100;
const FRAME_BUDGET_MS = 30;

interface LineState {
  points: ([number, number, number] | null)[];
}

export function NormalCoordsOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;

  const [xi1Data, setXi1Data] = useState<LineState[]>([]);
  const [xi2Data, setXi2Data] = useState<LineState[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    setXi1Data([]);
    setXi2Data([]);
    cancelRef.current = true;

    if (!point) return;

    const [g11, g12, g22] = sphereMetric(point.theta, point.phi, epsilon);
    const dt = 1.0 / STEPS_PER_GEO;
    const lenTheta = Math.sqrt(g11);
    const cosAngle = g12 / (lenTheta * Math.sqrt(g22));
    const lenPhiPerp = Math.sqrt(g22 * (1 - cosAngle * cosAngle));
    const g12Factor = -g12 / (g11 * lenPhiPerp);
    const { theta, phi } = point;

    function shoot(xi1: number, xi2: number): [number, number, number] {
      const vt = xi1 / lenTheta + xi2 * g12Factor;
      const vp = xi2 / lenPhiPerp;
      const geo = integrateGeodesic(theta, phi, vt, vp, epsilon, STEPS_PER_GEO, dt);
      return geo.points3D[geo.points3D.length - 1];
    }

    // Line values (which ξ values get drawn)
    const half = Math.floor(GRID_LINES / 2);
    const lineVals: number[] = [];
    for (let i = -half; i <= half; i++) lineVals.push((i / half) * MAX_RADIUS);

    // Dense sample values along each line
    const sampleVals: number[] = [];
    for (let j = 0; j < N_SAMPLES; j++)
      sampleVals.push(((j / (N_SAMPLES - 1)) * 2 - 1) * MAX_RADIUS);

    // Build work queue sorted by radius from origin in normal-coord space
    interface WorkItem {
      type: 0 | 1; // 0=xi1 line, 1=xi2 line
      lineIdx: number;
      sampleIdx: number;
      xi1: number;
      xi2: number;
    }

    const queue: WorkItem[] = [];

    for (let i = 0; i < lineVals.length; i++) {
      for (let j = 0; j < N_SAMPLES; j++) {
        queue.push({
          type: 0,
          lineIdx: i,
          sampleIdx: j,
          xi1: lineVals[i],
          xi2: sampleVals[j],
        });
        queue.push({
          type: 1,
          lineIdx: i,
          sampleIdx: j,
          xi1: sampleVals[j],
          xi2: lineVals[i],
        });
      }
    }

    queue.sort((a, b) => {
      const ra = a.xi1 * a.xi1 + a.xi2 * a.xi2;
      const rb = b.xi1 * b.xi1 + b.xi2 * b.xi2;
      return ra - rb;
    });

    // Mutable buffers
    const xi1Buf: ([number, number, number] | null)[][] = lineVals.map(() =>
      new Array(N_SAMPLES).fill(null),
    );
    const xi2Buf: ([number, number, number] | null)[][] = lineVals.map(() =>
      new Array(N_SAMPLES).fill(null),
    );

    let idx = 0;
    const cancelled = { current: false };
    cancelRef.current = false;

    function computeBatch() {
      if (cancelled.current || cancelRef.current) return;
      const t0 = performance.now();

      while (idx < queue.length && performance.now() - t0 < FRAME_BUDGET_MS) {
        const w = queue[idx];
        const pt = shoot(w.xi1, w.xi2);
        if (w.type === 0) {
          xi1Buf[w.lineIdx][w.sampleIdx] = pt;
        } else {
          xi2Buf[w.lineIdx][w.sampleIdx] = pt;
        }
        idx++;
      }

      // Snapshot for React
      setXi1Data(xi1Buf.map((pts) => ({ points: pts.slice() })));
      setXi2Data(xi2Buf.map((pts) => ({ points: pts.slice() })));

      if (idx < queue.length) requestAnimationFrame(computeBatch);
    }

    requestAnimationFrame(computeBatch);

    return () => {
      cancelled.current = true;
      cancelRef.current = true;
    };
  }, [point, epsilon]);

  return (
    <group>
      {xi1Data.map((line, idx) => {
        const pts = extractContiguous(line.points);
        if (pts.length < 2) return null;
        const t = idx / (GRID_LINES - 1 || 1);
        const alpha = 1 - 0.5 * Math.abs(t - 0.5) * 2;
        const color = XI1_COLOR.clone().multiplyScalar(0.5 + 0.5 * alpha);
        return (
          <CurveLine
            key={`xi1-${idx}`}
            points={pts}
            colors={pts.map(() => color.clone())}
            renderOrder={4}
            radius={0.004}
          />
        );
      })}

      {xi2Data.map((line, idx) => {
        const pts = extractContiguous(line.points);
        if (pts.length < 2) return null;
        const t = idx / (GRID_LINES - 1 || 1);
        const alpha = 1 - 0.5 * Math.abs(t - 0.5) * 2;
        const color = XI2_COLOR.clone().multiplyScalar(0.5 + 0.5 * alpha);
        return (
          <CurveLine
            key={`xi2-${idx}`}
            points={pts}
            colors={pts.map(() => color.clone())}
            renderOrder={4}
            radius={0.004}
          />
        );
      })}
    </group>
  );
}

/** Extract the longest contiguous non-null run from a sparse line */
function extractContiguous(
  pts: ([number, number, number] | null)[],
): [number, number, number][] {
  let bestStart = 0;
  let bestLen = 0;
  let start = 0;
  let len = 0;

  for (let i = 0; i < pts.length; i++) {
    if (pts[i] !== null) {
      if (len === 0) start = i;
      len++;
      if (len > bestLen) {
        bestStart = start;
        bestLen = len;
      }
    } else {
      len = 0;
    }
  }

  const out: [number, number, number][] = [];
  for (let i = bestStart; i < bestStart + bestLen; i++) out.push(pts[i]!);
  return out;
}
