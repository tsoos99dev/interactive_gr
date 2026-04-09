import { createContext, useContext, type Dispatch } from "react";
import { type Chart, atlas, pickChart } from "@/lib/charts";

export interface SelectedPoint {
  position: [number, number, number];
  /** Normalized basis vector ∂/∂u */
  e1: [number, number, number];
  /** Normalized basis vector ∂/∂v */
  e2: [number, number, number];
  /** Unnormalized pushforward ∂φ⁻¹/∂u — needed to reconstruct tangent from chart components */
  e1Raw: [number, number, number];
  /** Unnormalized pushforward ∂φ⁻¹/∂v */
  e2Raw: [number, number, number];
  normal: [number, number, number];
}

export type ScalarFnName =
  | "temperature"
  | "pressure"
  | "density";

export type VectorFieldSource = "noise" | "gradient";
export type FieldId = "noise" | "grad-temperature" | "grad-pressure" | "grad-density";

export type ActiveScene = "chapter2" | "chapter3";

function loadActiveScene(): ActiveScene {
  const stored = localStorage.getItem("activeScene");
  if (stored === "chapter2" || stored === "chapter3") return stored;
  return "chapter2";
}
export type Ch3GeodesicMode = "spray" | "single";
export type Ch3CovariantDir = "dtheta" | "dphi";

export interface Ch3SelectedPoint {
  theta: number;
  phi: number;
  position: [number, number, number];
  eTheta: [number, number, number];
  ePhi: [number, number, number];
  normal: [number, number, number];
}

export interface AppState {
  activeScene: ActiveScene;

  // ── Chapter 2 ──
  cameraPosition: [number, number, number];
  cameraDirection: [number, number, number];
  selectedPoint: SelectedPoint | null;
  activeScalarFn: ScalarFnName;
  showWireframe: boolean;
  showContours: boolean;
  showScalarOverlay: boolean;
  tangentSpaceMode: boolean;
  currentChart: Chart | null;
  tangentVector: [number, number] | null;
  showCurve: boolean;
  paramScale: number;
  showVectorField: boolean;
  vectorFieldSource: VectorFieldSource;
  showMetricTensor: boolean;
  showLieBracket: boolean;
  lieBracketFieldX: FieldId;
  lieBracketFieldY: FieldId;

  // ── Chapter 3 ──
  ch3Bumpiness: number;
  ch3ShowCurvature: boolean;
  ch3ShowGeodesics: boolean;
  ch3GeodesicMode: Ch3GeodesicMode;
  ch3GeodesicCount: number;
  ch3ShowCovariantDeriv: boolean;
  ch3CovariantDir: Ch3CovariantDir;
  ch3ShowParallelTransport: boolean;
  ch3LoopSize: number;
  ch3ShowDeviation: boolean;
  ch3DeviationSpread: number;
  ch3ShowNormalCoords: boolean;
  ch3SelectedPoint: Ch3SelectedPoint | null;
  ch3TangentDirection: [number, number] | null;
}

export const initialState: AppState = {
  activeScene: loadActiveScene(),

  // Chapter 2
  cameraPosition: [0, 5, 0],
  cameraDirection: [0, 0, -1],
  selectedPoint: null,
  activeScalarFn: "temperature",
  showWireframe: false,
  showContours: false,
  showScalarOverlay: false,
  tangentSpaceMode: true,
  currentChart: atlas[0],
  tangentVector: null,
  showCurve: false,
  paramScale: 1.0,
  showVectorField: false,
  vectorFieldSource: "noise",
  showMetricTensor: false,
  showLieBracket: false,
  lieBracketFieldX: "noise",
  lieBracketFieldY: "grad-temperature",

  // Chapter 3
  ch3Bumpiness: 0,
  ch3ShowCurvature: false,
  ch3ShowGeodesics: false,
  ch3GeodesicMode: "spray",
  ch3GeodesicCount: 12,
  ch3ShowCovariantDeriv: false,
  ch3CovariantDir: "dtheta",
  ch3ShowParallelTransport: false,
  ch3LoopSize: 0.6,
  ch3ShowDeviation: false,
  ch3DeviationSpread: 0.15,
  ch3ShowNormalCoords: false,
  ch3SelectedPoint: null,
  ch3TangentDirection: null,
};

