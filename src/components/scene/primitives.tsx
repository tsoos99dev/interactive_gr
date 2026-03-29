import { useMemo } from "react";
import * as THREE from "three";

const ARROW_HEAD_LENGTH = 0.2;
const ARROW_HEAD_WIDTH = 0.08;

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
    const geo = new THREE.CylinderGeometry(
      ARROW_HEAD_WIDTH * 0.4,
      ARROW_HEAD_WIDTH * 0.4,
      length - ARROW_HEAD_LENGTH,
      8,
    );
    geo.translate(0, (length - ARROW_HEAD_LENGTH) / 2, 0);
    return geo;
  }, [length]);

  const headGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(ARROW_HEAD_WIDTH, ARROW_HEAD_LENGTH, 8);
    geo.translate(0, length - ARROW_HEAD_LENGTH / 2, 0);
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
      <mesh geometry={shaftGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh geometry={headGeo}>
        <meshBasicMaterial color={color} />
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
  const meshObj = useMemo(() => {
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

    // Apply vertex colors: map each vertex to the nearest input point
    const posAttr = geo.getAttribute("position");
    const colorArr = new Float32Array(posAttr.count * 3);
    const radialSegments = 6;
    const rings = tubularSegments + 1;

    for (let i = 0; i < rings; i++) {
      // Map ring index to input point index
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

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = renderOrder;
    return mesh;
  }, [points, colors, renderOrder, radius]);

  if (!meshObj) return null;
  return <primitive object={meshObj} />;
}
