import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useTeleport } from "@/hooks/useTeleport";
import { terrainSampler } from "@/lib/noise";
import { useAppDispatch } from "@/stores/app-store";

const MOVE_SPEED = 20;
const ROTATE_SPEED = 1.8;
const HEIGHT_OFFSET = 12;
const LERP_FACTOR = 0.08;
const LERP_FACTOR_Y = 0.04;
const LOOK_AHEAD = 5;

export function CameraRig() {
  const keys = useKeyboard();
  const teleportRef = useTeleport();
  const { camera } = useThree();
  const dispatch = useAppDispatch();

  const yaw = useRef(0);
  const posX = useRef(0);
  const posZ = useRef(0);
  const smoothLookY = useRef(0);
  const frameCount = useRef(0);

  useFrame((_, delta) => {
    // Check for teleport request
    if (teleportRef.current) {
      const t = teleportRef.current;
      posX.current = t.x;
      posZ.current = t.z;
      yaw.current = t.yaw;
      const y = terrainSampler.height(t.x, t.z) + HEIGHT_OFFSET;
      camera.position.set(t.x, y, t.z);
      teleportRef.current = null;
    }

    const dt = Math.min(delta, 0.05);
    const pressed = keys.current;

    // Rotation
    if (pressed.has("ArrowLeft") || pressed.has("KeyA")) {
      yaw.current += ROTATE_SPEED * dt;
    }
    if (pressed.has("ArrowRight") || pressed.has("KeyD")) {
      yaw.current -= ROTATE_SPEED * dt;
    }

    // Direction vector in XZ plane
    const dirX = -Math.sin(yaw.current);
    const dirZ = -Math.cos(yaw.current);

    // Movement
    if (pressed.has("ArrowUp") || pressed.has("KeyW")) {
      posX.current += dirX * MOVE_SPEED * dt;
      posZ.current += dirZ * MOVE_SPEED * dt;
    }
    if (pressed.has("ArrowDown") || pressed.has("KeyS")) {
      posX.current -= dirX * MOVE_SPEED * dt;
      posZ.current -= dirZ * MOVE_SPEED * dt;
    }

    // Target height: terrain + offset
    const targetY =
      terrainSampler.height(posX.current, posZ.current) + HEIGHT_OFFSET;

    // Smooth camera position
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      posX.current,
      LERP_FACTOR,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetY,
      LERP_FACTOR_Y,
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      posZ.current,
      LERP_FACTOR,
    );

    // Look ahead (smooth the target height to reduce bobbing)
    const lookX = posX.current + dirX * LOOK_AHEAD;
    const lookZ = posZ.current + dirZ * LOOK_AHEAD;
    const rawLookY = terrainSampler.height(lookX, lookZ) + HEIGHT_OFFSET * 0.5;
    smoothLookY.current = THREE.MathUtils.lerp(
      smoothLookY.current,
      rawLookY,
      LERP_FACTOR_Y,
    );

    camera.lookAt(lookX, smoothLookY.current, lookZ);

    // Update app state at reduced frequency (every 6 frames ~10fps at 60fps)
    frameCount.current++;
    if (frameCount.current % 6 === 0) {
      dispatch({
        type: "SET_CAMERA",
        position: [camera.position.x, camera.position.y, camera.position.z],
        direction: [dirX, 0, dirZ],
      });
    }
  });

  return null;
}