export type AppAction =
  | { type: "SET_SCENE"; scene: ActiveScene }
  | { type: "SET_CAMERA"; position: [number, number, number]; direction: [number, number, number] }
  | { type: "SELECT_POINT"; point: SelectedPoint }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_SCALAR_FN"; fn: ScalarFnName }
  | { type: "TOGGLE_WIREFRAME" }
  | { type: "TOGGLE_CONTOURS" }
  | { type: "TOGGLE_SCALAR_OVERLAY" }
  | { type: "TOGGLE_TANGENT_MODE" }
  | { type: "SET_TANGENT_VECTOR"; v: [number, number] | null }
  | { type: "TOGGLE_CURVE" }
  | { type: "SET_PARAM_SCALE"; scale: number }
  | { type: "TOGGLE_VECTOR_FIELD" }
  | { type: "SET_VECTOR_FIELD_SOURCE"; source: VectorFieldSource }
  | { type: "TOGGLE_METRIC_TENSOR" }
  | { type: "TOGGLE_LIE_BRACKET" }
  | { type: "SET_LIE_BRACKET_FIELD_X"; field: FieldId }
  | { type: "SET_LIE_BRACKET_FIELD_Y"; field: FieldId }
  // Chapter 3 actions
  | { type: "SET_CH3_BUMPINESS"; value: number }
  | { type: "TOGGLE_CH3_CURVATURE" }
  | { type: "TOGGLE_CH3_GEODESICS" }
  | { type: "SET_CH3_GEODESIC_MODE"; mode: Ch3GeodesicMode }
  | { type: "SET_CH3_GEODESIC_COUNT"; count: number }
  | { type: "TOGGLE_CH3_COVARIANT_DERIV" }
  | { type: "SET_CH3_COVARIANT_DIR"; dir: Ch3CovariantDir }
  | { type: "TOGGLE_CH3_PARALLEL_TRANSPORT" }
  | { type: "SET_CH3_LOOP_SIZE"; size: number }
  | { type: "TOGGLE_CH3_DEVIATION" }
  | { type: "SET_CH3_DEVIATION_SPREAD"; spread: number }
  | { type: "TOGGLE_CH3_NORMAL_COORDS" }
  | { type: "SET_CH3_SELECTED_POINT"; point: Ch3SelectedPoint | null }
  | { type: "SET_CH3_TANGENT_DIRECTION"; dir: [number, number] | null };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_SCENE":
      localStorage.setItem("activeScene", action.scene);
      return { ...state, activeScene: action.scene };
    case "SET_CAMERA": {
      const newChart = pickChart(
        action.position[0],
        action.position[2],
        state.currentChart
      );
      const chartChanged = newChart?.name !== state.currentChart?.name;
      return {
        ...state,
        cameraPosition: action.position,
        cameraDirection: action.direction,
        currentChart: newChart,
        ...(chartChanged ? { selectedPoint: null, tangentVector: null } : {}),
      };
    }
    case "SELECT_POINT":
      return { ...state, selectedPoint: action.point, tangentVector: null };
    case "CLEAR_SELECTION":
      return { ...state, selectedPoint: null, tangentVector: null };
    case "SET_TANGENT_VECTOR":
      return { ...state, tangentVector: action.v };
    case "SET_SCALAR_FN":
      return {
        ...state,
        activeScalarFn: action.fn,
      };
    case "TOGGLE_WIREFRAME":
      return { ...state, showWireframe: !state.showWireframe };
    case "TOGGLE_CONTOURS":
      return { ...state, showContours: !state.showContours };
    case "TOGGLE_SCALAR_OVERLAY":
      return { ...state, showScalarOverlay: !state.showScalarOverlay };
    case "TOGGLE_TANGENT_MODE":
      return { ...state, tangentSpaceMode: !state.tangentSpaceMode };
    case "TOGGLE_CURVE":
      return { ...state, showCurve: !state.showCurve };
    case "SET_PARAM_SCALE":
      return { ...state, paramScale: action.scale };
    case "TOGGLE_VECTOR_FIELD":
      return { ...state, showVectorField: !state.showVectorField };
    case "SET_VECTOR_FIELD_SOURCE":
      return { ...state, vectorFieldSource: action.source };
    case "TOGGLE_METRIC_TENSOR":
      return { ...state, showMetricTensor: !state.showMetricTensor };
    case "TOGGLE_LIE_BRACKET":
      return { ...state, showLieBracket: !state.showLieBracket };
    case "SET_LIE_BRACKET_FIELD_X":
      return { ...state, lieBracketFieldX: action.field };
    case "SET_LIE_BRACKET_FIELD_Y":
      return { ...state, lieBracketFieldY: action.field };
    // Chapter 3
    case "SET_CH3_BUMPINESS":
      return { ...state, ch3Bumpiness: action.value };
    case "TOGGLE_CH3_CURVATURE":
      return { ...state, ch3ShowCurvature: !state.ch3ShowCurvature };
    case "TOGGLE_CH3_GEODESICS":
      return { ...state, ch3ShowGeodesics: !state.ch3ShowGeodesics };
    case "SET_CH3_GEODESIC_MODE":
      return { ...state, ch3GeodesicMode: action.mode };
    case "SET_CH3_GEODESIC_COUNT":
      return { ...state, ch3GeodesicCount: action.count };
    case "TOGGLE_CH3_COVARIANT_DERIV":
      return { ...state, ch3ShowCovariantDeriv: !state.ch3ShowCovariantDeriv };
    case "SET_CH3_COVARIANT_DIR":
      return { ...state, ch3CovariantDir: action.dir };
    case "TOGGLE_CH3_PARALLEL_TRANSPORT":
      return { ...state, ch3ShowParallelTransport: !state.ch3ShowParallelTransport };
    case "SET_CH3_LOOP_SIZE":
      return { ...state, ch3LoopSize: action.size };
    case "TOGGLE_CH3_DEVIATION":
      return { ...state, ch3ShowDeviation: !state.ch3ShowDeviation };
    case "SET_CH3_DEVIATION_SPREAD":
      return { ...state, ch3DeviationSpread: action.spread };
    case "TOGGLE_CH3_NORMAL_COORDS":
      return { ...state, ch3ShowNormalCoords: !state.ch3ShowNormalCoords };
    case "SET_CH3_SELECTED_POINT":
      return { ...state, ch3SelectedPoint: action.point, ch3TangentDirection: null };
    case "SET_CH3_TANGENT_DIRECTION":
      return { ...state, ch3TangentDirection: action.dir };
  }
}

export const AppStateContext = createContext<AppState>(initialState);
export const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}
