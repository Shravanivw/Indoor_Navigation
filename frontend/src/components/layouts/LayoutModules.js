import * as THREE from "three";
import {
  createDeskUnit,
  createSofaUnit,
  createWhiteboardUnit,
  createPlantUnit,
  createCabinet
} from "./FurnitureModels";

/**
 * Helper to layout pods of size (colsCount x 2)
 */
function layoutGenericPod(cx, cz, wM, hM, colsCount, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const deskW = 1.2;
  const deskD = 0.6;

  // Pod footprint
  const podW = colsCount * deskW;
  const podD = 2 * deskD;

  // Spacing between pods
  const spacingX = podW + 1.4;
  const spacingZ = podD + 1.2;

  // Determine how many pods fit (safely clamped)
  const numPodsX = Math.min(4, Math.max(1, Math.floor((wM - 0.4) / spacingX)));
  const numPodsZ = Math.min(4, Math.max(1, Math.floor((hM - 0.4) / spacingZ)));

  const startX = cx - ((numPodsX - 1) * spacingX) / 2;
  const startZ = cz - ((numPodsZ - 1) * spacingZ) / 2;

  for (let px = 0; px < numPodsX; px++) {
    for (let pz = 0; pz < numPodsZ; pz++) {
      const pcx = startX + px * spacingX;
      const pcz = startZ + pz * spacingZ;

      // Draw desks in the pod
      const startDeskX = pcx - ((colsCount - 1) * deskW) / 2;

      for (let c = 0; c < colsCount; c++) {
        const dx = startDeskX + c * deskW;

        // North facing desk (front facing south)
        group.add(createDeskUnit(dx, pcz - deskD / 2, 0, resources));

        // South facing desk (front facing north)
        group.add(createDeskUnit(dx, pcz + deskD / 2, Math.PI, resources));

        // Glass partition divider between back-to-back rows
        const divider = new THREE.Mesh(geometries.box, materials.glass);
        divider.scale.set(deskW, 0.4, 0.02);
        divider.position.set(dx, 0.95, pcz);
        group.add(divider);
      }
    }
  }

  return group;
}

/**
 * 1. BENCH ROWS HORIZONTAL
 * Standard horizontal row of desks facing each other.
 */
export function layoutBenchHorizontal(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const deskW = 1.2;
  const deskD = 0.6;
  const gapX  = 0.4;
  const gapZ  = 0.4;

  const cols = Math.min(8, Math.max(1, Math.floor((wM - 0.6) / (deskW + gapX))));
  const rows = Math.min(8, Math.max(1, Math.floor((hM - 0.6) / (deskD + gapZ))));

  const startX = cx - ((cols - 1) * (deskW + gapX)) / 2;
  const startZ = cz - ((rows - 1) * (deskD + gapZ)) / 2;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const rotY = (r % 2 === 0) ? 0 : Math.PI;
      const dx = startX + c * (deskW + gapX);
      const dz = startZ + r * (deskD + gapZ);
      group.add(createDeskUnit(dx, dz, rotY, resources));

      // Partition divider between back-to-back rows
      if (r > 0 && r % 2 === 1) {
        const divider = new THREE.Mesh(geometries.box, materials.glass);
        divider.scale.set(deskW, 0.4, 0.02);
        const prevZ = startZ + (r - 1) * (deskD + gapZ);
        const currZ = startZ + r * (deskD + gapZ);
        divider.position.set(dx, 0.95, (prevZ + currZ) / 2);
        group.add(divider);
      }
    }
  }

  return group;
}

/**
 * 2. BENCH ROWS VERTICAL
 * Standard vertical row of desks.
 */
