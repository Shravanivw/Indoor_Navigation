import * as THREE from "three";
import { createPolygonWalls, findCorridorSegmentIndex } from "./ModelShared";

export function createBooth(polygon, cx, cz, wM, hM, isPhoneBooth, isDest, isUser, resources, toWorld, grid) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.12;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Find corridor segment index to omit it (creating the open alcove opening)
  const doorIndex = findCorridorSegmentIndex(polygon, grid);

  // 2. Build 3-sided polygon walls (only for phone booths! Sitting booths have NO walls)
  if (isPhoneBooth) {
    group.add(
      createPolygonWalls({
        polygon,
        wallHeight,
        wallThickness: wt,
        material: wallMat,
        omitSegmentIndex: doorIndex,
        resources,
        toWorld
      })
    );
  }

  // 3. Add custom carpet floor plate inside
  const floorPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(wM - 0.04, hM - 0.04),
    materials.floorCarpet
  );
  floorPlate.rotation.x = -Math.PI / 2;
  floorPlate.position.set(cx, 0.012, cz);
  group.add(floorPlate);

  // 4. Render interior furniture based on booth type
  if (isPhoneBooth) {
    const shelfW = wM - 0.2;
    const shelfD = Math.min(0.4, hM * 0.45);
    const shelfY = 0.95;

    const shelf = new THREE.Mesh(boxGeom, materials.deskWood);
    shelf.scale.set(shelfW, 0.04, shelfD);
    shelf.position.set(cx, shelfY, cz - hM / 2 + shelfD / 2 + 0.05);
    group.add(shelf);

    const stoolY = 0.55;
    const stool = new THREE.Group();
    stool.position.set(cx, 0, cz + hM / 6);
    const leg = new THREE.Mesh(cylGeom, materials.metalDark);
    leg.scale.set(0.04, stoolY, 0.04);
    leg.position.y = stoolY / 2;
    stool.add(leg);
    const basePlate = new THREE.Mesh(cylGeom, materials.metalDark);
    basePlate.scale.set(0.3, 0.02, 0.3);
    basePlate.position.y = 0.01;
    stool.add(basePlate);
    const seat = new THREE.Mesh(cylGeom, materials.chairFabric);
    seat.scale.set(0.32, 0.06, 0.32);
    seat.position.y = stoolY + 0.03;
    stool.add(seat);

    group.add(stool);

    const notebook = new THREE.Mesh(boxGeom, materials.deskSurface);
    notebook.scale.set(0.28, 0.015, 0.2);
    notebook.position.set(cx, shelfY + 0.025, cz - hM / 2 + shelfD / 2 + 0.05);
    group.add(notebook);

  } else {
    // ── TWO BOOTHS SIDE-BY-SIDE (Diner-style booths) ──
    const numBooths = wM > 3.0 ? 2 : 1;
    const boothW = wM / numBooths;
    
    for (let b = 0; b < numBooths; b++) {
      // Calculate center of this specific booth
      const boothCX = cx - wM / 2 + (b + 0.5) * boothW;

      const seatW = 0.45;
      const seatL = hM - 0.15; // use most of the height/depth
      const seatY = 0.45;

      // Sofa Left (West side of this booth, facing East)
      const seatLGroup = new THREE.Group();
      seatLGroup.position.set(boothCX - boothW / 2 + seatW / 2 + 0.02, 0, cz);
      const sLBase = new THREE.Mesh(boxGeom, materials.chairFabric);
      sLBase.scale.set(seatW, seatY, seatL);
      sLBase.position.y = seatY / 2;
      seatLGroup.add(sLBase);
      const sLBack = new THREE.Mesh(boxGeom, materials.chairFabric);
      sLBack.scale.set(0.06, 0.8, seatL);
      sLBack.position.set(-seatW / 2 + 0.03, 0.75, 0);
      seatLGroup.add(sLBack);
      group.add(seatLGroup);

      // Sofa Right (East side of this booth, facing West)
      const seatRGroup = new THREE.Group();
      seatRGroup.position.set(boothCX + boothW / 2 - seatW / 2 - 0.02, 0, cz);
      const sRBase = new THREE.Mesh(boxGeom, materials.chairFabric);
      sRBase.scale.set(seatW, seatY, seatL);
      sRBase.position.y = seatY / 2;
      seatRGroup.add(sRBase);
      const sRBack = new THREE.Mesh(boxGeom, materials.chairFabric);
      sRBack.scale.set(0.06, 0.8, seatL);
      sRBack.position.set(seatW / 2 - 0.03, 0.75, 0);
      seatRGroup.add(sRBack);
      group.add(seatRGroup);

      // Table in the middle of this booth, running from the back wall
      const tblW = boothW - seatW * 2 - 0.15;
      if (tblW > 0.2) {
        const table = new THREE.Group();
        const tblLen = seatL - 0.1;
        const tblZ = cz - hM / 2 + tblLen / 2 + 0.05;
        table.position.set(boothCX, 0, tblZ);
        
        const top = new THREE.Mesh(boxGeom, materials.deskWood);
        top.scale.set(tblW, 0.04, tblLen);
        top.position.y = 0.73;
        table.add(top);
        
        const leg = new THREE.Mesh(cylGeom, materials.metalDark);
        leg.scale.set(0.05, 0.71, 0.05);
        leg.position.set(0, 0.355, 0);
        table.add(leg);
        
        const base = new THREE.Mesh(boxGeom, materials.metalDark);
        base.scale.set(tblW * 0.7, 0.02, 0.25);
        base.position.set(0, 0.01, 0);
        table.add(base);

        group.add(table);
      }
    }
  }

  return group;
}
