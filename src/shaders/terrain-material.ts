import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import type { Node } from "three/webgpu";
import {
  Fn,
  uniform,
  uniformArray,
  attribute,
  varying,
  vec3,
  float,
  int,
  positionWorld,
  normalView,
  cameraPosition,
  normalize,
  dot,
  max,
  min,
  abs,
  clamp,
  smoothstep,
  fract,
  fwidth,
  step,
  mix,
  mod,
  length,
  If,
  Loop,
  Break,
  select,
} from "three/tsl";
import type { Chart } from "@/lib/charts";

/* ── Branchless HSL → RGB ───────────────────────────────────── */
const hsl2rgb = Fn(([h, s, l]: [any, any, any]) => {
  const hx6 = float(h).mul(6.0);
  const raw = vec3(hx6, hx6.add(4.0), hx6.add(2.0));
  const rgb = clamp(abs(mod(raw, 6.0).sub(3.0)).sub(1.0), 0.0, 1.0);
  const chroma = float(1.0).sub(abs(float(l).mul(2.0).sub(1.0)));
  // l + s * (rgb - 0.5) * (1 - |2l - 1|)
  return rgb.sub(0.5).mul(float(s)).mul(chroma).add(float(l));
});

// Helper: cast a loosely-typed TSL node to a concrete type for TS
const f = (n: any) => n as Node<"float">;
const v2 = (n: any) => n as Node<"vec2">;
const v3 = (n: any) => n as Node<"vec3">;

