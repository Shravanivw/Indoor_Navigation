import * as THREE from "three";
import { createPolygonWalls, findCorridorSegmentIndex } from "./ModelShared";

export function createBooth(polygon, cx, cz, wM, hM, isPhoneBooth, isDest, isUser, resources, toWorld, grid, isSittingArea1 = false) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.12;
  const wallHeight = 3.0;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Find corridor segment index to omit it (creating the open alcove opening)
  const doorIndex = findCorridorSegmentIndex(polygon, grid);

  // 2. Build walls based on booth type
  if (isSittingArea1) {
    // Custom wall setup: West wall, East wall, Center divider wall (running North-South)
    const wallL = new THREE.Mesh(boxGeom, wallMat);
    wallL.scale.set(wt, wallHeight, hM);
    wallL.position.set(cx - wM / 2, wallHeight / 2, cz);
    group.add(wallL);

    const wallR = new THREE.Mesh(boxGeom, wallMat);
    wallR.scale.set(wt, wallHeight, hM);
    wallR.position.set(cx + wM / 2, wallHeight / 2, cz);
    group.add(wallR);

    const wallC = new THREE.Mesh(boxGeom, wallMat);
    wallC.scale.set(wt, wallHeight, hM);
    wallC.position.set(cx, wallHeight / 2, cz);
    group.add(wallC);

    // Back wall (South wall)
    const wallB = new THREE.Mesh(boxGeom, wallMat);
    wallB.scale.set(wM, wallHeight, wt);
    wallB.position.set(cx, wallHeight / 2, cz + hM / 2); // South wall is the back wall
    group.add(wallB);

    // Front wall (North wall) with two alcove openings:
    // Layout: [Left wall segment] [Alcove 1] [Middle wall segment] [Alcove 2] [Right wall segment]
    const aw = wM * 0.32; // Width of each alcove opening (about 32% of total width)

    // Left front wall segment: from (cx - wM / 2) to (cx - wM / 4 - aw / 2)
    const wLeftSeg = wM / 4 - aw / 2;
    if (wLeftSeg > 0.05) {
      const wallFLeft = new THREE.Mesh(boxGeom, wallMat);
      wallFLeft.scale.set(wLeftSeg, wallHeight, wt);
      wallFLeft.position.set(cx - 3 * wM / 8 - aw / 4, wallHeight / 2, cz - hM / 2);
      group.add(wallFLeft);
    }

    // Middle front wall segment: from (cx - wM / 4 + aw / 2) to (cx + wM / 4 - aw / 2)
    const wMidSeg = wM / 2 - aw;
    if (wMidSeg > 0.05) {
      const wallFMid = new THREE.Mesh(boxGeom, wallMat);
      wallFMid.scale.set(wMidSeg, wallHeight, wt);
      wallFMid.position.set(cx, wallHeight / 2, cz - hM / 2);
      group.add(wallFMid);
    }

    // Right front wall segment: from (cx + wM / 4 + aw / 2) to (cx + wM / 2)
    const wRightSeg = wM / 4 - aw / 2;
    if (wRightSeg > 0.05) {
      const wallFRight = new THREE.Mesh(boxGeom, wallMat);
      wallFRight.scale.set(wRightSeg, wallHeight, wt);
      wallFRight.position.set(cx + 3 * wM / 8 + aw / 4, wallHeight / 2, cz - hM / 2);
      group.add(wallFRight);
    }
  } else if (isPhoneBooth) {
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

  } else if (isSittingArea1) {
    // ── CUSTOM SITTING AREA 1 (TWO ALCOVES WITH SINGLE SEATS & CIRCULAR TABLES) ──
    const leftCX = cx - wM / 4;
    const rightCX = cx + wM / 4;

    const createCafeStool = (sx, sz, rotY) => {
      const chair = new THREE.Group();
      chair.position.set(sx, 0, sz);
      chair.rotation.y = rotY;

      // Base
      const base = new THREE.Mesh(boxGeom, materials.chairBase);
      base.scale.set(0.32, 0.02, 0.32);
      base.position.y = 0.05;
      chair.add(base);

      // Shaft
      const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
      shaft.scale.set(0.03, 0.36, 0.03);
      shaft.position.y = 0.23;
      chair.add(shaft);

      // Seat
      const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
      seat.scale.set(0.36, 0.06, 0.36);
      seat.position.y = 0.43;
      chair.add(seat);

      // Backrest
      const back = new THREE.Mesh(boxGeom, materials.chairFabric);
      back.scale.set(0.34, 0.38, 0.05);
      back.position.set(0, 0.63, 0.155);
      chair.add(back);

      return chair;
    };

    const addTableAndChair = (alcoveCX) => {
      // Circular table placed slightly towards the open North side
      const tblTop = new THREE.Mesh(cylGeom, materials.deskWood);
      tblTop.scale.set(0.65, 0.03, 0.65);
      tblTop.position.set(alcoveCX, 0.65, cz - hM / 6);
      group.add(tblTop);

      const tblShaft = new THREE.Mesh(cylGeom, materials.metalSilver);
      tblShaft.scale.set(0.05, 0.63, 0.05);
      tblShaft.position.set(alcoveCX, 0.315, cz - hM / 6);
      group.add(tblShaft);

      const tblBase = new THREE.Mesh(cylGeom, materials.metalDark);
      tblBase.scale.set(0.35, 0.02, 0.35);
      tblBase.position.set(alcoveCX, 0.01, cz - hM / 6);
      group.add(tblBase);

      // Stool placed at the back South side of the alcove facing North (outwards, rotY = 0)
      group.add(createCafeStool(alcoveCX, cz + hM / 4, 0));
    };

    // Build alcoves 1 and 2
    addTableAndChair(leftCX);
    addTableAndChair(rightCX);

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