export function layoutBenchVertical(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const deskW = 1.2; // desk length (now along Z)
  const deskD = 0.6; // desk depth (now along X)
  const gapX  = 0.4;
  const gapZ  = 0.4;

  const cols = Math.min(8, Math.max(1, Math.floor((wM - 0.6) / (deskD + gapX))));
  const rows = Math.min(8, Math.max(1, Math.floor((hM - 0.6) / (deskW + gapZ))));

  const startX = cx - ((cols - 1) * (deskD + gapX)) / 2;
  const startZ = cz - ((rows - 1) * (deskW + gapZ)) / 2;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Alternate rotations (facing East vs facing West)
      const rotY = (c % 2 === 0) ? Math.PI / 2 : -Math.PI / 2;
      const dx = startX + c * (deskD + gapX);
      const dz = startZ + r * (deskW + gapZ);
      group.add(createDeskUnit(dx, dz, rotY, resources));

      // Partition divider between back-to-back columns
      if (c > 0 && c % 2 === 1) {
        const divider = new THREE.Mesh(geometries.box, materials.glass);
        divider.scale.set(0.02, 0.4, deskW);
        const prevX = startX + (c - 1) * (deskD + gapX);
        const currX = startX + c * (deskD + gapX);
        divider.position.set((prevX + currX) / 2, 0.95, dz);
        group.add(divider);
      }
    }
  }

  return group;
}

/**
 * 3. 4-SEAT PODS
 */
export function layoutPod4(cx, cz, wM, hM, resources) {
  return layoutGenericPod(cx, cz, wM, hM, 2, resources);
}

/**
 * 4. 6-SEAT PODS
 */
export function layoutPod6(cx, cz, wM, hM, resources) {
  return layoutGenericPod(cx, cz, wM, hM, 3, resources);
}

/**
 * 5. 8-SEAT PODS
 */
export function layoutPod8(cx, cz, wM, hM, resources) {
  return layoutGenericPod(cx, cz, wM, hM, 4, resources);
}

/**
 * 6. COLLABORATION ISLANDS
 * Half desks, half collaboration hub.
 */
export function layoutCollabIsland(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { materials } = resources;

  // Desks on the Left (West)
  const deskCountX = Math.min(6, Math.max(1, Math.floor((wM / 2 - 0.8) / 1.4)));
  const deskCountZ = Math.min(6, Math.max(1, Math.floor((hM - 1.2) / 1.4)));
  const deskStartX = cx - wM / 4 - ((deskCountX - 1) * 1.4) / 2;
  const deskStartZ = cz - ((deskCountZ - 1) * 1.4) / 2;

  for (let c = 0; c < deskCountX; c++) {
    for (let r = 0; r < deskCountZ; r++) {
      group.add(createDeskUnit(deskStartX + c * 1.4, deskStartZ + r * 1.4, 0, resources));
    }
  }

  // Collaboration Hub on the Right (East)
  const collabCX = cx + wM / 4;
  const collabCZ = cz;

  // Circular rug
  const roundRug = new THREE.Mesh(
    new THREE.RingGeometry(0.1, Math.min(wM, hM) / 4, 32),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 1.0 })
  );
  roundRug.rotation.x = -Math.PI / 2;
  roundRug.position.set(collabCX, 0.015, collabCZ);
  group.add(roundRug);

  // Modern curved sofa
  group.add(createSofaUnit(collabCX, collabCZ + 0.8, 0, resources));

  // Whiteboard
  group.add(createWhiteboardUnit(collabCX - 0.7, collabCZ - 0.8, Math.PI / 6, resources));

  // Plant
  group.add(createPlantUnit(collabCX + 0.8, collabCZ - 0.8, resources));

  return group;
}

/**
 * 7. LOUNGE SEATING
 * Cozy lounge configuration.
 */
export function layoutLoungeSeating(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  // Center coffee table
  const tableTop = new THREE.Mesh(geometries.cylinder, materials.deskWood);
  tableTop.scale.set(0.9, 0.04, 0.9);
  tableTop.position.set(cx, 0.6, cz);
  group.add(tableTop);
  
  const tableShift = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
  tableShift.scale.set(0.06, 0.58, 0.06);
  tableShift.position.set(cx, 0.29, cz);
  group.add(tableShift);
  
  const tableBase = new THREE.Mesh(geometries.cylinder, materials.metalDark);
  tableBase.scale.set(0.4, 0.02, 0.4);
  tableBase.position.set(cx, 0.01, cz);
  group.add(tableBase);

  // Lounge chairs
  const createLoungeChair = (angle) => {
    const chair = new THREE.Group();
    const dist = 0.7;
    chair.position.set(cx + Math.cos(angle) * dist, 0, cz + Math.sin(angle) * dist);
    chair.rotation.y = -angle - Math.PI / 2;

    const seat = new THREE.Mesh(geometries.box, materials.cushionLounge);
    seat.scale.set(0.45, 0.35, 0.45);
    seat.position.y = 0.175;
    chair.add(seat);

    const back = new THREE.Mesh(geometries.box, materials.cushionLounge);
    back.scale.set(0.45, 0.4, 0.1);
    back.position.set(0, 0.4, 0.185);
    chair.add(back);

    return chair;
  };

  group.add(createLoungeChair(0));
  group.add(createLoungeChair((Math.PI * 2) / 3));
  group.add(createLoungeChair((Math.PI * 4) / 3));

  return group;
}

