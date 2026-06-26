import * as THREE from "three";
import { createPolygonWalls, findCorridorSegmentIndex } from "./ModelShared";

export function createLift(polygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, grid) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.12;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Find corridor segment index
  const doorIndex = findCorridorSegmentIndex(polygon, grid);

  // 2. Build polygon walls with door cutout
  group.add(
    createPolygonWalls({
      polygon,
      wallHeight,
      wallThickness: wt,
      material: wallMat,
      doorSegmentIndex: doorIndex,
      doorWidth: 1.3,
      doorHeight: 2.1,
      resources,
      toWorld
    })
  );

  // 3. Render Lift Doors aligned with the corridor segment
  const p1 = polygon[doorIndex];
  const p2 = polygon[(doorIndex + 1) % polygon.length];
  const wp1 = toWorld(p1.x, p1.y);
  const wp2 = toWorld(p2.x, p2.y);

  const dx = wp2.x - wp1.x;
  const dz = wp2.z - wp1.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  if (len > 0.1) {
    const doorMidX = (wp1.x + wp2.x) / 2;
    const doorMidZ = (wp1.z + wp2.z) / 2;
    const angle = Math.atan2(dx, dz);

    let nx = -dz;
    let nz = dx;
    const nLen = Math.sqrt(nx * nx + nz * nz);
    if (nLen > 0) { nx /= nLen; nz /= nLen; }

    const dist1 = (doorMidX + nx * 0.1 - cx) ** 2 + (doorMidZ + nz * 0.1 - cz) ** 2;
    const dist2 = (doorMidX - nx * 0.1 - cx) ** 2 + (doorMidZ - nz * 0.1 - cz) ** 2;
    const outX = dist1 > dist2 ? nx : -nx;
    const outZ = dist1 > dist2 ? nz : -nz;

    const liftDoorGroup = new THREE.Group();
    liftDoorGroup.position.set(doorMidX + outX * 0.015, 0, doorMidZ + outZ * 0.015);
    liftDoorGroup.rotation.y = angle;

    const doorWidth = 1.3;
    const doorHeight = 2.1;

    const doorL = new THREE.Mesh(boxGeom, materials.metalSilver);
    doorL.scale.set(0.02, doorHeight, doorWidth / 2);
    doorL.position.set(0, doorHeight / 2, -doorWidth / 4);
    liftDoorGroup.add(doorL);

    const doorR = new THREE.Mesh(boxGeom, materials.metalSilver);
    doorR.scale.set(0.02, doorHeight, doorWidth / 2);
    doorR.position.set(0, doorHeight / 2, doorWidth / 4);
    liftDoorGroup.add(doorR);

    const seam = new THREE.Mesh(boxGeom, materials.metalDark);
    seam.scale.set(0.022, doorHeight, 0.015);
    seam.position.set(0, doorHeight / 2, 0);
    liftDoorGroup.add(seam);

    const frameL = new THREE.Mesh(boxGeom, materials.metalDark);
    frameL.scale.set(0.04, doorHeight + 0.06, 0.05);
    frameL.position.set(-0.01, doorHeight / 2 + 0.03, -doorWidth / 2 - 0.025);
    liftDoorGroup.add(frameL);

    const frameR = new THREE.Mesh(boxGeom, materials.metalDark);
    frameR.scale.set(0.04, doorHeight + 0.06, 0.05);
    frameR.position.set(-0.01, doorHeight / 2 + 0.03, doorWidth / 2 + 0.025);
    liftDoorGroup.add(frameR);

    const frameT = new THREE.Mesh(boxGeom, materials.metalDark);
    frameT.scale.set(0.04, 0.05, doorWidth + 0.1);
    frameT.position.set(-0.01, doorHeight + 0.025, 0);
    liftDoorGroup.add(frameT);

    const indicator = new THREE.Group();
    indicator.position.set(-0.02, doorHeight + 0.22, 0);
    const ipPlate = new THREE.Mesh(boxGeom, materials.metalDark);
    ipPlate.scale.set(0.015, 0.12, 0.35);
    indicator.add(ipPlate);
    const ipLed = new THREE.Mesh(boxGeom, materials.rackLedGreen);
    ipLed.scale.set(0.02, 0.06, 0.25);
    ipLed.position.set(-0.005, 0, 0);
    indicator.add(ipLed);
    liftDoorGroup.add(indicator);

    const callButtons = new THREE.Group();
    callButtons.position.set(-0.015, 1.25, doorWidth / 2 + 0.18);
    const cbPlate = new THREE.Mesh(boxGeom, materials.metalDark);
    cbPlate.scale.set(0.015, 0.22, 0.08);
    callButtons.add(cbPlate);
    const btnUp = new THREE.Mesh(cylGeom, materials.metalSilver);
    btnUp.scale.set(0.02, 0.03, 0.02);
    btnUp.rotation.z = Math.PI / 2;
    btnUp.position.set(-0.01, 0.05, 0);
    callButtons.add(btnUp);
    const btnDown = new THREE.Mesh(cylGeom, materials.metalSilver);
    btnDown.scale.set(0.02, 0.03, 0.02);
    btnDown.rotation.z = Math.PI / 2;
    btnDown.position.set(-0.01, -0.05, 0);
    callButtons.add(btnDown);
    liftDoorGroup.add(callButtons);

    group.add(liftDoorGroup);
  }

  return group;
}

