import { useRef, useEffect, useCallback } from "react";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import { sphereChristoffel } from "@/lib/sphere";

const SIZE = 180;
const RANGE = 2;

/* Demo vector field (same definition as CovariantDerivOverlay) */
function V(theta: number): [number, number] {
  return [-Math.cos(theta) * Math.sin(theta), Math.sin(theta)];
}
function dV_dtheta(theta: number): [number, number] {
  return [-Math.cos(2 * theta), Math.cos(theta)];
}
function dV_dphi(): [number, number] {
  return [0, 0];
}

export function Ch3TangentMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useAppState();
  const dispatch = useAppDispatch();
  const point = state.ch3SelectedPoint;
  const tangentDir = state.ch3TangentDirection;
  const showCov = state.ch3ShowCovariantDeriv;
  const covDir = state.ch3CovariantDir;
  const epsilon = state.ch3Bumpiness;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !point) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = SIZE / (RANGE * 2);
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const toSx = (x: number) => cx + x * scale;
    const toSy = (y: number) => cy - y * scale;

    // Clear
    ctx.fillStyle = "rgba(250, 250, 252, 0.95)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid
    ctx.strokeStyle = "rgba(100, 110, 140, 0.15)";
    ctx.lineWidth = 0.5;
    for (let t = -RANGE; t <= RANGE; t++) {
      ctx.beginPath();
      ctx.moveTo(toSx(-RANGE), toSy(t));
      ctx.lineTo(toSx(RANGE), toSy(t));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toSx(t), toSy(-RANGE));
      ctx.lineTo(toSx(t), toSy(RANGE));
      ctx.stroke();
    }

    // e_θ basis arrow (red)
    drawArrow(ctx, cx, cy, toSx(1), toSy(0), "#cc3333", 2);
    ctx.fillStyle = "#cc3333";
    ctx.font = "bold 10px monospace";
    ctx.fillText("∂/∂θ", toSx(1) + 4, toSy(0) - 4);

    // e_φ basis arrow (blue)
    drawArrow(ctx, cx, cy, toSx(0), toSy(1), "#3366cc", 2);
    ctx.fillStyle = "#3366cc";
    ctx.font = "bold 10px monospace";
    ctx.fillText("∂/∂φ", toSx(0) + 4, toSy(1) - 4);

    // Selected tangent direction (green) — only when covariant deriv is OFF
    if (tangentDir && !showCov) {
      const [a, b] = tangentDir;
      drawArrow(ctx, cx, cy, toSx(a), toSy(b), "#22aa44", 2.5);
    }

    // Covariant derivative vectors
    if (showCov) {
      const tc = Math.max(0.05, Math.min(Math.PI - 0.05, point.theta));
      const phi = point.phi;
      const [vT, vP] = V(tc);
      const along = covDir === "dtheta";
      const [dvT, dvP] = along ? dV_dtheta(tc) : dV_dphi();

      const [G0_00, G0_01, G0_11, G1_00, G1_01, G1_11] =
        sphereChristoffel(tc, phi, epsilon);

      let covT: number, covP: number;
      if (along) {
        covT = dvT + G0_00 * vT + G0_01 * vP;
        covP = dvP + G1_00 * vT + G1_01 * vP;
      } else {
        covT = dvT + G0_01 * vT + G0_11 * vP;
        covP = dvP + G1_01 * vT + G1_11 * vP;
      }

      // V (green)
      drawArrow(ctx, cx, cy, toSx(vT), toSy(vP), "#44aa44", 2.5);
      ctx.fillStyle = "#44aa44";
      ctx.font = "bold 10px monospace";
      ctx.fillText("V", toSx(vT) + 4, toSy(vP) - 4);

      // ∂_X V (orange)
      const pLen = Math.sqrt(dvT * dvT + dvP * dvP);
      if (pLen > 1e-4) {
        drawArrow(ctx, cx, cy, toSx(dvT), toSy(dvP), "#ff8800", 2.5);
        ctx.fillStyle = "#ff8800";
        ctx.font = "bold 10px monospace";
        ctx.fillText("∂ₓV", toSx(dvT) + 4, toSy(dvP) - 4);
      }

      // ∇_X V (purple)
      const cLen = Math.sqrt(covT * covT + covP * covP);
      if (cLen > 1e-4) {
        drawArrow(ctx, cx, cy, toSx(covT), toSy(covP), "#8844cc", 2.5);
        ctx.fillStyle = "#8844cc";
        ctx.font = "bold 10px monospace";
        ctx.fillText("∇ₓV", toSx(covT) + 4, toSy(covP) - 4);
      }
    }

    // Origin dot
    ctx.fillStyle = "#333";
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
    ctx.fillText("TₚS²", 6, 14);
  }, [point, tangentDir, showCov, covDir, epsilon]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!point) return;
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const scale = SIZE / (RANGE * 2);
      const cx = SIZE / 2;
      const cy = SIZE / 2;

      const a = (px - cx) / scale;
      const b = -(py - cy) / scale;

      dispatch({ type: "SET_CH3_TANGENT_DIRECTION", dir: [a, b] });
    },
    [point, dispatch],
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

  const headLen = 7;
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
