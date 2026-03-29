import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  type ScalarFnName,
  type VectorFieldSource,
  type FieldId,
} from "@/stores/app-store";
import { useTeleport } from "@/hooks/useTeleport";

const scalarItems = [
  { label: "f₁ Temperature", value: "temperature" },
  { label: "f₂ Pressure", value: "pressure" },
  { label: "f₃ Density", value: "density" },
];

const vectorFieldSourceItems = [
  { label: "Noise", value: "noise" },
  { label: "∇f (gradient)", value: "gradient" },
];

const fieldItems = [
  { label: "Noise", value: "noise" },
  { label: "∇ Temperature", value: "grad-temperature" },
  { label: "∇ Pressure", value: "grad-pressure" },
  { label: "∇ Density", value: "grad-density" },
];

export function Toolbar() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const teleportRef = useTeleport();

  return (
    <Card className="absolute top-4 left-4 w-56 bg-card/80 backdrop-blur-sm pointer-events-auto py-2 gap-2">
      <CardHeader className="pb-0 px-4">
        <CardTitle className="text-sm font-medium">Manifold Controls</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Toggles */}
        <div className="space-y-3">
          <Select
            items={scalarItems}
            value={state.activeScalarFn}
            onValueChange={(v) =>
              dispatch({ type: "SET_SCALAR_FN", fn: v as ScalarFnName })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scalarItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <Label htmlFor="scalar-overlay" className="text-xs">
              Scalar f
            </Label>
            <Switch
              id="scalar-overlay"
              checked={state.showScalarOverlay}
              onCheckedChange={() =>
                dispatch({ type: "TOGGLE_SCALAR_OVERLAY" })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="tangent-mode" className="text-xs">
              Show TₚM
            </Label>
            <Switch
              id="tangent-mode"
              checked={state.tangentSpaceMode}
              onCheckedChange={() => dispatch({ type: "TOGGLE_TANGENT_MODE" })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="curve" className="text-xs">
              Curve γ
            </Label>
            <Switch
              id="curve"
              checked={state.showCurve}
              onCheckedChange={() => dispatch({ type: "TOGGLE_CURVE" })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="contours" className="text-xs">
              Contour Lines
            </Label>
            <Switch
              id="contours"
              checked={state.showContours}
              onCheckedChange={() => dispatch({ type: "TOGGLE_CONTOURS" })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="vector-field" className="text-xs">
              Vector Field V
            </Label>
            <Switch
              id="vector-field"
              checked={state.showVectorField}
              onCheckedChange={() => dispatch({ type: "TOGGLE_VECTOR_FIELD" })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="metric-tensor" className="text-xs">
              Metric
              <span>
                g<sub>ij</sub>
              </span>
            </Label>
            <Switch
              id="metric-tensor"
              checked={state.showMetricTensor}
              onCheckedChange={() => dispatch({ type: "TOGGLE_METRIC_TENSOR" })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="lie-bracket" className="text-xs">
              [X, Y] Bracket
            </Label>
            <Switch
              id="lie-bracket"
              checked={state.showLieBracket}
              onCheckedChange={() => dispatch({ type: "TOGGLE_LIE_BRACKET" })}
            />
          </div>
        </div>

        {/* Vector field source dropdown */}
        {state.showVectorField && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Field Source
            </Label>
            <Select
              items={vectorFieldSourceItems}
              value={state.vectorFieldSource}
              onValueChange={(v) =>
                dispatch({
                  type: "SET_VECTOR_FIELD_SOURCE",
                  source: v as VectorFieldSource,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vectorFieldSourceItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lie bracket field selectors */}
        {state.showLieBracket && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Bracket Fields
            </Label>
            <Select
              items={fieldItems}
              value={state.lieBracketFieldX}
              onValueChange={(v) =>
                dispatch({
                  type: "SET_LIE_BRACKET_FIELD_X",
                  field: v as FieldId,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <span className="text-muted-foreground mr-1">X:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={fieldItems}
              value={state.lieBracketFieldY}
              onValueChange={(v) =>
                dispatch({
                  type: "SET_LIE_BRACKET_FIELD_Y",
                  field: v as FieldId,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <span className="text-muted-foreground mr-1">Y:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Parameterization scale slider — visible when curve is shown */}
        {state.showCurve && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Param. scale{" "}
              <span className="font-mono">
                {state.paramScale.toFixed(2)}&#x202F;t
              </span>
            </Label>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.05}
              value={state.paramScale}
              onChange={(e) =>
                dispatch({
                  type: "SET_PARAM_SCALE",
                  scale: parseFloat(e.target.value),
                })
              }
              className="w-full h-1.5 accent-foreground cursor-pointer"
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7"
          onClick={() => {
            teleportRef.current = { x: 0, z: 0, yaw: 0 };
          }}
        >
          Home
        </Button>
      </CardContent>
    </Card>
  );
}