/**
 * Builds a clear, open lift lobby with elevator doors placed on both opposite side walls.
 */
export function createLiftLobby(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.12;
  const wallHeight = 2.6;

  // 1. Tile floor
  const floorPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(wM - 0.05, hM - 0.05),
    materials.floorTile
  );
  floorPlate.rotation.x = -Math.PI / 2;
  floorPlate.position.set(cx, 0.012, cz);
  group.add(floorPlate);

  // 2. East & West solid walls (North & South corridor ends remain completely open)
  const wallW = new THREE.Mesh(boxGeom, materials.wallNormal);
  wallW.scale.set(wt, wallHeight, hM);
  wallW.position.set(cx - wM / 2, wallHeight / 2, cz);
  group.add(wallW);

  const wallE = new THREE.Mesh(boxGeom, materials.wallNormal);
  wallE.scale.set(wt, wallHeight, hM);
  wallE.position.set(cx + wM / 2, wallHeight / 2, cz);
  group.add(wallE);

  // 3. Multi-door elevator setup on both opposite walls
  const zOffsets = hM > 3.5 ? [-hM / 4, hM / 4] : [0];
  const doorWidth = 1.3;
  const doorHeight = 2.1;

  const addLobbyElevator = (xOffset, zOffset, isWestSide) => {
    const liftDoorGroup = new THREE.Group();
    const dirX = isWestSide ? 1 : -1;
    
    // Position sat on the wall surface
    liftDoorGroup.position.set(cx + xOffset + dirX * 0.015, 0, cz + zOffset);
    liftDoorGroup.rotation.y = isWestSide ? Math.PI / 2 : -Math.PI / 2;

    // Sliding metal doors
    const doorL = new THREE.Mesh(boxGeom, materials.metalSilver);
    doorL.scale.set(0.02, doorHeight, doorWidth / 2);
    doorL.position.set(0, doorHeight / 2, -doorWidth / 4);
    liftDoorGroup.add(doorL);

    const doorR = new THREE.Mesh(boxGeom, materials.metalSilver);
    doorR.scale.set(0.02, doorHeight, doorWidth / 2);
    doorR.position.set(0, doorHeight / 2, doorWidth / 4);
    liftDoorGroup.add(doorR);

    // Center seam
    const seam = new THREE.Mesh(boxGeom, materials.metalDark);
    seam.scale.set(0.022, doorHeight, 0.015);
    seam.position.set(0, doorHeight / 2, 0);
    liftDoorGroup.add(seam);

    // Trim frame
    const frameL = new THREE.Mesh(boxGeom, materials.metalDark);
    frameL.scale.set(0.04, doorHeight + 0.06, 0.05);
    frameL.position.set(-0.01, doorHeight / 2 + 0.03, -doorWidth / 2 - 0.025);
    liftDoorGroup.add(frameL);

    const frameR = new THREE.Mesh(boxGeom, materials.metalDark);
    frameR.scale.set(0.04, doorHeight + 0.06, 0.05);
    frameR.position.set(-0.01, doorHeight / 2 + 0.03, doorWidth / 2 + 0.025);
    liftDoorGroup.add(frameR);

    const frameT = new THREE.Mesh(boxGeom, materials.metalDark);
    frameT.scale.set(0.04, 0.05, doorWidth + 0.1);
    frameT.position.set(-0.01, doorHeight + 0.025, 0);
    liftDoorGroup.add(frameT);

    // Display indicator
    const indicator = new THREE.Group();
    indicator.position.set(-0.02, doorHeight + 0.22, 0);
    const ipPlate = new THREE.Mesh(boxGeom, materials.metalDark);
    ipPlate.scale.set(0.015, 0.12, 0.35);
    indicator.add(ipPlate);
    const ipLed = new THREE.Mesh(boxGeom, materials.rackLedGreen);
    ipLed.scale.set(0.02, 0.06, 0.25);
    ipLed.position.set(-0.005, 0, 0);
    indicator.add(ipLed);
    liftDoorGroup.add(indicator);

    // Lobby Call buttons
    const callButtons = new THREE.Group();
    callButtons.position.set(-0.015, 1.25, doorWidth / 2 + 0.18);
    const cbPlate = new THREE.Mesh(boxGeom, materials.metalDark);
    cbPlate.scale.set(0.015, 0.22, 0.08);
    callButtons.add(cbPlate);
    const btnUp = new THREE.Mesh(cylGeom, materials.metalSilver);
    btnUp.scale.set(0.02, 0.03, 0.02);
    btnUp.rotation.z = Math.PI / 2;
    btnUp.position.set(-0.01, 0.05, 0);
    callButtons.add(btnUp);
    liftDoorGroup.add(callButtons);

    group.add(liftDoorGroup);
  };

  zOffsets.forEach(zo => {
    addLobbyElevator(-wM / 2, zo, true);   // Left (West) wall
    addLobbyElevator(wM / 2, zo, false);   // Right (East) wall
  });

  return group;
}
