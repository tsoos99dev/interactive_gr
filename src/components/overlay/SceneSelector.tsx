import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppState, useAppDispatch, type ActiveScene } from "@/stores/app-store";

const sceneItems = [
  { label: "Ch 2 · Charts & Vectors", value: "chapter2" },
  { label: "Ch 3 · Curvature", value: "chapter3" },
];

export function SceneSelector() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <Select
        items={sceneItems}
        value={state.activeScene}
        onValueChange={(v) => dispatch({ type: "SET_SCENE", scene: v as ActiveScene })}
      >
        <SelectTrigger className="h-8 text-xs bg-card/80 backdrop-blur-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sceneItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
