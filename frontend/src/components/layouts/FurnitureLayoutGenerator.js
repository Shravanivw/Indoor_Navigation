import * as THREE from "three";
import {
  layoutBenchHorizontal,
  layoutBenchVertical,
  layoutPod4,
  layoutPod6,
  layoutPod8,
  layoutCollabIsland,
  layoutLoungeSeating,
  layoutPantrySeating,
  layoutHighTables,
  layoutExecutiveDesk,
  layoutReceptionDesk
} from "./LayoutModules";
import {
  createChair,
  createDeskBench,
  createTable,
  createSofa,
  createCabinet,
  createPrinter,
  createLockers,
  createCoffeeMachine,
  createTVDisplay,
  createWhiteboard,
  createPottedPlant,
  createDeskUnit,
  createSofaUnit,
  createWhiteboardUnit,
  createPlantUnit
} from "./FurnitureModels";

// Procedural IT Bar special layout for backwards compatibility
function layoutITBar(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const deskGroup = new THREE.Group();
  deskGroup.position.set(cx, 0, cz - 0.8);

  // Big desk top (maple wood)
  const top = new THREE.Mesh(boxGeom, materials.deskWood);
  top.scale.set(2.2, 0.05, 0.9);
  top.position.y = 0.75;
  deskGroup.add(top);

  // Thick legs
  const legW = 0.08;
  for (const [lx, lz] of [
    [2.2 / 2 - 0.1, 0.9 / 2 - 0.1],
    [-2.2 / 2 + 0.1, 0.9 / 2 - 0.1],
    [2.2 / 2 - 0.1, -0.9 / 2 + 0.1],
    [-2.2 / 2 + 0.1, -0.9 / 2 + 0.1]
  ]) {
    const leg = new THREE.Mesh(boxGeom, materials.metalDark);
    leg.scale.set(legW, 0.725, legW);
    leg.position.set(lx, 0.3625, lz);
    deskGroup.add(leg);
  }
  
  // Add a couple of laptop props on the desk
  const laptop = new THREE.Mesh(boxGeom, materials.keyboard);
  laptop.scale.set(0.4, 0.02, 0.25);
  laptop.position.set(-0.4, 0.78, 0);
  deskGroup.add(laptop);

  const laptop2 = new THREE.Mesh(boxGeom, materials.keyboard);
  laptop2.scale.set(0.4, 0.02, 0.25);
  laptop2.position.set(0.4, 0.78, 0);
  deskGroup.add(laptop2);

  group.add(deskGroup);

  // Two comfortable sofas facing each other in front of the IT Bar counter
  group.add(createSofaUnit(cx - 1.5, cz + 0.8, Math.PI / 2, resources));
  group.add(createSofaUnit(cx + 1.5, cz + 0.8, -Math.PI / 2, resources));

  return group;
}

/**
 * Main generator entry point.
 * Dispatches a layout configuration to the appropriate 3D layout module.
 * 
 * @param {Object} layoutConfig - Layout configuration from Resolver
 * @param {number} cx - Center X coordinate of room in world space
 * @param {number} cz - Center Z coordinate of room in world space
 * @param {number} wM - Room width in meters
 * @param {number} hM - Room depth in meters
 * @param {Object} resources - Shared geometries/materials cache
 * @returns {THREE.Group} Group containing placed furniture models
 */
