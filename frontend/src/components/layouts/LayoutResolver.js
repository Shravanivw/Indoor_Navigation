/**
 * LayoutResolver.js
 * 
 * Maps rooms (primarily OPEN_WORKSPACE rooms) to their layout configurations.
 * Supports explicit room ID overrides, workspace name mappings, and future custom transforms.
 * Falls back to legacy rendering if no layout matches.
 */

// Define mappings for workspaces (maps room ID or room name to layout configuration)
const WORKSPACE_LAYOUT_MAPPINGS = {
  "Workspace 8": {
    type: "CUSTOM",
    customItems: [
      { type: "Pod6", x: -8.0, z: -0.2, rotation: 0 },
      { type: "CollabIsland", x: -2.0, z: 0.2, rotation: 0 },
      { type: "HighTable", x: 3.5, z: -0.2, rotation: 0 },
      { type: "Pod8", x: 9.0, z: -0.2, rotation: 0 }
    ]
  }
};

/**
 * Resolves the layout configuration for a given room.
 * 
 * @param {Object} room - The room data object (from floorMap.rooms)
 * @param {Object} floorMap - The parent floorMap data object
 * @returns {Object|null} Layout Configuration or null if it should fall back to legacy system
 */
export function resolveRoomLayout(room, floorMap) {
  const nameLower = (room.name ?? "").toLowerCase();

  // 1. Explicit room override (by Room ID)
  if (room.id && WORKSPACE_LAYOUT_MAPPINGS[room.id]) {
    return WORKSPACE_LAYOUT_MAPPINGS[room.id];
  }

  // 2. Workspace name mapping (by Room Name)
  if (room.name && WORKSPACE_LAYOUT_MAPPINGS[room.name]) {
    return WORKSPACE_LAYOUT_MAPPINGS[room.name];
  }

  // 3. Support future-proofing: custom per-workspace layout defined directly on the room object
  if (room.customLayout && Array.isArray(room.customLayout)) {
    return {
      type: "CUSTOM",
      customItems: room.customLayout
    };
  }

  // 4. Existing special cases (Innovation Area, IT Bar, etc.)
  if (nameLower.includes("it bar")) {
    return { type: "IT_BAR", customItems: null };
  }
  if (nameLower.includes("innovation")) {
    return { type: "COLLAB_ISLAND", customItems: null };
  }

  // 5. Legacy OfficeDeskCluster fallback (signified by returning null)
  return null;
}

