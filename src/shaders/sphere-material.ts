import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  uniform,
  attribute,
  varying,
  vec3,
  float,
  normalView,
  normalize,
  dot,
  max,
  abs,
  clamp,
  smoothstep,
  fract,
  fwidth,
  min,
  mix,
  select,
  pow,
  cameraPosition,
  positionWorld,
} from "three/tsl";

export function createSphereMaterial() {
  const material = new MeshBasicNodeMaterial();
  material.side = THREE.FrontSide;
  material.toneMapped = false;

  const uBaseColor = uniform(new THREE.Color(0.95, 0.94, 0.92));
  const uShowCurvature = uniform(0.0);
  const uShowGrid = uniform(1.0);

  // Per-vertex custom attributes
  const vCurvature = float(varying(attribute("aCurvature", "float"), "v_curvature"));
  const vTheta = float(varying(attribute("aTheta", "float"), "v_theta"));
  const vPhi = float(varying(attribute("aPhi", "float"), "v_phi"));

  material.colorNode = Fn(() => {
    // World-space normal from position (sphere at origin)
    const worldNormal = normalize(positionWorld);
    // Light from camera-ish direction in world space
    const lightDir = normalize(cameraPosition.add(vec3(1.0, 2.0, 0.5)));
    const ndotl = max(dot(worldNormal, lightDir), 0.0);
    // Ambient + diffuse: range [0.2, 1.0] for strong contrast
    const diff = ndotl.mul(0.8).add(0.2);
    const col = uBaseColor.mul(diff).toVar("col");

    // Curvature coloring: diverging red-white-blue
    const showK = uShowCurvature.greaterThan(0.5);
    const curvSign = select(showK, vCurvature, float(0.0));
    // Map curvature to [-1, 1] range (K for unit sphere = 1, so center around that)
    // For smooth sphere K=1, for bumpy it varies. Use a symmetric scale.
    const kNorm = clamp(curvSign.mul(0.5), -1.0, 1.0);
    // Positive K → red, negative K → blue, zero → white
    const posColor = vec3(0.9, 0.3, 0.2); // red
    const negColor = vec3(0.2, 0.4, 0.9); // blue
    const zeroColor = vec3(0.95, 0.95, 0.95); // white
    const kColor = select(
      kNorm.greaterThan(0.0),
      mix(zeroColor, posColor, kNorm),
      mix(zeroColor, negColor, abs(kNorm)),
    );
    const curvCol = select(showK, kColor.mul(diff), col);
    col.assign(curvCol);

    // Coordinate grid lines (θ and φ)
    const gridSpacing = float(Math.PI / 24); // 7.5° intervals
    const thetaScaled = vTheta.div(gridSpacing);
    const phiScaled = vPhi.div(gridSpacing);
    const fwT = fwidth(thetaScaled);
    const fwP = fwidth(phiScaled);
    const lineWidth = float(1.2);
    const gridT = smoothstep(float(0.0), fwT.mul(lineWidth), abs(fract(thetaScaled.sub(0.5)).sub(0.5)));
    const gridP = smoothstep(float(0.0), fwP.mul(lineWidth), abs(fract(phiScaled.sub(0.5)).sub(0.5)));
    const gridMask = float(1.0).sub(min(gridT, gridP));
    const gridColor = vec3(0.35, 0.4, 0.5);
    col.assign(mix(col, gridColor, gridMask.mul(uShowGrid).mul(0.55)));

    return col;
  })();

  return {
    material,
    uniforms: {
      showCurvature: uShowCurvature,
      showGrid: uShowGrid,
      baseColor: uBaseColor,
    },
  };
}
