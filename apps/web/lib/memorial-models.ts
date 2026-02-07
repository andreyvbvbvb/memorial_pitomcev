import {
  bowlFoodOptions,
  bowlWaterOptions,
  environmentOptions,
  frameLeftOptions,
  frameRightOptions,
  houseOptions,
  matOptions,
  roofOptions,
  signOptions,
  wallOptions
} from "./memorial-options";

const environmentModelById: Record<string, string> = {
  summer: "/models/terrains/TERRAIN_summer.glb",
  summer_1: "/models/terrains/TERRAIN_summer_1.glb",
  spring: "/models/terrains/TERRAIN_spring.glb",
  autumn: "/models/terrains/TERRAIN_autumn.glb",
  winter: "/models/terrains/TERRAIN_winter.glb",
  winter_1: "/models/terrains/TERRAIN_winter_1.glb"
};

const houseModelById: Record<string, string> = {
  budka_1: "/models/houses/DOM_budka_1.glb",
  budka_2: "/models/houses/DOM_budka_2.glb"
};

const roofModelById: Record<string, string> = {
  roof_1: "/models/parts/roof/roof_1.glb",
  roof_2: "/models/parts/roof/roof_2.glb"
};

const wallModelById: Record<string, string> = {
  wall_1: "/models/parts/wall/wall_1.glb",
  wall_2: "/models/parts/wall/wall_2.glb"
};

const signModelById: Record<string, string> = {
  sign_1: "/models/parts/sign/sign_1.glb",
  sign_2: "/models/parts/sign/sign_2.glb"
};

const frameLeftModelById: Record<string, string> = {
  frame_left_1: "/models/parts/frame_left/frame_left_1.glb",
  frame_left_2: "/models/parts/frame_left/frame_left_2.glb"
};

const frameRightModelById: Record<string, string> = {
  frame_right_1: "/models/parts/frame_right/frame_right_1.glb",
  frame_right_2: "/models/parts/frame_right/frame_right_2.glb"
};

const matModelById: Record<string, string> = {
  mat_1: "/models/parts/mat/mat_1.glb",
  mat_2: "/models/parts/mat/mat_2.glb"
};

const bowlFoodModelById: Record<string, string> = {
  bowl_food_1: "/models/parts/bowl_food/bowl_food_1.glb",
  bowl_food_2: "/models/parts/bowl_food/bowl_food_2.glb",
  bowl_food_3: "/models/parts/bowl_food/bowl_food_3.glb"
};

const bowlWaterModelById: Record<string, string> = {
  bowl_water_1: "/models/parts/bowl_water/bowl_water_1.glb",
  bowl_water_2: "/models/parts/bowl_water/bowl_water_2.glb"
};

const resolveOptionalModel = (
  map: Record<string, string>,
  id?: string | null
) => {
  if (!id || id === "none") {
    return null;
  }
  return map[id] ?? null;
};

export const resolveEnvironmentModel = (id?: string | null) =>
  environmentModelById[id ?? ""] ?? environmentModelById[environmentOptions[0]?.id ?? ""];

export const resolveHouseModel = (id?: string | null) =>
  houseModelById[id ?? ""] ?? houseModelById[houseOptions[0]?.id ?? ""];

export const resolveRoofModel = (id?: string | null) =>
  roofModelById[id ?? ""] ?? roofModelById[roofOptions[0]?.id ?? ""];

export const resolveWallModel = (id?: string | null) =>
  wallModelById[id ?? ""] ?? wallModelById[wallOptions[0]?.id ?? ""];

export const resolveSignModel = (id?: string | null) =>
  resolveOptionalModel(signModelById, id) ?? null;

export const resolveFrameLeftModel = (id?: string | null) =>
  resolveOptionalModel(frameLeftModelById, id) ?? null;

export const resolveFrameRightModel = (id?: string | null) =>
  resolveOptionalModel(frameRightModelById, id) ?? null;

export const resolveMatModel = (id?: string | null) =>
  resolveOptionalModel(matModelById, id) ?? null;

export const resolveBowlFoodModel = (id?: string | null) =>
  resolveOptionalModel(bowlFoodModelById, id) ?? null;

export const resolveBowlWaterModel = (id?: string | null) =>
  resolveOptionalModel(bowlWaterModelById, id) ?? null;
