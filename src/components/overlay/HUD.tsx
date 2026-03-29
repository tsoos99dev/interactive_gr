import { Toolbar } from "./Toolbar";
import { InfoPanel } from "./InfoPanel";
import { ChartMinimap } from "./ChartMinimap";
import { TangentMinimap } from "./TangentMinimap";

export function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Toolbar />
      <InfoPanel />
      <ChartMinimap />
      <TangentMinimap />
    </div>
  );
}
