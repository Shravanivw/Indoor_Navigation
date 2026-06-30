import * as THREE from "three";
import { createPolygonWalls, findCorridorSegmentIndex } from "./ModelShared";

export function createMeetingRoom(polygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, grid, glassWalls = false) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Draw polygon walls using the corridor-facing segment as glass partition
  const doorIndex = findCorridorSegmentIndex(polygon, grid);
  group.add(
    createPolygonWalls({
      polygon,
      wallHeight: 3.0,
      wallThickness: 0.12,
      material: wallMat,
      doorSegmentIndex: doorIndex,
      glassDoor: true, // glass partition on the corridor wall
      glassWalls,
      resources,
      toWorld
    })
  );

  // 2. Table base rug
  const tableW = Math.max(1.2, Math.min(wM * 0.62, 4.2));
  const tableD = Math.max(0.7, Math.min(hM * 0.42, 1.8));

  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(tableW + 1.2, tableD + 1.2),
    materials.floorCarpet
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(cx, 0.015, cz);
  group.add(rug);

  // 3. Conference Table
  const tableTop = new THREE.Mesh(boxGeom, materials.deskWood);
  tableTop.scale.set(tableW, 0.05, tableD);
  tableTop.position.set(cx, 0.75, cz);
  group.add(tableTop);

  // Table base drums
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
  const chairSpacing = 0.65;
  const numChairsPerSide = Math.max(1, Math.floor(tableW / chairSpacing));
  const chairStartX = cx - ((numChairsPerSide - 1) * chairSpacing) / 2;

  const createMeetingChair = (chX, chZ, rotY) => {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(chX, 0, chZ);
    chairGroup.rotation.y = rotY;

    // Pedestal
    const base = new THREE.Mesh(boxGeom, materials.chairBase);
    base.scale.set(0.38, 0.02, 0.38);
    base.position.y = 0.05;
    chairGroup.add(base);

    const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
    shaft.scale.set(0.04, 0.36, 0.04);
    shaft.position.y = 0.23;
    chairGroup.add(shaft);

    const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
    seat.scale.set(0.44, 0.08, 0.42);
    seat.position.y = 0.45;
    chairGroup.add(seat);

    const back = new THREE.Mesh(boxGeom, materials.chairFabric);
    back.scale.set(0.4, 0.5, 0.06);
    back.position.set(0, 0.76, 0.18);
    chairGroup.add(back);

    return chairGroup;
  };

  for (let i = 0; i < numChairsPerSide; i++) {
    const x = chairStartX + i * chairSpacing;
    group.add(createMeetingChair(x, cz - tableD / 2 - 0.32, Math.PI));
    group.add(createMeetingChair(x, cz + tableD / 2 + 0.32, 0));
  }

  if (tableW > 2.2) {
    group.add(createMeetingChair(cx + tableW / 2 + 0.32, cz, -Math.PI / 2));
    group.add(createMeetingChair(cx - tableW / 2 - 0.32, cz, Math.PI / 2));
  }

  // 5. TV Display mounted on the walls (we place it centered facing the table)
  const tvGroup = new THREE.Group();
  tvGroup.position.set(cx, 1.4, cz - tableD / 2 - 0.85); // Float near the table top side
  const tvBezel = new THREE.Mesh(boxGeom, materials.metalDark);
  tvBezel.scale.set(1.2, 0.7, 0.04);
  tvGroup.add(tvBezel);
  const tvScreen = new THREE.Mesh(boxGeom, materials.screenGlow);
  tvScreen.scale.set(1.15, 0.65, 0.005);
  tvScreen.position.z = 0.022;
  tvGroup.add(tvScreen);
  group.add(tvGroup);

  return group;
}
