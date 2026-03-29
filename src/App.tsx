import { useReducer, useRef } from "react";
import { ManifoldScene } from "@/components/scene/ManifoldScene";
import { HUD } from "@/components/overlay/HUD";
import {
  AppStateContext,
  AppDispatchContext,
  appReducer,
  initialState,
} from "@/stores/app-store";
import { TeleportContext, type TeleportTarget } from "@/hooks/useTeleport";

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const teleportRef = useRef<TeleportTarget | null>(null);

  return (
    <AppStateContext value={state}>
      <AppDispatchContext value={dispatch}>
        <TeleportContext value={teleportRef}>
          <div className="h-screen w-screen relative overflow-hidden bg-[#f0f0f0]">
            <ManifoldScene />
            <HUD />
          </div>
        </TeleportContext>
      </AppDispatchContext>
    </AppStateContext>
  );
}

export default App;