/**
 * 8. PANTRY SEATING
 * Round pantry tables with chairs.
 */
export function layoutPantrySeating(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const tableSpace = 1.8;
  const numTables = Math.min(6, Math.max(1, Math.floor((wM - 1.2) / tableSpace)));
  const startTableX = cx - ((numTables - 1) * tableSpace) / 2;

  const createDiningTableSetup = (tX, tZ) => {
    const tableSetup = new THREE.Group();
    tableSetup.position.set(tX, 0, tZ);

    const tableTop = new THREE.Mesh(geometries.cylinder, materials.deskWood);
    tableTop.scale.set(0.9, 0.04, 0.9);
    tableTop.position.y = 0.75;
    tableSetup.add(tableTop);

    const tableShaft = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
    tableShaft.scale.set(0.08, 0.73, 0.08);
    tableShaft.position.y = 0.365;
    tableSetup.add(tableShaft);

    const tableBase = new THREE.Mesh(geometries.cylinder, materials.metalDark);
    tableBase.scale.set(0.45, 0.02, 0.45);
    tableBase.position.y = 0.01;
    tableSetup.add(tableBase);

    const createCafeChair = (rad, angle) => {
      const chairGroup = new THREE.Group();
      chairGroup.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
      chairGroup.rotation.y = -angle - Math.PI / 2;

      for (const [lx, lz] of [
        [-0.15, -0.15],
        [0.15, -0.15],
        [-0.15, 0.15],
        [0.15, 0.15]
      ]) {
        const leg = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
        leg.scale.set(0.025, 0.44, 0.025);
        leg.position.set(lx, 0.22, lz);
        chairGroup.add(leg);
      }

      const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
      seat.scale.set(0.36, 0.04, 0.36);
      seat.position.y = 0.44;
      chairGroup.add(seat);

      const back = new THREE.Mesh(geometries.box, materials.chairFabric);
      back.scale.set(0.34, 0.35, 0.04);
      back.position.set(0, 0.655, 0.16);
      chairGroup.add(back);

      return chairGroup;
    };

    tableSetup.add(createCafeChair(0.65, 0));
    tableSetup.add(createCafeChair(0.65, Math.PI / 2));
    tableSetup.add(createCafeChair(0.65, Math.PI));
    tableSetup.add(createCafeChair(0.65, (Math.PI * 3) / 2));

    return tableSetup;
  };

  for (let i = 0; i < numTables; i++) {
    group.add(createDiningTableSetup(startTableX + i * tableSpace, cz));
  }

  return group;
}

/**
 * 9. HIGH TABLES
 * Collaborative tall standing table with stools.
 */
