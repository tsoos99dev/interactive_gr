import { createNoise2D } from "simplex-noise";

const noise2D = createNoise2D();

const OCTAVES = 4;
const PERSISTENCE = 0.5;
const LACUNARITY = 2.0;
const BASE_SCALE = 0.02;
const AMPLITUDE = 8;

function fractalNoise(x: number, z: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = BASE_SCALE;
  let maxAmplitude = 0;

  for (let i = 0; i < OCTAVES; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= PERSISTENCE;
    frequency *= LACUNARITY;
  }

  return (value / maxAmplitude) * AMPLITUDE;
}

const EPS = 0.05;

export const terrainSampler = {
  height(x: number, z: number): number {
    return fractalNoise(x, z);
  },

  dhdx(x: number, z: number): number {
    return (fractalNoise(x + EPS, z) - fractalNoise(x - EPS, z)) / (2 * EPS);
  },

  dhdz(x: number, z: number): number {
    return (fractalNoise(x, z + EPS) - fractalNoise(x, z - EPS)) / (2 * EPS);
  },

  // Second derivatives for Gaussian curvature
  d2hdx2(x: number, z: number): number {
    return (fractalNoise(x + EPS, z) - 2 * fractalNoise(x, z) + fractalNoise(x - EPS, z)) / (EPS * EPS);
  },

  d2hdz2(x: number, z: number): number {
    return (fractalNoise(x, z + EPS) - 2 * fractalNoise(x, z) + fractalNoise(x, z - EPS)) / (EPS * EPS);
  },

  d2hdxdz(x: number, z: number): number {
    return (
      fractalNoise(x + EPS, z + EPS) -
      fractalNoise(x + EPS, z - EPS) -
      fractalNoise(x - EPS, z + EPS) +
      fractalNoise(x - EPS, z - EPS)
    ) / (4 * EPS * EPS);
  },
};
