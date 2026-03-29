import * as THREE from "three";
import { terrainSampler } from "./noise";

export function generateTerrainGeometry(
  centerX: number,
  centerZ: number,
  size: number,
  resolution: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const vertexCount = (resolution + 1) * (resolution + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const worldPositions = new Float32Array(vertexCount * 2);

  const halfSize = size / 2;
  const step = size / resolution;

  // Generate vertices
  for (let iz = 0; iz <= resolution; iz++) {
    for (let ix = 0; ix <= resolution; ix++) {
      const idx = iz * (resolution + 1) + ix;

      const worldX = centerX - halfSize + ix * step;
      const worldZ = centerZ - halfSize + iz * step;
      const worldY = terrainSampler.height(worldX, worldZ);

      positions[idx * 3] = worldX;
      positions[idx * 3 + 1] = worldY;
      positions[idx * 3 + 2] = worldZ;

      uvs[idx * 2] = ix / resolution;
      uvs[idx * 2 + 1] = iz / resolution;

      worldPositions[idx * 2] = worldX;
      worldPositions[idx * 2 + 1] = worldZ;
    }
  }

  // Generate indices
  const indexCount = resolution * resolution * 6;
  const indices = new Uint32Array(indexCount);
  let triIdx = 0;

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const a = iz * (resolution + 1) + ix;
      const b = a + 1;
      const c = a + (resolution + 1);
      const d = c + 1;

      indices[triIdx++] = a;
      indices[triIdx++] = c;
      indices[triIdx++] = b;

      indices[triIdx++] = b;
      indices[triIdx++] = c;
      indices[triIdx++] = d;
    }
  }

  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aWorldPos", new THREE.BufferAttribute(worldPositions, 2));
  geometry.computeVertexNormals();

  return geometry;
}
