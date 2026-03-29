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

export interface AppState {
  cameraPosition: [number, number, number];
  cameraDirection: [number, number, number];
  selectedPoint: SelectedPoint | null;
  activeScalarFn: ScalarFnName;
  showWireframe: boolean;
  showContours: boolean;
  showScalarOverlay: boolean;
  tangentSpaceMode: boolean;
  currentChart: Chart | null;
  /** Components (a, b) of selected tangent vector v = a·e₁ + b·e₂ */
  tangentVector: [number, number] | null;
  showCurve: boolean;
  /** Reparameterization scale: t → paramScale·t, so γ'(0) scales by this factor */
  paramScale: number;
  showVectorField: boolean;
  vectorFieldSource: VectorFieldSource;
  showMetricTensor: boolean;
  showLieBracket: boolean;
  lieBracketFieldX: FieldId;
  lieBracketFieldY: FieldId;
}

export const initialState: AppState = {
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
};

export type AppAction =
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
  | { type: "SET_LIE_BRACKET_FIELD_Y"; field: FieldId };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
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