/* ── Create the terrain node material ────────────────────────── */
export function createTerrainMaterial(atlas: Chart[]) {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.side = THREE.DoubleSide;
  material.depthWrite = true;
  material.toneMapped = false;

  /* ---- uniforms ---- */
  const uFogRadius = uniform(45.0);
  const uFogFalloff = uniform(12.0);
  const uBaseColor = uniform(new THREE.Color(0.92, 0.92, 0.92));
  const uFogColor = uniform(new THREE.Color(0xf0f0f0));
  const uShowScalar = uniform(0.0);
  const uShowContours = uniform(0.0);
  const uScalarMin = uniform(-8.0);
  const uScalarMax = uniform(8.0);
  const uShowWireframe = uniform(0.0);
  const uChartGridSpacing = uniform(5.0);
  const uChartGridColor = uniform(new THREE.Color(atlas[0].color));
  const uActiveChartIdx = uniform(0.0);
  const uChartCount = uniform(float(atlas.length));

  const uChartCenters = uniformArray(
    atlas.map((c) => new THREE.Vector2(c.center[0], c.center[1])),
    "vec2",
  );
  const uChartRadii = uniformArray(
    atlas.map((c) => c.radius),
    "float",
  );
  const uChartColors = uniformArray(
    atlas.map((c) => new THREE.Color(c.color)),
    "color",
  );

  /* ---- per-vertex custom attributes (auto-varied to fragment) ---- */
  const vScalar = f(varying(attribute("aScalar", "float"), "v_scalar"));
  const vChartCoordRaw = v2(
    varying(attribute("aChartCoord", "vec2"), "v_chartCoord"),
  );
  const vChartInDomain = f(
    varying(attribute("aChartInDomain", "float"), "v_inDomain"),
  );

  /* ================ colour node ================ */
  material.colorNode = Fn(() => {
    // Basic diffuse lighting from a fixed direction
    const lightDir = normalize(vec3(0.5, 0.8, 0.3));
    const diff = max(dot(normalView, lightDir), 0.0).mul(0.7).add(0.3);
    const col = uBaseColor.mul(diff).toVar("col");

    // Scalar-field heat-map overlay
    If(uShowScalar.greaterThan(0.5), () => {
      const range = uScalarMax.sub(uScalarMin);
      const t = clamp(vScalar.sub(uScalarMin).div(max(range, 0.001)), 0.0, 1.0);
      const hue = float(1.0).sub(t).mul(0.667);
      col.assign(mix(col, hsl2rgb(hue, float(0.75), float(0.5)), 0.45));
    });

    // Contour lines on the scalar field
    If(uShowContours.greaterThan(0.5), () => {
      const range = uScalarMax.sub(uScalarMin);
      const t = vScalar.sub(uScalarMin).div(max(range, 0.001));
      const lines = abs(fract(t.mul(15.0)).sub(0.5));
      const contour = smoothstep(0.02, 0.06, lines);
      col.mulAssign(contour.mul(0.4).add(0.6));
    });

    // Chart coordinate grid on the terrain (component-wise smoothstep)
    If(vChartInDomain.greaterThan(0.5), () => {
      const chartScaledX = vChartCoordRaw.x.div(uChartGridSpacing);
      const chartScaledY = vChartCoordRaw.y.div(uChartGridSpacing);
      const fwX = fwidth(chartScaledX);
      const fwY = fwidth(chartScaledY);
      const lineWidth = float(1.2);
      const gridX = smoothstep(
        0.0,
        fwX.mul(lineWidth),
        abs(fract(chartScaledX.sub(0.5)).sub(0.5)),
      );
      const gridY = smoothstep(
        0.0,
        fwY.mul(lineWidth),
        abs(fract(chartScaledY.sub(0.5)).sub(0.5)),
      );
      const gridMask = float(1.0).sub(min(gridX, gridY));

      // Fade grid out near the chart boundary to avoid distortion artifacts
      const activeCenter = v2(uChartCenters.element(int(uActiveChartIdx)));
      const activeRadius = f(uChartRadii.element(int(uActiveChartIdx)));
      const distToCenter = length(positionWorld.xz.sub(activeCenter));
      const edgeFade = float(1.0).sub(
        smoothstep(activeRadius.mul(0.96), activeRadius.mul(1), distToCenter),
      );

      col.assign(mix(col, uChartGridColor, gridMask.mul(0.55).mul(edgeFade)));
    });

    // Wireframe grid
    If(uShowWireframe.greaterThan(0.5), () => {
      const wfX = abs(fract(positionWorld.x.mul(0.5)).sub(0.5));
      const wfZ = abs(fract(positionWorld.z.mul(0.5)).sub(0.5));
      const wf = float(1.0).sub(step(0.48, wfX).mul(step(0.48, wfZ)));
      col.assign(mix(col, vec3(0.55, 0.6, 0.7), wf.mul(0.35)));
    });

    // Chart boundaries + overlap tinting
    const chartsHere = int(0).toVar("chartsHere");
    const overlapTint = vec3(0.0, 0.0, 0.0).toVar("overlap");

    Loop(4, ({ i }) => {
      If(float(i).greaterThanEqual(uChartCount), () => {
        Break();
      });

      const center = v2(uChartCenters.element(i));
      const cDist = length(positionWorld.xz.sub(center));
      const radius = f(uChartRadii.element(i));
      const cColor = v3(uChartColors.element(i));

      If(cDist.lessThan(radius), () => {
        chartsHere.addAssign(1);
        If(float(i).notEqual(uActiveChartIdx), () => {
          overlapTint.assign(cColor);
        });
      });

      const edgeDist = abs(cDist.sub(radius));
      const fw = fwidth(cDist);
      const ring = float(1.0).sub(
        smoothstep(fw.mul(3.0), fw.mul(4.5), edgeDist),
      );
      const opacity = select(float(i).equal(uActiveChartIdx), 0.6, 0.25);
      col.assign(mix(col, cColor, ring.mul(opacity)));
    });

    If(chartsHere.greaterThan(1), () => {
      col.assign(mix(col, overlapTint, 0.08));
    });

    // Distance fog
    const dist = length(positionWorld.xz.sub(cameraPosition.xz));
    const fogFactor = smoothstep(uFogRadius.sub(uFogFalloff), uFogRadius, dist);
    col.assign(mix(col, uFogColor, fogFactor));

    return col;
  })();

  /* ================ opacity node ================ */
  material.opacityNode = Fn(() => {
    const dist = length(positionWorld.xz.sub(cameraPosition.xz));
    return float(0.55).mul(
      float(1.0).sub(smoothstep(uFogRadius.sub(5.0), uFogRadius, dist)),
    );
  })();

  return {
    material,
    uniforms: {
      showScalar: uShowScalar,
      showContours: uShowContours,
      scalarMin: uScalarMin,
      scalarMax: uScalarMax,
      showWireframe: uShowWireframe,
      activeChartIdx: uActiveChartIdx,
      chartGridColor: uChartGridColor,
    },
  };
}