export function layoutHighTables(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const tableW = Math.min(2.0, wM * 0.7);
  const tableD = 0.8;
  const tableH = 1.05; // Bar height

  const tableTop = new THREE.Mesh(geometries.box, materials.deskWood);
  tableTop.scale.set(tableW, 0.04, tableD);
  tableTop.position.set(cx, tableH, cz);
  group.add(tableTop);

  // Tall metal legs
  for (const [lx, lz] of [
    [tableW / 2 - 0.08, tableD / 2 - 0.08],
    [-tableW / 2 + 0.08, tableD / 2 - 0.08],
    [tableW / 2 - 0.08, -tableD / 2 + 0.08],
    [-tableW / 2 + 0.08, -tableD / 2 + 0.08]
  ]) {
    const leg = new THREE.Mesh(geometries.box, materials.metalDark);
    leg.scale.set(0.06, tableH - 0.02, 0.06);
    leg.position.set(cx + lx, (tableH - 0.02) / 2, cz + lz);
    group.add(leg);
  }

  // Stools
  const createStool = (sx, sz) => {
    const stool = new THREE.Group();
    stool.position.set(sx, 0, sz);

    const seat = new THREE.Mesh(geometries.cylinder, materials.chairFabric);
    seat.scale.set(0.32, 0.04, 0.32);
    seat.position.y = 0.75;
    stool.add(seat);

    const leg1 = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
    leg1.scale.set(0.02, 0.73, 0.02);
    leg1.position.set(-0.1, 0.365, -0.1);
    stool.add(leg1);

    const leg2 = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
    leg2.scale.set(0.02, 0.73, 0.02);
    leg2.position.set(0.1, 0.365, -0.1);
    stool.add(leg2);

    const leg3 = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
    leg3.scale.set(0.02, 0.73, 0.02);
    leg3.position.set(-0.1, 0.365, 0.1);
    stool.add(leg3);

    const leg4 = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
    leg4.scale.set(0.02, 0.73, 0.02);
    leg4.position.set(0.1, 0.365, 0.1);
    stool.add(leg4);

    return stool;
  };

  group.add(createStool(cx - 0.5, cz - 0.65));
  group.add(createStool(cx + 0.5, cz - 0.65));
  group.add(createStool(cx - 0.5, cz + 0.65));
  group.add(createStool(cx + 0.5, cz + 0.65));

  return group;
}

/**
 * 10. EXECUTIVE DESK
 * Executive office arrangement.
 */
export function layoutExecutiveDesk(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const tableW = 1.6;
  const tableD = 0.8;

  // Main Desk
  const deskTop = new THREE.Mesh(geometries.box, materials.deskWood);
  deskTop.scale.set(tableW, 0.04, tableD);
  deskTop.position.set(cx, 0.75, cz - 0.2);
  group.add(deskTop);

  // Legs
  for (const [lx, lz] of [
    [tableW / 2 - 0.08, tableD / 2 - 0.08],
    [-tableW / 2 + 0.08, tableD / 2 - 0.08],
    [tableW / 2 - 0.08, -tableD / 2 + 0.08],
    [-tableW / 2 + 0.08, -tableD / 2 + 0.08]
  ]) {
    const leg = new THREE.Mesh(geometries.box, materials.metalDark);
    leg.scale.set(0.08, 0.73, 0.08);
    leg.position.set(cx + lx, 0.365, cz - 0.2 + lz);
    group.add(leg);
  }

  // Executive high-back chair (facing North)
  const execChair = new THREE.Group();
  execChair.position.set(cx, 0, cz - 0.2 - tableD / 2 - 0.3);
  execChair.rotation.y = 0; // facing North (towards desk)
  const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
  seat.scale.set(0.46, 0.08, 0.44);
  seat.position.y = 0.45;
  execChair.add(seat);
  const back = new THREE.Mesh(geometries.box, materials.chairFabric);
  back.scale.set(0.42, 0.6, 0.06);
  back.position.set(0, 0.78, -0.2);
  execChair.add(back);
  const stand = new THREE.Mesh(geometries.cylinder, materials.chairBase);
  stand.scale.set(0.06, 0.45, 0.06);
  stand.position.y = 0.225;
  execChair.add(stand);
  group.add(execChair);

  // Visitor chairs (facing South)
  const createVisitorChair = (vx) => {
    const chair = new THREE.Group();
    chair.position.set(vx, 0, cz - 0.2 + tableD / 2 + 0.4);
    chair.rotation.y = Math.PI; // facing South

    const vSeat = new THREE.Mesh(geometries.box, materials.chairFabric);
    vSeat.scale.set(0.4, 0.05, 0.4);
    vSeat.position.y = 0.43;
    chair.add(vSeat);

    const vBack = new THREE.Mesh(geometries.box, materials.chairFabric);
    vBack.scale.set(0.38, 0.4, 0.05);
    vBack.position.set(0, 0.63, 0.185);
    chair.add(vBack);

    for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
      const leg = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
      leg.scale.set(0.025, 0.41, 0.025);
      leg.position.set(lx, 0.205, lz);
      chair.add(leg);
    }
    return chair;
  };

  group.add(createVisitorChair(cx - 0.5));
  group.add(createVisitorChair(cx + 0.5));

  // Low storage credenza or cabinet
  if (wM > 2.8) {
    const cabinetW = 1.2;
    const cabinetH = 0.75;
    const cabinetD = 0.45;
    const cab = createCabinet(cx + wM / 2 - cabinetD / 2 - 0.15, cz, {
      width: cabinetW,
      height: cabinetH,
      depth: cabinetD,
      rotation: Math.PI / 2,
      style: "closed-doors",
      finish: "wood"
    }, resources);
    group.add(cab);
  } else {
    const cabinetW = 0.8;
    const cabinetH = 0.75;
    const cabinetD = 0.4;
    const cab = createCabinet(cx, cz - hM / 2 + cabinetD / 2 + 0.15, {
      width: cabinetW,
      height: cabinetH,
      depth: cabinetD,
      style: "closed-doors",
      finish: "wood"
    }, resources);
    group.add(cab);
  }

  // Laptop/Monitor setup on the desk
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(cx, 0.77, cz - 0.2);
  const laptopBase = new THREE.Mesh(geometries.box, materials.metalSilver);
  laptopBase.scale.set(0.28, 0.015, 0.2);
  laptopGroup.add(laptopBase);
  const laptopScreen = new THREE.Mesh(geometries.box, materials.screenGlow);
  laptopScreen.scale.set(0.28, 0.18, 0.01);
  laptopScreen.position.set(0, 0.1, -0.1);
  laptopScreen.rotation.x = -0.15;
  laptopGroup.add(laptopScreen);
  group.add(laptopGroup);

  // Optional wall-mounted TV for larger cabins
  if (wM > 3.5 && hM > 3.5) {
    const tvGroup = new THREE.Group();
    tvGroup.position.set(cx - wM / 2 + 0.08, 1.5, cz);
    tvGroup.rotation.y = Math.PI / 2;
    const tvBezel = new THREE.Mesh(geometries.box, materials.metalDark);
    tvBezel.scale.set(1.2, 0.7, 0.04);
    tvGroup.add(tvBezel);
    const tvScreen = new THREE.Mesh(geometries.box, materials.screenGlow);
    tvScreen.scale.set(1.15, 0.65, 0.005);
    tvScreen.position.z = 0.022;
    tvGroup.add(tvScreen);
    group.add(tvGroup);
  }

  // Small planter in the corner
  group.add(createPlantUnit(cx + wM / 2.5, cz - hM / 2.5, resources));

  return group;
}

