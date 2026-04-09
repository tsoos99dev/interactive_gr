import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAppState,
  useAppDispatch,
  type Ch3GeodesicMode,
  type Ch3CovariantDir,
} from "@/stores/app-store";

const covariantDirItems = [
  { label: "∂/∂θ", value: "dtheta" },
  { label: "∂/∂φ", value: "dphi" },
];

const geodesicModeItems = [
  { label: "Spray", value: "spray" },
  { label: "Single", value: "single" },
];

export function Ch3Toolbar() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const [localBump, setLocalBump] = useState(state.ch3Bumpiness);

  return (
    <Card className="absolute top-4 left-4 w-56 bg-card/80 backdrop-blur-sm pointer-events-auto py-2 gap-2">
      <CardHeader className="pb-0 px-4">
        <CardTitle className="text-sm font-medium">Curvature Controls</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Bumpiness slider — commits on release */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Bumpiness ε{" "}
            <span className="font-mono">{localBump.toFixed(3)}</span>
          </Label>
          <input
            type="range"
            min={0}
            max={0.15}
            step={0.002}
            value={localBump}
            onChange={(e) => setLocalBump(parseFloat(e.target.value))}
            onPointerUp={() =>
              dispatch({ type: "SET_CH3_BUMPINESS", value: localBump })
            }
            className="w-full h-1.5 accent-foreground cursor-pointer"
          />
        </div>

        <div className="space-y-3">
          {/* Curvature toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-curvature" className="text-xs">
              Curvature K
            </Label>
            <Switch
              id="ch3-curvature"
              checked={state.ch3ShowCurvature}
              onCheckedChange={() => dispatch({ type: "TOGGLE_CH3_CURVATURE" })}
            />
          </div>

          {/* Geodesics toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-geodesics" className="text-xs">
              Geodesics
            </Label>
            <Switch
              id="ch3-geodesics"
              checked={state.ch3ShowGeodesics}
              onCheckedChange={() => dispatch({ type: "TOGGLE_CH3_GEODESICS" })}
            />
          </div>

          {/* Geodesic sub-controls */}
          {state.ch3ShowGeodesics && (
            <div className="space-y-1.5 pl-2 border-l border-border/50">
              <Select
                items={geodesicModeItems}
                value={state.ch3GeodesicMode}
                onValueChange={(v) =>
                  dispatch({ type: "SET_CH3_GEODESIC_MODE", mode: v as Ch3GeodesicMode })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {geodesicModeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.ch3GeodesicMode === "spray" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Directions:{" "}
                    <span className="font-mono">{state.ch3GeodesicCount}</span>
                  </Label>
                  <input
                    type="range"
                    min={4}
                    max={24}
                    step={1}
                    value={state.ch3GeodesicCount}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_CH3_GEODESIC_COUNT",
                        count: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-1.5 accent-foreground cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* Covariant derivative toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-covariant" className="text-xs">
              ∇ Covariant
            </Label>
            <Switch
              id="ch3-covariant"
              checked={state.ch3ShowCovariantDeriv}
              onCheckedChange={() =>
                dispatch({ type: "TOGGLE_CH3_COVARIANT_DERIV" })
              }
            />
          </div>

          {state.ch3ShowCovariantDeriv && (
            <div className="space-y-1.5 pl-2 border-l border-border/50">
              <Label className="text-xs text-muted-foreground">
                Direction X
              </Label>
              <Select
                items={covariantDirItems}
                value={state.ch3CovariantDir}
                onValueChange={(v) =>
                  dispatch({ type: "SET_CH3_COVARIANT_DIR", dir: v as Ch3CovariantDir })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {covariantDirItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Parallel transport toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-transport" className="text-xs">
              Parallel Transport
            </Label>
            <Switch
              id="ch3-transport"
              checked={state.ch3ShowParallelTransport}
              onCheckedChange={() =>
                dispatch({ type: "TOGGLE_CH3_PARALLEL_TRANSPORT" })
              }
            />
          </div>

          {state.ch3ShowParallelTransport && (
            <div className="space-y-1.5 pl-2 border-l border-border/50">
              <Label className="text-xs text-muted-foreground">
                Loop size{" "}
                <span className="font-mono">
                  {state.ch3LoopSize.toFixed(2)} rad
                </span>
              </Label>
              <input
                type="range"
                min={0.1}
                max={1.5}
                step={0.05}
                value={state.ch3LoopSize}
                onChange={(e) =>
                  dispatch({
                    type: "SET_CH3_LOOP_SIZE",
                    size: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 accent-foreground cursor-pointer"
              />
            </div>
          )}

          {/* Geodesic deviation toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-deviation" className="text-xs">
              Deviation
            </Label>
            <Switch
              id="ch3-deviation"
              checked={state.ch3ShowDeviation}
              onCheckedChange={() =>
                dispatch({ type: "TOGGLE_CH3_DEVIATION" })
              }
            />
          </div>

          {state.ch3ShowDeviation && (
            <div className="space-y-1.5 pl-2 border-l border-border/50">
              <Label className="text-xs text-muted-foreground">
                Spread{" "}
                <span className="font-mono">
                  {(state.ch3DeviationSpread * (180 / Math.PI)).toFixed(1)}°
                </span>
              </Label>
              <input
                type="range"
                min={0.02}
                max={0.5}
                step={0.01}
                value={state.ch3DeviationSpread}
                onChange={(e) =>
                  dispatch({
                    type: "SET_CH3_DEVIATION_SPREAD",
                    spread: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 accent-foreground cursor-pointer"
              />
            </div>
          )}

          {/* Normal coordinates toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ch3-normal-coords" className="text-xs">
              Normal Coords
            </Label>
            <Switch
              id="ch3-normal-coords"
              checked={state.ch3ShowNormalCoords}
              onCheckedChange={() =>
                dispatch({ type: "TOGGLE_CH3_NORMAL_COORDS" })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
