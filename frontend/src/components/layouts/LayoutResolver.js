/**
 * LayoutResolver.js
 * 
 * Maps rooms (primarily OPEN_WORKSPACE rooms) to their layout configurations.
 * Supports explicit room ID overrides, workspace name mappings, and future custom transforms.
 * Falls back to legacy rendering if no layout matches.
 */

// Define mappings for workspaces (maps floor ID -> room ID/name -> layout configuration)
const WORKSPACE_LAYOUT_MAPPINGS = {
  "floor-hudson-f6": {
    "Workspace 1": {
      type: "CUSTOM",
      customItems: [
        { type: "DeskBench", x: 0.5, z: 0.0, rotation: 0, desksAcross: 3, deskSides: 2, dividerType: "glass" },
        { type: "Lockers", x: -3.0, z: 0.5, rotation: Math.PI / 2, width: 1.5, height: 1.6, depth: 0.5 },
        { type: "Plant", x: -3.0, z: -1.5 },
        { type: "Plant", x: 3.0, z: 1.5 }
      ]
    }
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
  const floorId = floorMap?.id;
  const floorMappings = floorId ? WORKSPACE_LAYOUT_MAPPINGS[floorId] : null;

  if (floorMappings) {
    // 1. Explicit room override (by Room ID)
    if (room.id && floorMappings[room.id]) {
      return floorMappings[room.id];
    }

    // 2. Workspace name mapping (by Room Name)
    if (room.name && floorMappings[room.name]) {
      return floorMappings[room.name];
    }
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

