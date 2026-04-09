import { useMemo } from "react";
import * as THREE from "three";

const HEAD_LENGTH_RATIO = 0.28;
const HEAD_WIDTH_RATIO = 0.12;
const SHAFT_WIDTH_RATIO = 0.04;
const OCCLUDED_OPACITY = 0.15;

export function Arrow({
  origin,
  direction,
  color,
  length = 1.0,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  color: string;
  length?: number;
}) {
  const shaftGeo = useMemo(() => {
    const headLen = length * HEAD_LENGTH_RATIO;
    const shaftRadius = length * SHAFT_WIDTH_RATIO;
    const shaftLen = length - headLen;
    const geo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 8);
    geo.translate(0, shaftLen / 2, 0);
    return geo;
  }, [length]);

  const headGeo = useMemo(() => {
    const headLen = length * HEAD_LENGTH_RATIO;
    const headRadius = length * HEAD_WIDTH_RATIO;
    const geo = new THREE.ConeGeometry(headRadius, headLen, 8);
    geo.translate(0, length - headLen / 2, 0);
    return geo;
  }, [length]);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    return q;
  }, [direction]);

  return (
    <group position={origin} quaternion={quaternion}>
      {/* Occluded pass: behind surface, faded */}
      <mesh geometry={shaftGeo} renderOrder={1}>
        <meshBasicMaterial color={color} depthTest depthWrite={false} depthFunc={THREE.GreaterDepth} transparent opacity={OCCLUDED_OPACITY} />
      </mesh>
      <mesh geometry={headGeo} renderOrder={1}>
        <meshBasicMaterial color={color} depthTest depthWrite={false} depthFunc={THREE.GreaterDepth} transparent opacity={OCCLUDED_OPACITY} />
      </mesh>
      {/* Visible pass: in front of surface, full opacity */}
      <mesh geometry={shaftGeo} renderOrder={10}>
        <meshBasicMaterial color={color} depthTest depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh geometry={headGeo} renderOrder={10}>
        <meshBasicMaterial color={color} depthTest depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
    </group>
  );
}

/** Tube-based curve with vertex colors (thick line that works on all renderers) */
export function CurveLine({
  points,
  colors,
  renderOrder,
  radius = 0.04,
}: {
  points: [number, number, number][];
  colors: THREE.Color[];
  renderOrder: number;
  radius?: number;
}) {
  const meshes = useMemo(() => {
    if (points.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
    );
    const tubularSegments = Math.max(points.length - 1, 1);
    const geo = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      6,
      false,
    );

    // Apply vertex colors
    const posAttr = geo.getAttribute("position");
    const colorArr = new Float32Array(posAttr.count * 3);
    const radialSegments = 6;
    const rings = tubularSegments + 1;

    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const ci = Math.min(
        Math.round(t * (points.length - 1)),
        points.length - 1,
      );
      const c = colors[ci];
      for (let j = 0; j <= radialSegments; j++) {
        const vi = i * (radialSegments + 1) + j;
        colorArr[vi * 3] = c.r;
        colorArr[vi * 3 + 1] = c.g;
        colorArr[vi * 3 + 2] = c.b;
      }
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));

    // Visible pass
    const visibleMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const visibleMesh = new THREE.Mesh(geo, visibleMat);
    visibleMesh.renderOrder = renderOrder;

    // Occluded pass
    const occludedMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      transparent: true,
      opacity: OCCLUDED_OPACITY,
    });
    const occludedMesh = new THREE.Mesh(geo, occludedMat);
    occludedMesh.renderOrder = 1;

    return { visibleMesh, occludedMesh };
  }, [points, colors, renderOrder, radius]);

  if (!meshes) return null;
  return (
    <>
      <primitive object={meshes.occludedMesh} />
      <primitive object={meshes.visibleMesh} />
    </>
  );
}
