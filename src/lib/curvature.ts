import { spherePosition, sphereNormal, sphereMetric, sphereChristoffel } from "./sphere";

/**
 * Gaussian curvature via the second fundamental form.
 * K = (e*g - f^2) / (E*G - F^2)
 * where E,F,G = first fundamental form (metric) and e,f,g = second fundamental form.
 */
let curvatureCallCount = 0;
export function gaussianCurvature(
  theta: number,
  phi: number,
  epsilon: number,
): number {
  const EPS = 0.002;
  const n = sphereNormal(theta, phi, epsilon);
  const p = spherePosition(theta, phi, epsilon);

  // Second derivatives of position vector
  const ptt_plus = spherePosition(theta + EPS, phi, epsilon);
  const ptt_minus = spherePosition(theta - EPS, phi, epsilon);
  const rTheTh: [number, number, number] = [
    (ptt_plus[0] - 2 * p[0] + ptt_minus[0]) / (EPS * EPS),
    (ptt_plus[1] - 2 * p[1] + ptt_minus[1]) / (EPS * EPS),
    (ptt_plus[2] - 2 * p[2] + ptt_minus[2]) / (EPS * EPS),
  ];

  const ppp_plus = spherePosition(theta, phi + EPS, epsilon);
  const ppp_minus = spherePosition(theta, phi - EPS, epsilon);
  const rPhiPh: [number, number, number] = [
    (ppp_plus[0] - 2 * p[0] + ppp_minus[0]) / (EPS * EPS),
    (ppp_plus[1] - 2 * p[1] + ppp_minus[1]) / (EPS * EPS),
    (ppp_plus[2] - 2 * p[2] + ppp_minus[2]) / (EPS * EPS),
  ];

  const ptp1 = spherePosition(theta + EPS, phi + EPS, epsilon);
  const ptp2 = spherePosition(theta + EPS, phi - EPS, epsilon);
  const ptp3 = spherePosition(theta - EPS, phi + EPS, epsilon);
  const ptp4 = spherePosition(theta - EPS, phi - EPS, epsilon);
  const rThePh: [number, number, number] = [
    (ptp1[0] - ptp2[0] - ptp3[0] + ptp4[0]) / (4 * EPS * EPS),
    (ptp1[1] - ptp2[1] - ptp3[1] + ptp4[1]) / (4 * EPS * EPS),
    (ptp1[2] - ptp2[2] - ptp3[2] + ptp4[2]) / (4 * EPS * EPS),
  ];

  // Second fundamental form: e = n·r_θθ, f = n·r_θφ, g = n·r_φφ
  const e = n[0] * rTheTh[0] + n[1] * rTheTh[1] + n[2] * rTheTh[2];
  const f = n[0] * rThePh[0] + n[1] * rThePh[1] + n[2] * rThePh[2];
  const g = n[0] * rPhiPh[0] + n[1] * rPhiPh[1] + n[2] * rPhiPh[2];

  // First fundamental form
  const [E, F, G] = sphereMetric(theta, phi, epsilon);
  const denom = E * G - F * F;

  if (Math.abs(denom) < 1e-20) return 0;
  return (e * g - f * f) / denom;
}

/**
 * Riemann curvature tensor R^ρ_σθφ via finite differences on Christoffel symbols.
 * Returns [R^θ_θθφ, R^θ_φθφ, R^φ_θθφ, R^φ_φθφ].
 *
 * Formula: R^ρ_σμν = ∂_μ Γ^ρ_νσ − ∂_ν Γ^ρ_μσ + Γ^ρ_μλ Γ^λ_νσ − Γ^ρ_νλ Γ^λ_μσ
 * with μ=θ, ν=φ.
 */
export function riemannTensor(
  theta: number,
  phi: number,
  epsilon: number,
): [number, number, number, number] {
  const h = 0.002;
  const gc = sphereChristoffel(theta, phi, epsilon);
  const gTp = sphereChristoffel(theta + h, phi, epsilon);
  const gTm = sphereChristoffel(theta - h, phi, epsilon);
  const gPp = sphereChristoffel(theta, phi + h, epsilon);
  const gPm = sphereChristoffel(theta, phi - h, epsilon);

  // Γ^ρ_{ij} from flat array: [Γ^θ_θθ, Γ^θ_θφ, Γ^θ_φφ, Γ^φ_θθ, Γ^φ_θφ, Γ^φ_φφ]
  // Index: rho*3 + sym_index(i,j) where sym_index(0,0)=0, (0,1)=(1,0)=1, (1,1)=2
  function G(arr: number[], rho: number, i: number, j: number): number {
    const lo = i <= j ? i * (3 - i) / 2 + j - i : j * (3 - j) / 2 + i - j;
    // i=0,j=0→0  i=0,j=1→1  i=1,j=0→1  i=1,j=1→2
    return arr[rho * 3 + lo];
  }

  // R^ρ_σ_θφ = ∂_θ Γ^ρ_φσ − ∂_φ Γ^ρ_θσ + Σ_λ(Γ^ρ_θλ Γ^λ_φσ − Γ^ρ_φλ Γ^λ_θσ)
  function R(rho: number, sigma: number): number {
    const dTheta = (G(gTp, rho, 1, sigma) - G(gTm, rho, 1, sigma)) / (2 * h);
    const dPhi = (G(gPp, rho, 0, sigma) - G(gPm, rho, 0, sigma)) / (2 * h);
    let val = dTheta - dPhi;
    for (let lam = 0; lam < 2; lam++) {
      val += G(gc, rho, 0, lam) * G(gc, lam, 1, sigma);
      val -= G(gc, rho, 1, lam) * G(gc, lam, 0, sigma);
    }
    return val;
  }

  return [R(0, 0), R(0, 1), R(1, 0), R(1, 1)];
}
