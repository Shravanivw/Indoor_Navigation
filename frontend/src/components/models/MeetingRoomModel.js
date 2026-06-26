import * as THREE from "three";
import { createRoomWalls } from "./ModelShared";

export function createMeetingRoom(cx, cz, wM, hM, isDest, isUser, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.15;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Draw three solid enclosing walls (North, East, West)
  // We construct them manually here so we can keep the South (corridor-facing) wall as glass.
  // West Wall
  const wallW = new THREE.Mesh(boxGeom, wallMat);
  wallW.scale.set(wt, wallHeight, hM);
  wallW.position.set(cx - wM / 2, wallHeight / 2, cz);
  group.add(wallW);

  // East Wall
  const wallE = new THREE.Mesh(boxGeom, wallMat);
  wallE.scale.set(wt, wallHeight, hM);
  wallE.position.set(cx + wM / 2, wallHeight / 2, cz);
  group.add(wallE);

  // North Wall
  const wallN = new THREE.Mesh(boxGeom, wallMat);
  wallN.scale.set(wM + wt * 2, wallHeight, wt);
  wallN.position.set(cx, wallHeight / 2, cz - hM / 2);
  group.add(wallN);

  // 2. South Wall (Glass Partition with Doorway)
  // We leave a 1.0m doorway on the South wall (e.g. from x = 0.2 to 1.2 relative to room center)
  // South Wall Center coordinates
  const sZ = cz + hM / 2;
  const doorWidth = 0.95;
  const doorHeight = 2.0;

  // Let's place the doorway slightly off-center (say, to the right)
  // Door range in local X: from (wM/2 - doorWidth - 0.4) to (wM/2 - 0.4)
  const localDoorXStart = wM / 2 - doorWidth - 0.3;
  const localDoorXEnd   = wM / 2 - 0.3;
  const doorCX = cx + (localDoorXStart + localDoorXEnd) / 2;

  // Remaining South wall space:
  // Left Segment (Drywall or glass. Let's make it glass with frame!)
  const leftSegW = wM / 2 + localDoorXStart; // from -wM/2 to localDoorXStart
  const leftSegCX = cx - wM / 2 + leftSegW / 2;

  if (leftSegW > 0.1) {
    // Glass panel
    const glassPanel = new THREE.Mesh(boxGeom, materials.glass);
    glassPanel.scale.set(leftSegW, wallHeight, 0.03);
    glassPanel.position.set(leftSegCX, wallHeight / 2, sZ);
    group.add(glassPanel);

    // Bottom metal runner
    const runnerB = new THREE.Mesh(boxGeom, materials.glassFrame);
    runnerB.scale.set(leftSegW, 0.08, 0.05);
    runnerB.position.set(leftSegCX, 0.04, sZ);
    group.add(runnerB);

    // Top metal runner
    const runnerT = new THREE.Mesh(boxGeom, materials.glassFrame);
    runnerT.scale.set(leftSegW, 0.08, 0.05);
    runnerT.position.set(leftSegCX, wallHeight - 0.04, sZ);
    group.add(runnerT);
  }

  // Right Segment (between door and East wall)
  const rightSegW = wM / 2 - localDoorXEnd; // from localDoorXEnd to wM/2
  const rightSegCX = cx + wM / 2 - rightSegW / 2;

  if (rightSegW > 0.1) {
    // Drywall corner or solid post
    const solidCorner = new THREE.Mesh(boxGeom, wallMat);
    solidCorner.scale.set(rightSegW, wallHeight, wt);
    solidCorner.position.set(rightSegCX, wallHeight / 2, sZ);
    group.add(solidCorner);
  }

  // Header above the doorway (door lintel)
  const headerH = wallHeight - doorHeight;
  if (headerH > 0.05) {
    const header = new THREE.Mesh(boxGeom, wallMat);
    header.scale.set(doorWidth, headerH, wt);
    header.position.set(doorCX, doorHeight + headerH / 2, sZ);
    group.add(header);
  }

  // 3. Conference Table (Rectangular maple top with rounded styling)
  const tableW = Math.max(1.2, Math.min(wM * 0.62, 4.2));
  const tableD = Math.max(0.7, Math.min(hM * 0.42, 1.8));

  // Table base rug
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(tableW + 1.2, tableD + 1.2),
    materials.floorCarpet
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(cx, 0.015, cz);
  group.add(rug);

  // Table top
  const tableTop = new THREE.Mesh(boxGeom, materials.deskWood);
  tableTop.scale.set(tableW, 0.05, tableD);
  tableTop.position.set(cx, 0.75, cz);
  group.add(tableTop);

  // Table base pillars (two thick metal drums instead of four legs for premium look)
  if (tableW > 1.8) {
    const drum1 = new THREE.Mesh(cylGeom, materials.metalDark);
    drum1.scale.set(0.4, 0.72, 0.4);
    drum1.position.set(cx - tableW / 4, 0.36, cz);
    group.add(drum1);

    const drum2 = new THREE.Mesh(cylGeom, materials.metalDark);
    drum2.scale.set(0.4, 0.72, 0.4);
    drum2.position.set(cx + tableW / 4, 0.36, cz);
    group.add(drum2);
  } else {
    const drum = new THREE.Mesh(cylGeom, materials.metalDark);
    drum.scale.set(0.35, 0.72, 0.35);
    drum.position.set(cx, 0.36, cz);
    group.add(drum);
  }

  // 4. Executive Chairs
  // Place chairs on North and South sides of the table
  const chairSpacing = 0.65;
  const numChairsPerSide = Math.max(1, Math.floor(tableW / chairSpacing));
  const chairStartX = cx - ((numChairsPerSide - 1) * chairSpacing) / 2;

  const createMeetingChair = (chX, chZ, rotY) => {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(chX, 0, chZ);
    chairGroup.rotation.y = rotY;

    // Pedestal base
    const base = new THREE.Mesh(boxGeom, materials.chairBase);
    base.scale.set(0.38, 0.02, 0.38);
    base.position.y = 0.05;
    chairGroup.add(base);

    // Shaft
    const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
    shaft.scale.set(0.04, 0.36, 0.04);
    shaft.position.y = 0.23;
    chairGroup.add(shaft);

    // Cushion seat
    const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
    seat.scale.set(0.44, 0.08, 0.42);
    seat.position.y = 0.45;
    chairGroup.add(seat);

    // High backrest
    const back = new THREE.Mesh(boxGeom, materials.chairFabric);
    back.scale.set(0.4, 0.5, 0.06);
    back.position.set(0, 0.76, 0.18);
    chairGroup.add(back);

    return chairGroup;
  };

  for (let i = 0; i < numChairsPerSide; i++) {
    const x = chairStartX + i * chairSpacing;
    // North side chairs (facing South, rotY = PI)
    group.add(createMeetingChair(x, cz - tableD / 2 - 0.32, Math.PI));
    // South side chairs (facing North, rotY = 0)
    group.add(createMeetingChair(x, cz + tableD / 2 + 0.32, 0));
  }

  // Optional ends of the table chairs (for larger conference rooms)
  if (tableW > 2.2) {
    // East end facing West (rotY = -PI/2)
    group.add(createMeetingChair(cx + tableW / 2 + 0.32, cz, -Math.PI / 2));
    // West end facing East (rotY = PI/2)
    group.add(createMeetingChair(cx - tableW / 2 - 0.32, cz, Math.PI / 2));
  }

  // 5. TV Display mounted on the North wall
  const tvGroup = new THREE.Group();
  tvGroup.position.set(cx, 1.4, cz - hM / 2 + wt / 2 + 0.02);
  // TV Screen body
  const tvBezel = new THREE.Mesh(boxGeom, materials.metalDark);
  tvBezel.scale.set(1.2, 0.7, 0.04);
  tvGroup.add(tvBezel);
  // Glowing screens (displaying a presentation mockup)
  const tvScreen = new THREE.Mesh(boxGeom, materials.screenGlow);
  tvScreen.scale.set(1.15, 0.65, 0.005);
  tvScreen.position.z = 0.022;
  tvGroup.add(tvScreen);
  group.add(tvGroup);

  return group;
}