/**
 * 11. RECEPTION DESK
 */
export function layoutReceptionDesk(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;

  const counterW = Math.min(wM * 0.75, 3.2);
  const counterH = 1.05;
  const counterD = 0.65;

  // Center counter box
  const centerCounter = new THREE.Mesh(geometries.box, materials.cushionLounge); // Deep blue paint finish
  centerCounter.scale.set(counterW, counterH, counterD);
  centerCounter.position.set(cx, counterH / 2, cz);
  group.add(centerCounter);

  // Wooden counter ledge top
  const ledge = new THREE.Mesh(geometries.box, materials.deskWood);
  ledge.scale.set(counterW + 0.15, 0.06, counterD + 0.1);
  ledge.position.set(cx, counterH + 0.03, cz + 0.02);
  group.add(ledge);

  // Task chair behind counter
  const taskChair = new THREE.Group();
  taskChair.position.set(cx, 0, cz - 0.55); // behind counter
  const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
  seat.scale.set(0.42, 0.06, 0.42);
  seat.position.y = 0.5;
  taskChair.add(seat);
  const back = new THREE.Mesh(geometries.box, materials.chairFabric);
  back.scale.set(0.38, 0.35, 0.05);
  back.position.set(0, 0.78, -0.15);
  taskChair.add(back);
  const stand = new THREE.Mesh(geometries.cylinder, materials.chairBase);
  stand.scale.set(0.05, 0.5, 0.05);
  stand.position.y = 0.25;
  taskChair.add(stand);
  group.add(taskChair);

  // Monitor on reception desk
  const monitor = new THREE.Mesh(geometries.box, materials.metalDark);
  monitor.scale.set(0.4, 0.28, 0.25);
  monitor.position.set(cx - 0.5, counterH + 0.15, cz);
  group.add(monitor);

  return group;
}