export function generateFurniture(layoutConfig, cx, cz, wM, hM, resources) {
  const { type, customItems } = layoutConfig;

  // 1. Handle future explicit custom layouts
  if (type === "CUSTOM" && Array.isArray(customItems)) {
    const group = new THREE.Group();
    customItems.forEach(item => {
      // coordinates (item.x, item.z) are relative to room center (cx, cz) or absolute?
      // Design: custom layout offsets are relative to room center
      const worldX = cx + (item.x || 0);
      const worldZ = cz + (item.z || 0);
      const rotation = item.rotation || 0;

      let model = null;
      switch (item.type) {
        // Parametric Furniture Components
        case "DeskBench":
          model = createDeskBench(worldX, worldZ, item, resources);
          break;
        case "Table":
          model = createTable(worldX, worldZ, item, resources);
          break;
        case "Chair":
          model = createChair(worldX, worldZ, item, resources);
          break;
        case "Sofa":
          model = createSofa(worldX, worldZ, item, resources);
          break;
        case "Cabinet":
          model = createCabinet(worldX, worldZ, item, resources);
          break;

        // Landmark Modules
        case "Printer":
          model = createPrinter(worldX, worldZ, resources);
          break;
        case "Lockers":
          model = createLockers(worldX, worldZ, item, resources);
          break;
        case "CoffeeMachine":
          model = createCoffeeMachine(worldX, worldZ, resources);
          break;
        case "TVDisplay":
          model = createTVDisplay(worldX, worldZ, item, resources);
          break;
        case "Whiteboard":
          model = createWhiteboard(worldX, worldZ, rotation, resources);
          break;
        case "Plant":
        case "PottedPlant":
          model = createPottedPlant(worldX, worldZ, resources);
          break;

        // Legacy / High-level composite layouts (backward compatibility)
        case "Desk":
          model = createDeskUnit(worldX, worldZ, rotation, resources);
          break;
        case "SofaUnit":
          model = createSofaUnit(worldX, worldZ, rotation, resources);
          break;
        case "WhiteboardUnit":
          model = createWhiteboardUnit(worldX, worldZ, rotation, resources);
          break;
        case "PlantUnit":
          model = createPlantUnit(worldX, worldZ, resources);
          break;
        case "Pod6":
          model = layoutPod6(worldX, worldZ, 3.6, 1.2, resources);
          break;
        case "Bench8":
        case "Pod8":
          model = layoutPod8(worldX, worldZ, 4.8, 1.2, resources);
          break;
        case "CollabIsland":
          model = layoutCollabIsland(worldX, worldZ, 6.0, 4.0, resources);
          break;
        case "HighTable":
          model = layoutHighTables(worldX, worldZ, 2.0, 0.8, resources);
          break;
        default:
          console.warn(`Unknown custom furniture type: ${item.type}`);
          break;
      }
      if (model) {
        group.add(model);
      }
    });
    return group;
  }

  // 2. Dispatch to standard layout modules
  switch (type) {
    case "BENCH_HORIZONTAL":
      return layoutBenchHorizontal(cx, cz, wM, hM, resources);
    case "BENCH_VERTICAL":
      return layoutBenchVertical(cx, cz, wM, hM, resources);
    case "POD_4":
      return layoutPod4(cx, cz, wM, hM, resources);
    case "POD_6":
      return layoutPod6(cx, cz, wM, hM, resources);
    case "POD_8":
      return layoutPod8(cx, cz, wM, hM, resources);
    case "COLLAB_ISLAND":
      return layoutCollabIsland(cx, cz, wM, hM, resources);
    case "LOUNGE_SEATING":
      return layoutLoungeSeating(cx, cz, wM, hM, resources);
    case "PANTRY_SEATING":
      return layoutPantrySeating(cx, cz, wM, hM, resources);
    case "HIGH_TABLES":
      return layoutHighTables(cx, cz, wM, hM, resources);
    case "EXECUTIVE_DESK":
      return layoutExecutiveDesk(cx, cz, wM, hM, resources);
    case "RECEPTION_DESK":
      return layoutReceptionDesk(cx, cz, wM, hM, resources);
    case "IT_BAR":
      return layoutITBar(cx, cz, wM, hM, resources);
    default:
      console.warn(`Layout type "${type}" not recognized. Falling back to BENCH_HORIZONTAL.`);
      return layoutBenchHorizontal(cx, cz, wM, hM, resources);
  }
}
