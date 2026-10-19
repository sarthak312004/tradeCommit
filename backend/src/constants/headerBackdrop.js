// Keep in sync with the scene ids in frontend/src/components/rightContainer/header/headerSceneData.jsx
export const HEADER_SCENE_IDS = ["dunes", "mist", "tide", "moon", "pines", "dawn"];

export const DEFAULT_HEADER_SCENE = "mist";

export const HEADER_BACKDROP_MODES = ["none", "scene", "image"];

// Cloudinary folder for one user's header picture (deleteImagesFromCloudinary only touches URLs inside it)
export const headerBackdropFolder = (userId) => `trading-journal/header-backdrops/${userId}`;
