import { Toolbar } from "./Toolbar";
import { InfoPanel } from "./InfoPanel";
import { ChartMinimap } from "./ChartMinimap";
import { TangentMinimap } from "./TangentMinimap";
import { SceneSelector } from "./SceneSelector";
import { Ch3Toolbar } from "./Ch3Toolbar";
import { Ch3InfoPanel } from "./Ch3InfoPanel";
import { Ch3TangentMinimap } from "./Ch3TangentMinimap";
import { useAppState } from "@/stores/app-store";

export function HUD() {
  const state = useAppState();
  const isCh2 = state.activeScene === "chapter2";

  return (
    <div className="absolute inset-0 pointer-events-none">
      <SceneSelector />
      {isCh2 ? <Toolbar /> : <Ch3Toolbar />}
      {isCh2 ? <InfoPanel /> : <Ch3InfoPanel />}
      {isCh2 && <ChartMinimap />}
      {isCh2 ? <TangentMinimap /> : <Ch3TangentMinimap />}
    </div>
  );
}
