import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { Arrow } from "../primitives";
import { spherePosition, sphereBasis, sphereChristoffel } from "@/lib/sphere";
import { useAppState } from "@/stores/app-store";

/**
 * Demo vector field: curls away from equator, fades at poles.
 * Returns coordinate components [V^θ, V^φ].
 */
function V(theta: number): [number, number] {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  return [-ct * st, st];
}

/** Exact ∂V/∂θ */
function dV_dtheta(theta: number): [number, number] {
  return [-Math.cos(2 * theta), Math.cos(theta)];
}

/** Exact ∂V/∂φ (field is φ-independent) */
function dV_dphi(): [number, number] {
  return [0, 0];
}

const THETA_COUNT = 16;
const PHI_COUNT = 18;

export function CovariantDerivOverlay() {
  const state = useAppState();
  const point = state.ch3SelectedPoint;
  const epsilon = state.ch3Bumpiness;
  const dir = state.ch3CovariantDir;

  // Vector field arrows across the sphere
  const fieldArrows = useMemo(() => {
    const out: {
      pos: [number, number, number];
      d: THREE.Vector3;
      mag: number;
    }[] = [];

    for (let i = 1; i <= THETA_COUNT; i++) {
      const theta = (i / (THETA_COUNT + 1)) * Math.PI;
      const nPhi = Math.max(4, Math.round(PHI_COUNT * Math.sin(theta)));
      for (let j = 0; j < nPhi; j++) {
        const phi = (j / nPhi) * 2 * Math.PI;
        const [vT, vP] = V(theta);
        const pos = spherePosition(theta, phi, epsilon);
        const { eTheta, ePhi } = sphereBasis(theta, phi, epsilon);

        const d = new THREE.Vector3(
          vT * eTheta[0] + vP * ePhi[0],
          vT * eTheta[1] + vP * ePhi[1],
          vT * eTheta[2] + vP * ePhi[2],
        );
        const mag = d.length();
        if (mag > 0.05) out.push({ pos, d: d.normalize(), mag });
      }
    }
    return out;
  }, [epsilon]);

  // Derivative data at the selected point
  const derivData = useMemo(() => {
    if (!point) return null;

    const tc = Math.max(0.05, Math.min(Math.PI - 0.05, point.theta));
    const phi = point.phi;
    const pos = spherePosition(tc, phi, epsilon);
    const { eTheta, ePhi } = sphereBasis(tc, phi, epsilon);
    const [G0_00, G0_01, G0_11, G1_00, G1_01, G1_11] = sphereChristoffel(
      tc,
      phi,
      epsilon,
    );

    const [vT, vP] = V(tc);
    const along = dir === "dtheta";
    const [dvT, dvP] = along ? dV_dtheta(tc) : dV_dphi();

    const toVec = (a: number, b: number) =>
      new THREE.Vector3(
        a * eTheta[0] + b * ePhi[0],
        a * eTheta[1] + b * ePhi[1],
        a * eTheta[2] + b * ePhi[2],
      );

    // Covariant derivative components: ∇_X V^k = ∂_X V^k + Γ^k_{Xm} V^m
    let covT: number, covP: number;
    if (along) {
      covT = dvT + G0_00 * vT + G0_01 * vP;
      covP = dvP + G1_00 * vT + G1_01 * vP;
    } else {
      covT = dvT + G0_01 * vT + G0_11 * vP;
      covP = dvP + G1_01 * vT + G1_11 * vP;
    }

    return {
      pos,
      v: toVec(vT, vP),
      partial: toVec(dvT, dvP),
      covariant: toVec(covT, covP),
    };
  }, [point, epsilon, dir]);

  const CELL = Math.PI / 24;
  const FIELD_LEN = CELL * 0.85;
  const DERIV_SCALE = CELL * 1.4;
  const DERIV_MAX = CELL * 2.5;

  const labelStyle = {
    pointerEvents: "none" as const,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "monospace",
    whiteSpace: "nowrap" as const,
    textShadow: "0 0 4px rgba(255,255,255,0.9)",
  };

  return (
    <group>
      {/* Field arrows on the sphere */}
      {fieldArrows.map((a, i) => (
        <Arrow
          key={i}
          origin={new THREE.Vector3(...a.pos)}
          direction={a.d}
          color="#44aa44"
          length={Math.min(a.mag * FIELD_LEN, FIELD_LEN)}
        />
      ))}

      {/* V, ∂_X V, ∇_X V at selected point */}
      {derivData &&
        (() => {
          const o = new THREE.Vector3(...derivData.pos);

          const items: {
            vec: THREE.Vector3;
            color: string;
            label: string;
            labelJsx?: JSX.Element;
          }[] = [
            { vec: derivData.v, color: "#44aa44", label: "V" },
            {
              vec: derivData.partial,
              color: "#ff8800",
              label: "∂V",
              labelJsx: (
                <span style={{ ...labelStyle, color: "#ff8800" }}>
                  ∂<sub>X</sub>V
                </span>
              ),
            },
            {
              vec: derivData.covariant,
              color: "#8844cc",
              label: "∇V",
              labelJsx: (
                <span style={{ ...labelStyle, color: "#8844cc" }}>
                  ∇<sub>X</sub>V
                </span>
              ),
            },
          ];

          return (
            <group>
              {items.map(({ vec, color, label, labelJsx }) => {
                const len = vec.length();
                if (len < 1e-6) return null;
                const d = vec.clone().normalize();
                const arrowLen = Math.min(len * DERIV_SCALE, DERIV_MAX);
                return (
                  <group key={label}>
                    <Arrow
                      origin={o}
                      direction={d}
                      color={color}
                      length={arrowLen}
                    />
                    <Html
                      position={o.clone().addScaledVector(d, arrowLen + 0.03)}
                      style={{ pointerEvents: "none" }}
                    >
                      {labelJsx ?? (
                        <span style={{ ...labelStyle, color }}>{label}</span>
                      )}
                    </Html>
                  </group>
                );
              })}
            </group>
          );
        })()}
    </group>
  );
}
