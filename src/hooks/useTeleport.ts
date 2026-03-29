import { createContext, useContext, type MutableRefObject } from "react";

export interface TeleportTarget {
  x: number;
  z: number;
  yaw: number;
}

export const TeleportContext = createContext<MutableRefObject<TeleportTarget | null>>({
  current: null,
});

export function useTeleport() {
  return useContext(TeleportContext);
}
