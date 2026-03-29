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
} from "@/stores/app-store";
import { useTeleport } from "@/hooks/useTeleport";

const scalarItems = [
  { label: "None", value: "none" },
  { label: "f₁ Temperature", value: "temperature" },
  { label: "f₂ Pressure", value: "pressure" },
  { label: "f₃ Density", value: "density" },
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
        {/* Scalar function selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Scalar Function
          </Label>
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
        </div>

        {/* Toggles */}
        <div className="space-y-3">
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
        </div>

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
