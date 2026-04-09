import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppState, useAppDispatch } from "@/stores/app-store";
import { gaussianCurvature, riemannTensor } from "@/lib/curvature";
import { sphereChristoffel } from "@/lib/sphere";
import { holonomyLoop } from "@/lib/parallel-transport";

export function Ch3InfoPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const point = state.ch3SelectedPoint;

  const K = useMemo(() => {
    if (!point) return null;
    console.time("curvatureAtPoint");
    const k = gaussianCurvature(point.theta, point.phi, state.ch3Bumpiness);
    console.timeEnd("curvatureAtPoint");
    return k;
  }, [point, state.ch3Bumpiness]);

  const christoffelValues = useMemo(() => {
    if (!point || !state.ch3ShowCovariantDeriv) return null;
    return sphereChristoffel(point.theta, point.phi, state.ch3Bumpiness);
  }, [point, state.ch3Bumpiness, state.ch3ShowCovariantDeriv]);

  const riemann = useMemo(() => {
    if (!point) return null;
    return riemannTensor(point.theta, point.phi, state.ch3Bumpiness);
  }, [point, state.ch3Bumpiness]);

  const holonomy = useMemo(() => {
    if (!point || !state.ch3ShowParallelTransport) return null;
    const maxSize = Math.min(
      state.ch3LoopSize,
      point.theta - 0.05,
      Math.PI - point.theta - 0.05,
    );
    if (maxSize < 0.05) return null;
    return holonomyLoop(point.theta, point.phi, maxSize, state.ch3Bumpiness);
  }, [point, state.ch3LoopSize, state.ch3Bumpiness, state.ch3ShowParallelTransport]);

  if (!point) return null;

  const thetaDeg = (point.theta * 180) / Math.PI;
  const phiDeg = (point.phi * 180) / Math.PI;

  return (
    <Card className="absolute bottom-4 left-4 w-64 bg-card/80 backdrop-blur-sm pointer-events-auto py-2 gap-2">
      <CardHeader className="pb-0 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Selected Point</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() =>
            dispatch({ type: "SET_CH3_SELECTED_POINT", point: null })
          }
        >
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* Coordinates */}
        <div className="text-xs font-mono">
          <span className="text-muted-foreground">θ, φ:</span>{" "}
          ({thetaDeg.toFixed(1)}°, {phiDeg.toFixed(1)}°)
        </div>

        {/* Curvature */}
        {K !== null && (
          <div className="text-xs font-mono">
            <span className="text-muted-foreground">K:</span>{" "}
            {K.toFixed(4)}
            <span className="text-muted-foreground ml-2">R = 2K:</span>{" "}
            {(2 * K).toFixed(4)}
          </div>
        )}

        {/* Riemann tensor */}
        {riemann && (
          <div className="pt-1 space-y-0.5 border-t border-border/50">
            <div className="text-xs text-muted-foreground">Riemann R<sup>ρ</sup><sub>σθφ</sub> <span className="opacity-60">(R<sup>ρ</sup><sub>σφθ</sub> = −R<sup>ρ</sup><sub>σθφ</sub>)</span></div>
            <div className="text-xs font-mono grid grid-cols-2 gap-x-2">
              <span>
                R<sup>θ</sup><sub>θθφ</sub> = {riemann[0].toFixed(3)}
              </span>
              <span>
                R<sup>θ</sup><sub>φθφ</sub> = {riemann[1].toFixed(3)}
              </span>
              <span>
                R<sup>φ</sup><sub>θθφ</sub> = {riemann[2].toFixed(3)}
              </span>
              <span>
                R<sup>φ</sup><sub>φθφ</sub> = {riemann[3].toFixed(3)}
              </span>
            </div>
          </div>
        )}

        {/* Christoffel symbols */}
        {christoffelValues && (
          <div className="pt-1 space-y-0.5 border-t border-border/50">
            <div className="text-xs text-muted-foreground">Christoffel Γ <span className="opacity-60">(Γ<sup>k</sup><sub>ij</sub> = Γ<sup>k</sup><sub>ji</sub>)</span></div>
            <div className="text-xs font-mono grid grid-cols-2 gap-x-2">
              <span>
                Γ<sup>θ</sup><sub>θθ</sub> = {christoffelValues[0].toFixed(3)}
              </span>
              <span>
                Γ<sup>φ</sup><sub>θθ</sub> = {christoffelValues[3].toFixed(3)}
              </span>
              <span>
                Γ<sup>θ</sup><sub>θφ</sub> = {christoffelValues[1].toFixed(3)}
              </span>
              <span>
                Γ<sup>φ</sup><sub>θφ</sub> = {christoffelValues[4].toFixed(3)}
              </span>
              <span>
                Γ<sup>θ</sup><sub>φφ</sub> = {christoffelValues[2].toFixed(3)}
              </span>
              <span>
                Γ<sup>φ</sup><sub>φφ</sub> = {christoffelValues[5].toFixed(3)}
              </span>
            </div>
          </div>
        )}

        {/* Holonomy */}
        {holonomy && (
          <div className="pt-1 space-y-1 border-t border-border/50">
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">Holonomy:</span>{" "}
              <span className="font-semibold">
                {((holonomy.holonomyAngle * 180) / Math.PI).toFixed(2)}°
              </span>
              <span className="text-muted-foreground ml-1">
                ({holonomy.holonomyAngle.toFixed(4)} rad)
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
