import * as THREE from "three";
import { createRoomWalls } from "./ModelShared";

export function createLift(cx, cz, wM, hM, isDest, isUser, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.15;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Build three solid enclosure walls (North, East, West) representing the elevator shaft
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

  // 2. Front (South) Wall: Elevator Lobby Face
  // Has metallic elevator doors at the center.
  const doorWidth = 1.3;
  const doorHeight = 2.1;
  const sZ = cz + hM / 2;

  // South Wall Left Segment
  const segW = (wM - doorWidth) / 2;
  if (segW > 0.05) {
    const wallSL = new THREE.Mesh(boxGeom, wallMat);
    wallSL.scale.set(segW, wallHeight, wt);
    wallSL.position.set(cx - wM / 2 + segW / 2, wallHeight / 2, sZ);
    group.add(wallSL);

    const wallSR = new THREE.Mesh(boxGeom, wallMat);
    wallSR.scale.set(segW, wallHeight, wt);
    wallSR.position.set(cx + wM / 2 - segW / 2, wallHeight / 2, sZ);
    group.add(wallSR);
  }

  // Header above lift doors
  const headerH = wallHeight - doorHeight;
  if (headerH > 0.05) {
    const header = new THREE.Mesh(boxGeom, wallMat);
    header.scale.set(doorWidth, headerH, wt);
    header.position.set(cx, doorHeight + headerH / 2, sZ);
    group.add(header);
  }

  // 3. Elevator Doors (Double-sliding brushed silver metal panels)
  const liftDoorGroup = new THREE.Group();
  liftDoorGroup.position.set(cx, 0, sZ + 0.01); // slightly forward to avoid z-fighting

  // Left sliding door panel
  const doorL = new THREE.Mesh(boxGeom, materials.metalSilver);
  doorL.scale.set(doorWidth / 2, doorHeight, 0.03);
  doorL.position.set(-doorWidth / 4, doorHeight / 2, 0);
  liftDoorGroup.add(doorL);

  // Right sliding door panel
  const doorR = new THREE.Mesh(boxGeom, materials.metalSilver);
  doorR.scale.set(doorWidth / 2, doorHeight, 0.03);
  doorR.position.set(doorWidth / 4, doorHeight / 2, 0);
  liftDoorGroup.add(doorR);

  // Vertical center groove seam line
  const seam = new THREE.Mesh(boxGeom, materials.metalDark);
  seam.scale.set(0.015, doorHeight, 0.032);
  seam.position.set(0, doorHeight / 2, 0);
  liftDoorGroup.add(seam);

  // Metal outer door frame architrave
  const frameL = new THREE.Mesh(boxGeom, materials.metalDark);
  frameL.scale.set(0.06, doorHeight + 0.06, 0.05);
  frameL.position.set(-doorWidth / 2 - 0.03, doorHeight / 2 + 0.03, -0.01);
  liftDoorGroup.add(frameL);

  const frameR = new THREE.Mesh(boxGeom, materials.metalDark);
  frameR.scale.set(0.06, doorHeight + 0.06, 0.05);
  frameR.position.set(doorWidth / 2 + 0.03, doorHeight / 2 + 0.03, -0.01);
  liftDoorGroup.add(frameR);

  const frameT = new THREE.Mesh(boxGeom, materials.metalDark);
  frameT.scale.set(doorWidth + 0.12, 0.06, 0.05);
  frameT.position.set(0, doorHeight + 0.03, -0.01);
  liftDoorGroup.add(frameT);

  // 4. Floor Indicator Panel (glowing screen above elevator doors)
  const indicator = new THREE.Group();
  indicator.position.set(0, doorHeight + 0.22, 0.025);
  // Panel plate
  const ipPlate = new THREE.Mesh(boxGeom, materials.metalDark);
  ipPlate.scale.set(0.35, 0.12, 0.02);
  indicator.add(ipPlate);
  // LED screen glowing green/red display (mocking "5" or "L")
  const ipLed = new THREE.Mesh(boxGeom, materials.rackLedGreen);
  ipLed.scale.set(0.25, 0.06, 0.005);
  ipLed.position.set(0, 0, 0.012);
  indicator.add(ipLed);

  liftDoorGroup.add(indicator);

  // 5. Lobby Call Buttons Panel (mounted next to the door on the wall)
  const callButtons = new THREE.Group();
  callButtons.position.set(doorWidth / 2 + 0.18, 1.25, 0.015);
  // Button backing plate
  const cbPlate = new THREE.Mesh(boxGeom, materials.metalDark);
  cbPlate.scale.set(0.08, 0.22, 0.015);
  callButtons.add(cbPlate);
  // Up button (glowing green/white point)
  const btnUp = new THREE.Mesh(cylGeom, materials.metalSilver);
  btnUp.scale.set(0.03, 0.02, 0.03);
  btnUp.rotation.x = Math.PI / 2;
  btnUp.position.set(0, 0.05, 0.01);
  callButtons.add(btnUp);
  // Down button
  const btnDown = new THREE.Mesh(cylGeom, materials.metalSilver);
  btnDown.scale.set(0.03, 0.02, 0.03);
  btnDown.rotation.x = Math.PI / 2;
  btnDown.position.set(0, -0.05, 0.01);
  callButtons.add(btnDown);

  liftDoorGroup.add(callButtons);

  group.add(liftDoorGroup);

  return group;
}
