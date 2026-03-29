import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import { scalarFunctions } from "@/lib/scalar-functions";
import { isInChart } from "@/lib/charts";
import { generateCurve } from "@/lib/curves";

function Vec({ label, v, color }: { label: string; v: [number, number, number]; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      {color && (
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-muted-foreground">{label}:</span>
      <span>
        ({v[0].toFixed(2)}, {v[1].toFixed(2)}, {v[2].toFixed(2)})
      </span>
    </div>
  );
}

export function InfoPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const point = state.selectedPoint;

  if (!point) return null;

  const [px, py, pz] = point.position;
  const chart = state.currentChart;

  // Chart coordinates
  const inChart = chart ? isInChart(chart, px, pz) : false;
  const [u, v] = chart && inChart ? chart.forward(px, pz) : [NaN, NaN];

  // Curve tangent decomposition in e₁/e₂ basis
  const curveDecomp = useMemo(() => {
    if (!state.showCurve) return null;
    const curve = generateCurve(px, pz);
    const [tx, ty, tz] = curve.tangent3D;
    const [e1x, e1y, e1z] = point.e1;
    const [e2x, e2y, e2z] = point.e2;
    // Solve: t = a·e1 + b·e2 via least squares (dot product projection)
    // Using the Gram matrix: [e1·e1, e1·e2; e2·e1, e2·e2] [a;b] = [e1·t; e2·t]
    const g11 = e1x * e1x + e1y * e1y + e1z * e1z;
    const g12 = e1x * e2x + e1y * e2y + e1z * e2z;
    const g22 = e2x * e2x + e2y * e2y + e2z * e2z;
    const t1 = e1x * tx + e1y * ty + e1z * tz;
    const t2 = e2x * tx + e2y * ty + e2z * tz;
    const det = g11 * g22 - g12 * g12;
    if (Math.abs(det) < 1e-10) return null;
    const a = (g22 * t1 - g12 * t2) / det;
    const b = (g11 * t2 - g12 * t1) / det;
    return { a, b, vec: [tx, ty, tz] as [number, number, number] };
  }, [state.showCurve, px, pz, point.e1, point.e2]);

  // Scalar value
  let scalarValue: number | null = null;
  if (state.activeScalarFn !== "none") {
    const fn = scalarFunctions[state.activeScalarFn];
    if (fn) scalarValue = fn.compute(px, py, pz);
  }

  return (
    <Card className="absolute bottom-4 left-4 w-64 bg-card/80 backdrop-blur-sm pointer-events-auto py-2 gap-2">
      <CardHeader className="pb-0 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Selected Point</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => dispatch({ type: "CLEAR_SELECTION" })}
        >
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <div className="text-xs font-mono">
          {chart ? (
            <>
              <span className="text-muted-foreground">{chart.label}:</span>{" "}
              {inChart ? (
                <span>({u.toFixed(2)}, {v.toFixed(2)})</span>
              ) : (
                <span className="text-muted-foreground italic">outside chart</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground italic">no active chart</span>
          )}
        </div>

        {scalarValue !== null && (
          <div className="text-xs font-mono">
            <span className="text-muted-foreground">
              {scalarFunctions[state.activeScalarFn]?.label}(p):
            </span>{" "}
            {scalarValue.toFixed(4)}
          </div>
        )}

        <div className="pt-1 space-y-1 border-t border-border/50">
          <Vec label="∂/∂u" v={point.e1} color="#ff4444" />
          <Vec label="∂/∂v" v={point.e2} color="#4488ff" />
        </div>

        {state.tangentVector && (
          <div className="pt-1 space-y-1 border-t border-border/50">
            <div className="text-xs font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-2" />
              <span className="text-muted-foreground">v:</span>{" "}
              {state.tangentVector[0].toFixed(2)}·∂/∂u + {state.tangentVector[1].toFixed(2)}·∂/∂v
            </div>
            {state.activeScalarFn !== "none" && (() => {
              const fn = scalarFunctions[state.activeScalarFn];
              if (!fn) return null;
              // Directional derivative: v[f] = (a·e1 + b·e2) · grad(f)
              // where e1, e2 are the 3D basis vectors and grad is in embedding coords
              const [a, b] = state.tangentVector!;
              const [gx, gy, gz] = fn.gradient(px, py, pz);
              const [e1x, e1y, e1z] = point.e1;
              const [e2x, e2y, e2z] = point.e2;
              const vx = a * e1x + b * e2x;
              const vy = a * e1y + b * e2y;
              const vz = a * e1z + b * e2z;
              const dirDeriv = vx * gx + vy * gy + vz * gz;
              return (
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">v[{fn.label.split(" ")[0]}]:</span>{" "}
                  <span className="text-green-700 font-semibold">{dirDeriv.toFixed(4)}</span>
                </div>
              );
            })()}
          </div>
        )}
        {state.showCurve && curveDecomp && (
          <div className="pt-1 space-y-1 border-t border-border/50">
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">γ′(0):</span>{" "}
              {curveDecomp.a.toFixed(2)}·∂/∂u + {curveDecomp.b.toFixed(2)}·∂/∂v
            </div>
            {state.activeScalarFn !== "none" && (() => {
              const fn = scalarFunctions[state.activeScalarFn];
              if (!fn) return null;
              const [gx, gy, gz] = fn.gradient(px, py, pz);
              const dirDeriv =
                curveDecomp.vec[0] * gx +
                curveDecomp.vec[1] * gy +
                curveDecomp.vec[2] * gz;
              return (
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">γ′(0)[{fn.label.split(" ")[0]}]:</span>{" "}
                  <span className="font-semibold">{dirDeriv.toFixed(4)}</span>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
