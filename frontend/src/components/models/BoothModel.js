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

  // 2. Build 3-sided polygon walls (omitting the corridor-facing segment)
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
    if (hM > wM && hM >= 1.6) {
      const seatW = 0.45;
      const seatL = hM - 0.2;
      const seatY = 0.45;

      const seatLGroup = new THREE.Group();
      seatLGroup.position.set(cx - wM / 2 + seatW / 2 + 0.05, 0, cz);
      const sLBase = new THREE.Mesh(boxGeom, materials.chairFabric);
      sLBase.scale.set(seatW, seatY, seatL);
      sLBase.position.y = seatY / 2;
      seatLGroup.add(sLBase);
      const sLBack = new THREE.Mesh(boxGeom, materials.chairFabric);
      sLBack.scale.set(0.08, 0.8, seatL);
      sLBack.position.set(-seatW / 2 + 0.04, 0.75, 0);
      seatLGroup.add(sLBack);
      group.add(seatLGroup);

      const seatRGroup = new THREE.Group();
      seatRGroup.position.set(cx + wM / 2 - seatW / 2 - 0.05, 0, cz);
      const sRBase = new THREE.Mesh(boxGeom, materials.chairFabric);
      sRBase.scale.set(seatW, seatY, seatL);
      sRBase.position.y = seatY / 2;
      seatRGroup.add(sRBase);
      const sRBack = new THREE.Mesh(boxGeom, materials.chairFabric);
      sRBack.scale.set(0.08, 0.8, seatL);
      sRBack.position.set(seatW / 2 - 0.04, 0.75, 0);
      seatRGroup.add(sRBack);
      group.add(seatRGroup);

      const tblW = wM - seatW * 2 - 0.3;
      if (tblW > 0.3) {
        const table = new THREE.Group();
        table.position.set(cx, 0, cz);
        const top = new THREE.Mesh(boxGeom, materials.deskWood);
        top.scale.set(tblW, 0.04, seatL - 0.1);
        top.position.y = 0.73;
        table.add(top);
        const leg = new THREE.Mesh(cylGeom, materials.metalDark);
        leg.scale.set(0.06, 0.71, 0.06);
        leg.position.y = 0.355;
        table.add(leg);
        const base = new THREE.Mesh(boxGeom, materials.metalDark);
        base.scale.set(tblW * 0.8, 0.02, 0.35);
        base.position.y = 0.01;
        table.add(base);

        group.add(table);
      }

    } else {
      const sofaW = wM - 0.2;
      const sofaD = Math.min(0.55, hM - 0.3);
      const sofaH = 0.44;

      if (sofaD > 0.15) {
        const sofa = new THREE.Group();
        sofa.position.set(cx, 0, cz - hM / 2 + sofaD / 2 + 0.1);

        const seat = new THREE.Mesh(boxGeom, materials.cushionLounge);
        seat.scale.set(sofaW, sofaH, sofaD);
        seat.position.y = sofaH / 2;
        sofa.add(seat);

        const back = new THREE.Mesh(boxGeom, materials.cushionLounge);
        back.scale.set(sofaW, 0.55, 0.1);
        back.position.set(0, sofaH + 0.275, -sofaD / 2 + 0.05);
        sofa.add(back);

        const armL = new THREE.Mesh(boxGeom, materials.cushionLounge);
        armL.scale.set(0.1, sofaH + 0.15, sofaD);
        armL.position.set(-sofaW / 2 + 0.05, (sofaH + 0.15) / 2, 0);
        sofa.add(armL);

        const armR = new THREE.Mesh(boxGeom, materials.cushionLounge);
        armR.scale.set(0.1, sofaH + 0.15, sofaD);
        armR.position.set(sofaW / 2 - 0.05, (sofaH + 0.15) / 2, 0);
        sofa.add(armR);

        group.add(sofa);

        const coffeeTableZ = cz + hM / 4;
        if (cz + hM / 2 - coffeeTableZ > 0.3 && sofaW > 0.8) {
          const ct = new THREE.Group();
          ct.position.set(cx, 0, coffeeTableZ);
          const ctTop = new THREE.Mesh(boxGeom, materials.deskWood);
          ctTop.scale.set(0.5, 0.03, 0.4);
          ctTop.position.y = 0.38;
          ct.add(ctTop);
          const ctLeg = new THREE.Mesh(cylGeom, materials.metalSilver);
          ctLeg.scale.set(0.04, 0.36, 0.04);
          ctLeg.position.y = 0.18;
          ct.add(ctLeg);
          const ctBase = new THREE.Mesh(cylGeom, materials.metalDark);
          ctBase.scale.set(0.3, 0.015, 0.3);
          ctBase.position.y = 0.01;
          ct.add(ctBase);

          group.add(ct);
        }
      }
    }
  }

  return group;
}
