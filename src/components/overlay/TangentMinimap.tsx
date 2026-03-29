import { useRef, useEffect, useCallback, useMemo } from "react";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import { generateCurve } from "@/lib/curves";
import { evaluateVectorFieldAt } from "@/lib/vector-fields";
import { metricEllipseParams } from "@/lib/metric";
import { computeLieBracket } from "@/lib/lie-bracket";

const SIZE = 220;
const RANGE = 3; // coordinate range ±3 in tangent space

/**
 * 2D minimap of the tangent space at the selected point.
 * Shows e₁ and e₂ as basis vectors (which may be non-orthogonal),
 * a Cartesian grid for reference, and lets the user click to pick a tangent vector.
 */
export function TangentMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useAppState();
  const dispatch = useAppDispatch();

  const point = state.selectedPoint;

  // Project 3D tangent vectors into a 2D orthonormal frame in the tangent plane
  // using Gram-Schmidt on e₁
  const getFrame = useCallback(() => {
    if (!point) return null;
    const [e1x, e1y, e1z] = point.e1;
    const [e2x, e2y, e2z] = point.e2;

    // f₁ = e₁ / |e₁| (already normalized, but be safe)
    const e1Len = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z);
    const f1x = e1x / e1Len,
      f1y = e1y / e1Len,
      f1z = e1z / e1Len;

    // f₂ = e₂ - (e₂·f₁)f₁, then normalize
    const dot = e2x * f1x + e2y * f1y + e2z * f1z;
    let f2x = e2x - dot * f1x;
    let f2y = e2y - dot * f1y;
    let f2z = e2z - dot * f1z;
    const f2Len = Math.sqrt(f2x * f2x + f2y * f2y + f2z * f2z);
    f2x /= f2Len;
    f2y /= f2Len;
    f2z /= f2Len;

    // Project e₁ and e₂ into (f1, f2) frame
    const e1_2d: [number, number] = [
      e1x * f1x + e1y * f1y + e1z * f1z,
      e1x * f2x + e1y * f2y + e1z * f2z,
    ];
    const e2_2d: [number, number] = [
      e2x * f1x + e2y * f1y + e2z * f1z,
      e2x * f2x + e2y * f2y + e2z * f2z,
    ];

    return {
      e1_2d,
      e2_2d,
      f1: [f1x, f1y, f1z] as const,
      f2: [f2x, f2y, f2z] as const,
    };
  }, [point]);

  const curveData = useMemo(() => {
    if (!state.showCurve || !point) return null;
    const chart = state.currentChart ?? undefined;
    const curve = generateCurve(
      point.position[0],
      point.position[2],
      chart ? { forward: chart.forward } : undefined,
      point.e1Raw,
      point.e2Raw,
    );
    return curve;
  }, [state.showCurve, point, state.currentChart]);

  // Vector field at selected point
  const fieldData = useMemo(() => {
    if (!state.showVectorField || !state.currentChart || !point) return null;
    return evaluateVectorFieldAt(
      state.currentChart,
      point.position[0],
      point.position[2],
      point.e1Raw,
      point.e2Raw,
      state.vectorFieldSource,
      state.activeScalarFn,
    );
  }, [
    state.showVectorField,
    state.currentChart,
    state.vectorFieldSource,
    state.activeScalarFn,
    point,
  ]);

  // Metric ellipse at selected point
  const metricData = useMemo(() => {
    if (!state.showMetricTensor || !state.currentChart || !point) return null;
    return metricEllipseParams(
      state.currentChart,
      point.position[0],
      point.position[2],
      1.0,
    );
  }, [state.showMetricTensor, state.currentChart, point]);

  // Lie bracket at selected point
  const bracketData = useMemo(() => {
    if (!state.showLieBracket || !point) return null;
    const result = computeLieBracket(
      state.lieBracketFieldX,
      state.lieBracketFieldY,
      point.position[0],
      point.position[2],
      2.0,
      15,
      state.currentChart ?? undefined,
    );
    return result.bracket3D;
  }, [
    state.showLieBracket,
    state.lieBracketFieldX,
    state.lieBracketFieldY,
    state.currentChart,
    point,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !point) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = getFrame();
    if (!frame) return;

    const { e1_2d, e2_2d, f1, f2 } = frame;
    const scale = SIZE / (RANGE * 2);
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Project curve tangent γ'(0) into the 2D frame, scaled by parameterization
    let curveTangent2d: [number, number] | null = null;
    if (state.showCurve && curveData) {
      const s = curveData.tangentMagnitude * state.paramScale;
      const [tx, ty, tz] = curveData.tangent3D;
      curveTangent2d = [
        s * (tx * f1[0] + ty * f1[1] + tz * f1[2]),
        s * (tx * f2[0] + ty * f2[1] + tz * f2[2]),
      ];
    }
    const toSx = (x: number) => cx + x * scale;
    const toSy = (y: number) => cy - y * scale; // flip y for screen coords

    // Clear
    ctx.fillStyle = "rgba(250, 250, 252, 0.95)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Draw coordinate grid lines along e₁/e₂ (the chart basis)
    // Use a large enough range to cover the whole canvas even when skewed
    const gridRange = RANGE * 3;
    ctx.strokeStyle = "rgba(100, 110, 140, 0.18)";
    ctx.lineWidth = 0.7;
    for (let t = -gridRange; t <= gridRange; t++) {
      // Lines of constant "e₂ component" = t, varying e₁
      ctx.beginPath();
      const s0x = -gridRange * e1_2d[0] + t * e2_2d[0];
      const s0y = -gridRange * e1_2d[1] + t * e2_2d[1];
      const s1x = gridRange * e1_2d[0] + t * e2_2d[0];
      const s1y = gridRange * e1_2d[1] + t * e2_2d[1];
      ctx.moveTo(toSx(s0x), toSy(s0y));
      ctx.lineTo(toSx(s1x), toSy(s1y));
      ctx.stroke();

      // Lines of constant "e₁ component" = t, varying e₂
      ctx.beginPath();
      const t0x = t * e1_2d[0] + -gridRange * e2_2d[0];
      const t0y = t * e1_2d[1] + -gridRange * e2_2d[1];
      const t1x = t * e1_2d[0] + gridRange * e2_2d[0];
      const t1y = t * e1_2d[1] + gridRange * e2_2d[1];
      ctx.moveTo(toSx(t0x), toSy(t0y));
      ctx.lineTo(toSx(t1x), toSy(t1y));
      ctx.stroke();
    }

    // Draw metric ellipse: g(v,v) = 1
    if (metricData) {
      const { a, b, angle } = metricData;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const ELLIPSE_PTS = 48;
      ctx.beginPath();
      for (let k = 0; k <= ELLIPSE_PTS; k++) {
        const theta = (k / ELLIPSE_PTS) * Math.PI * 2;
        // Axis-aligned ellipse in eigenbasis
        const up = a * Math.cos(theta);
        const vp = b * Math.sin(theta);
        // Rotate back to chart coords
        const du = up * cosA - vp * sinA;
        const dv = up * sinA + vp * cosA;
        // Map to 2D frame via basis vectors
        const ex = du * e1_2d[0] + dv * e2_2d[0];
        const ey = du * e1_2d[1] + dv * e2_2d[1];
        if (k === 0) ctx.moveTo(toSx(ex), toSy(ey));
        else ctx.lineTo(toSx(ex), toSy(ey));
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(140, 60, 140, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 60, 140, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw e₁ basis arrow (red)
    drawArrow(ctx, cx, cy, toSx(e1_2d[0]), toSy(e1_2d[1]), "#ff4444", 2);
    // Draw e₂ basis arrow (blue)
    drawArrow(ctx, cx, cy, toSx(e2_2d[0]), toSy(e2_2d[1]), "#4488ff", 2);

    // Basis arrow labels
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ff4444";
    ctx.fillText("∂/∂u", toSx(e1_2d[0]) + 4, toSy(e1_2d[1]) - 4);
    ctx.fillStyle = "#4488ff";
    ctx.fillText("∂/∂v", toSx(e2_2d[0]) + 4, toSy(e2_2d[1]) - 4);

    // Draw curve tangent γ'(0) (black)
    if (state.showCurve && curveTangent2d) {
      drawArrow(
        ctx,
        cx,
        cy,
        toSx(curveTangent2d[0]),
        toSy(curveTangent2d[1]),
        "#000000",
        2,
      );
      ctx.fillStyle = "#000";
      ctx.font = "bold 10px monospace";
      ctx.fillText(
        "γ′(0)",
        toSx(curveTangent2d[0]) + 4,
        toSy(curveTangent2d[1]) - 4,
      );
    }

    // Draw vector field at point (dark green) — project 3D vector into (f1, f2) frame
    if (fieldData && fieldData.mag > 0.01) {
      const [dx, dy, dz] = fieldData.dir3D;
      const fx = fieldData.mag * (dx * f1[0] + dy * f1[1] + dz * f1[2]);
      const fy = fieldData.mag * (dx * f2[0] + dy * f2[1] + dz * f2[2]);
      drawArrow(ctx, cx, cy, toSx(fx), toSy(fy), "#117733", 2);
      ctx.fillStyle = "#117733";
      ctx.font = "bold 11px monospace";
      ctx.fillText("V", toSx(fx) + 4, toSy(fy) - 4);
    }

    // Draw Lie bracket [X, Y] (orange) — project 3D vector into (f1, f2) frame
    if (bracketData) {
      const [bx3, by3, bz3] = bracketData;
      let bx = bx3 * f1[0] + by3 * f1[1] + bz3 * f1[2];
      let by = bx3 * f2[0] + by3 * f2[1] + bz3 * f2[2];
      // Scale to match 3D view (bracketLen * 4, capped at 3)
      const bLen = Math.sqrt(bx * bx + by * by);
      if (bLen > 1e-4) {
        const scaledLen = Math.min(bLen * 4, 3);
        bx = (bx / bLen) * scaledLen;
        by = (by / bLen) * scaledLen;
      }
      drawArrow(ctx, cx, cy, toSx(bx), toSy(by), "#ff8800", 2);
      ctx.fillStyle = "#ff8800";
      ctx.font = "bold 11px monospace";
      ctx.fillText("[X,Y]", toSx(bx) + 4, toSy(by) - 4);
    }

    // Draw selected tangent vector (green)
    if (state.tangentVector) {
      const [a, b] = state.tangentVector;
      const vx = a * e1_2d[0] + b * e2_2d[0];
      const vy = a * e1_2d[1] + b * e2_2d[1];
      drawArrow(ctx, cx, cy, toSx(vx), toSy(vy), "#22aa44", 2.5);

      // ctx.fillStyle = "rgba(34, 170, 68, 0.8)";
      // ctx.font = "10px monospace";
      // ctx.fillText(
      //   `v = ${a.toFixed(1)}·∂/∂u + ${b.toFixed(1)}·∂/∂v`,
      //   6,
      //   SIZE - 18,
      // );
    }

    // Decomposition labels at bottom left — stack from bottom up
    // let bottomY = SIZE - 6;

    // γ'(0) decomposition
    // if (state.showCurve && curveTangent2d) {
    //   const det2 = e1_2d[0] * e2_2d[1] - e1_2d[1] * e2_2d[0];
    //   if (Math.abs(det2) > 1e-6) {
    //     const ca =
    //       (curveTangent2d[0] * e2_2d[1] - curveTangent2d[1] * e2_2d[0]) / det2;
    //     const cb =
    //       (curveTangent2d[1] * e1_2d[0] - curveTangent2d[0] * e1_2d[1]) / det2;
    //     ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    //     ctx.font = "10px monospace";
    //     ctx.fillText(
    //       `γ′ = ${ca.toFixed(1)}·∂/∂u + ${cb.toFixed(1)}·∂/∂v`,
    //       6,
    //       bottomY,
    //     );
    //     bottomY += 12;
    //   }
    // }

    // V decomposition
    // if (fieldData && fieldData.mag > 0.01) {
    //   const [Vu, Vv] = fieldData.chartComponents;
    //   ctx.fillStyle = "rgba(17, 119, 51, 0.8)";
    //   ctx.font = "10px monospace";
    //   ctx.fillText(
    //     `V = ${Vu.toFixed(1)}·∂/∂u + ${Vv.toFixed(1)}·∂/∂v`,
    //     6,
    //     bottomY,
    //   );
    // }

    // Origin dot
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(100, 120, 150, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, SIZE, SIZE);

    // Title
    ctx.fillStyle = "rgba(60, 70, 90, 0.8)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("TₚM", 6, 14);
  }, [
    point,
    state.tangentVector,
    state.showCurve,
    state.paramScale,
    curveData,
    fieldData,
    metricData,
    bracketData,
    getFrame,
  ]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!point) return;
      const frame = getFrame();
      if (!frame) return;

      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const scale = SIZE / (RANGE * 2);
      const cx = SIZE / 2;
      const cy = SIZE / 2;

      // Convert screen click to 2D tangent plane coordinates (in orthonormal frame)
      const clickX = (px - cx) / scale;
      const clickY = -(py - cy) / scale; // flip y

      // Solve v = a·e1_2d + b·e2_2d for (a, b)
      // This is a 2x2 linear system: [e1_2d | e2_2d] * [a, b]^T = [clickX, clickY]^T
      const { e1_2d, e2_2d } = frame;
      const det = e1_2d[0] * e2_2d[1] - e1_2d[1] * e2_2d[0];
      if (Math.abs(det) < 1e-6) return;

      const a = (clickX * e2_2d[1] - clickY * e2_2d[0]) / det;
      const b = (clickY * e1_2d[0] - clickX * e1_2d[1]) / det;

      dispatch({ type: "SET_TANGENT_VECTOR", v: [a, b] });
    },
    [point, getFrame, dispatch],
  );

  if (!point) return null;

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="absolute top-58 right-4 rounded-lg pointer-events-auto cursor-crosshair"
      onClick={handleClick}
    />
  );
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  lineWidth: number,
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  const headLen = 8;
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - headLen * Math.cos(angle - 0.35),
    y1 - headLen * Math.sin(angle - 0.35),
  );
  ctx.lineTo(
    x1 - headLen * Math.cos(angle + 0.35),
    y1 - headLen * Math.sin(angle + 0.35),
  );
  ctx.closePath();
  ctx.fill();
}
