import { useRef, useEffect, useMemo } from "react";
import { useAppState } from "@/stores/app-store";
import { terrainSampler } from "@/lib/noise";
import { atlas, isInChart, chartDistance } from "@/lib/charts";
import { generateCurve } from "@/lib/curves";

const SIZE = 220;
const WORLD_RANGE = 50; // world-space radius to show around camera

export function ChartMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useAppState();

  const curveXZ = useMemo(() => {
    if (!state.showCurve || !state.selectedPoint) return null;
    const [px, , pz] = state.selectedPoint.position;
    return generateCurve(px, pz).pointsXZ;
  }, [state.showCurve, state.selectedPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chart = state.currentChart;
    const [camX, , camZ] = state.cameraPosition;
    const [dirX, , dirZ] = state.cameraDirection;

    // Clear
    ctx.fillStyle = "rgba(245, 245, 248, 0.95)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (!chart) {
      // Outside all charts — show a world-space view with chart territories
      const scale = SIZE / (WORLD_RANGE * 2);
      const toSx = (wx: number) => SIZE / 2 + (wx - camX) * scale;
      const toSy = (wz: number) => SIZE / 2 + (wz - camZ) * scale;

      // Terrain samples
      const step = 3;
      for (let wx = camX - WORLD_RANGE; wx <= camX + WORLD_RANGE; wx += step) {
        for (let wz = camZ - WORLD_RANGE; wz <= camZ + WORLD_RANGE; wz += step) {
          const h = terrainSampler.height(wx, wz);
          const t = (h + 8) / 16;
          const lum = Math.floor(205 + t * 30);
          ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
          ctx.fillRect(toSx(wx) - 1.5, toSy(wz) - 1.5, 3, 3);
        }
      }

      // Draw all chart territories
      for (const c of atlas) {
        // Fill
        ctx.fillStyle = c.color + "18";
        ctx.beginPath();
        ctx.arc(toSx(c.center[0]), toSy(c.center[1]), c.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        // Border
        ctx.strokeStyle = c.color + "88";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(toSx(c.center[0]), toSy(c.center[1]), c.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
        // Label
        ctx.fillStyle = c.color;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(c.label, toSx(c.center[0]), toSy(c.center[1]) + 3);
      }
      ctx.textAlign = "start";

      // Camera dot
      ctx.fillStyle = "#cc3333";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Border + label
      ctx.strokeStyle = "rgba(180, 80, 80, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(180, 60, 60, 0.8)";
      ctx.font = "bold 11px monospace";
      ctx.fillText("No chart", 6, 14);
      ctx.fillStyle = "rgba(100, 80, 80, 0.5)";
      ctx.font = "10px monospace";
      ctx.fillText("Outside all coordinate patches", 6, 28);
      return;
    }

    // We have an active chart — show chart coordinate space
    const MINIMAP_RANGE = 35;
    const [camU, camV] = chart.forward(camX, camZ);
    const scale = SIZE / (MINIMAP_RANGE * 2);
    const toSx = (u: number) => SIZE / 2 + (u - camU) * scale;
    const toSy = (v: number) => SIZE / 2 + (v - camV) * scale;

    // Chart domain fill
    ctx.fillStyle = chart.color + "12";
    ctx.beginPath();
    const bFillSteps = 80;
    for (let i = 0; i <= bFillSteps; i++) {
      const angle = (i / bFillSteps) * Math.PI * 2;
      const bx = chart.center[0] + chart.radius * Math.cos(angle);
      const bz = chart.center[1] + chart.radius * Math.sin(angle);
      const [bu, bv] = chart.forward(bx, bz);
      const sx = toSx(bu);
      const sy = toSy(bv);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.fill();

    // Overlap regions — sample grid in chart coords, paint pixels in other chart's color
    const overlapStep = 3;
    for (const other of atlas) {
      if (other.name === chart.name) continue;
      ctx.fillStyle = other.color + "18";
      for (
        let cu = camU - MINIMAP_RANGE;
        cu <= camU + MINIMAP_RANGE;
        cu += overlapStep
      ) {
        for (
          let cv = camV - MINIMAP_RANGE;
          cv <= camV + MINIMAP_RANGE;
          cv += overlapStep
        ) {
          const [wx, wz] = chart.inverse(cu, cv);
          if (!isInChart(chart, wx, wz) || !isInChart(other, wx, wz)) continue;
          const sx = toSx(cu);
          const sy = toSy(cv);
          ctx.fillRect(sx - 1.5, sy - 1.5, overlapStep * scale, overlapStep * scale);
        }
      }
    }

    // Chart coordinate grid lines
    const gridSpacing = 5;
    const lineSteps = 80;

    ctx.strokeStyle = chart.color + "77";
    ctx.lineWidth = 0.8;

    const uMin = Math.floor((camU - MINIMAP_RANGE) / gridSpacing) * gridSpacing;
    const uMax = camU + MINIMAP_RANGE;
    const vMin = camV - MINIMAP_RANGE;
    const vMax = camV + MINIMAP_RANGE;
    const vStep = (vMax - vMin) / lineSteps;

    for (let u = uMin; u <= uMax; u += gridSpacing) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= lineSteps; i++) {
        const v = vMin + i * vStep;
        const sx = toSx(u);
        const sy = toSy(v);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    const vGridMin = Math.floor((camV - MINIMAP_RANGE) / gridSpacing) * gridSpacing;
    const uStep2 = (uMax - (camU - MINIMAP_RANGE)) / lineSteps;

    for (let v = vGridMin; v <= vMax; v += gridSpacing) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= lineSteps; i++) {
        const u = camU - MINIMAP_RANGE + i * uStep2;
        const sx = toSx(u);
        const sy = toSy(v);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Current chart boundary (mapped into chart coords)
    ctx.strokeStyle = chart.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const bSteps = 100;
    for (let i = 0; i <= bSteps; i++) {
      const angle = (i / bSteps) * Math.PI * 2;
      const bx = chart.center[0] + chart.radius * Math.cos(angle);
      const bz = chart.center[1] + chart.radius * Math.sin(angle);
      const [bu, bv] = chart.forward(bx, bz);
      const sx = toSx(bu);
      const sy = toSy(bv);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Other charts' boundaries (showing where overlaps are)
    for (const other of atlas) {
      if (other.name === chart.name) continue;
      // Sample the other chart's boundary, map through current chart
      ctx.strokeStyle = other.color + "99";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= bSteps; i++) {
        const angle = (i / bSteps) * Math.PI * 2;
        const bx = other.center[0] + other.radius * Math.cos(angle);
        const bz = other.center[1] + other.radius * Math.sin(angle);
        if (!isInChart(chart, bx, bz)) {
          started = false;
          continue;
        }
        const [bu, bv] = chart.forward(bx, bz);
        const sx = toSx(bu);
        const sy = toSy(bv);
        if (sx < -30 || sx > SIZE + 30 || sy < -30 || sy > SIZE + 30) {
          started = false;
          continue;
        }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Label the neighboring chart if its center is visible
      if (isInChart(chart, other.center[0], other.center[1])) {
        const [ou, ov] = chart.forward(other.center[0], other.center[1]);
        const sx = toSx(ou);
        const sy = toSy(ov);
        if (sx > 10 && sx < SIZE - 10 && sy > 10 && sy < SIZE - 10) {
          ctx.fillStyle = other.color + "cc";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(other.label, sx, sy + 3);
          ctx.textAlign = "start";
        }
      }
    }

    // How close to boundary indicator
    const nd = chartDistance(chart, camX, camZ);
    if (nd > 0.7) {
      const warningAlpha = Math.min((nd - 0.7) / 0.3, 1);
      ctx.strokeStyle = `rgba(200, 100, 60, ${warningAlpha * 0.6})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    }

    // Curve through selected point
    if (state.showCurve && state.selectedPoint && curveXZ) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const [wx, wz] of curveXZ) {
        if (!isInChart(chart, wx, wz)) { started = false; continue; }
        const [cu, cv] = chart.forward(wx, wz);
        const sx = toSx(cu);
        const sy = toSy(cv);
        if (sx < -10 || sx > SIZE + 10 || sy < -10 || sy > SIZE + 10) { started = false; continue; }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Selected point
    if (state.selectedPoint) {
      const [px, , pz] = state.selectedPoint.position;
      if (isInChart(chart, px, pz)) {
        const [pu, pv] = chart.forward(px, pz);
        const sx = toSx(pu);
        const sy = toSy(pv);
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#aa8800";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Camera direction arrow
    const ahead = 2;
    const [aheadU, aheadV] = chart.forward(camX + dirX * ahead, camZ + dirZ * ahead);
    const adx = aheadU - camU;
    const adz = aheadV - camV;
    const alen = Math.sqrt(adx * adx + adz * adz);
    const arrowLen = 14;

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, SIZE / 2);
    ctx.lineTo(SIZE / 2 + (adx / alen) * arrowLen, SIZE / 2 + (adz / alen) * arrowLen);
    ctx.stroke();

    // Camera dot
    ctx.fillStyle = "#2266aa";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = chart.color + "66";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, SIZE, SIZE);

    // Title
    ctx.fillStyle = "rgba(60, 70, 90, 0.8)";
    ctx.font = "bold 11px monospace";
    ctx.fillText(chart.label, 6, 14);

    // Axis labels
    ctx.fillStyle = chart.color + "aa";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "right";
    ctx.fillText("u", SIZE - 6, SIZE / 2 - 4);
    ctx.textAlign = "center";
    ctx.fillText("v", SIZE / 2 + 8, SIZE - 5);
    ctx.textAlign = "start";

    // Coordinates
    ctx.fillStyle = "rgba(80, 90, 110, 0.6)";
    ctx.font = "10px monospace";
    ctx.fillText(`(${camU.toFixed(1)}, ${camV.toFixed(1)})`, 6, SIZE - 6);
  }, [state.cameraPosition, state.cameraDirection, state.selectedPoint, state.currentChart, state.showCurve, curveXZ]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="absolute top-4 right-4 rounded-lg pointer-events-auto"
    />
  );
}
