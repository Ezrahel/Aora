// Shared, non-React state for the WebGL scene. The render loop reads this every
// frame, so writes must not go through React state.
import { PRESETS, type PriceConfig } from "../pricing-model";

export interface Pose {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotZ: number;
  scale: number;
  opacity: number;
}

const pose = (x: number, y: number, z: number, rotX: number, rotZ: number, scale: number, opacity: number): Pose => ({
  x, y, z, rotX, rotZ, scale, opacity,
});

/** Each page section names one of these with data-scene (and optionally data-scene-end). */
export const POSES: Record<string, Pose> = {
  hero: pose(4.1, 0.2, 0, 0.16, -0.28, 0.92, 1),
  problem: pose(6.2, 1.5, -2, 0.34, -0.5, 1.05, 0.5),
  pipelineStart: pose(-5.4, 3.4, 0, 0.1, 0.2, 0.95, 0.9),
  pipelineEnd: pose(-5.4, -3.6, 0, 0.1, 0.2, 0.95, 0.9),
  editor: pose(4.4, 0, 0, 0.14, -0.14, 0.82, 1),
  vault: pose(-5.8, 0, -1, 0.42, 0.42, 0.95, 0.5),
  bento: pose(0, -3, -6, 0.5, -0.2, 1.2, 0.2),
  assistant: pose(0, 0, -5, 1.05, 0.2, 1.15, 0.28),
  developers: pose(6.4, -1, -3, 0.3, -0.6, 1, 0.34),
  compare: pose(-6.4, 1, -3, 0.3, 0.6, 1, 0.3),
  vortex: pose(0, 0, 3, 1.5708, 0, 1.45, 1),
  footer: pose(0, 0, 5, 1.5708, 0, 1.7, 0.55),
  auth: pose(0.1, 0, 0, 0.16, -0.24, 0.9, 1),
};

export const sceneStore = {
  plan: PRESETS.hybrid as PriceConfig,
  planVersion: 0,
  pointerX: 0,
  pointerY: 0,
  /** When set, ignores scroll and holds this pose (used by the auth page). */
  heldPose: null as Pose | null,
};

export function setScenePlan(plan: PriceConfig) {
  sceneStore.plan = plan;
  sceneStore.planVersion += 1;
}
