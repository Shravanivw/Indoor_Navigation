import * as THREE from "three";

export function createPantry(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  // 1. Parquet wooden floor plate
  const floorPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(wM - 0.05, hM - 0.05),
    materials.floorWood
  );
  floorPlate.rotation.x = -Math.PI / 2;
  floorPlate.position.set(cx, 0.012, cz);
  group.add(floorPlate);

  // 2. Kitchen Counter cabinet (along the North wall of the pantry area)
  const counterGroup = new THREE.Group();
  const counterW = Math.min(wM * 0.8, 3.8);
  const counterH = 0.9;
  const counterD = 0.6;
  const counterZ = cz - hM / 2 + counterD / 2 + 0.15;
  counterGroup.position.set(cx, 0, counterZ);

  // Cabinet base (wood finish)
  const cabinet = new THREE.Mesh(boxGeom, materials.deskWood);
  cabinet.scale.set(counterW, counterH, counterD);
  cabinet.position.y = counterH / 2;
  counterGroup.add(cabinet);

  // Countertop (marble/white laminate)
  const countertop = new THREE.Mesh(boxGeom, materials.deskSurface);
  countertop.scale.set(counterW + 0.04, 0.04, counterD + 0.04);
  countertop.position.y = counterH + 0.02;
  counterGroup.add(countertop);

  // Sink cutout & faucet details
  const sink = new THREE.Mesh(boxGeom, materials.metalSilver);
  sink.scale.set(0.6, 0.01, 0.4);
  sink.position.set(-counterW / 4, counterH + 0.045, 0);
  counterGroup.add(sink);

  // Faucet (drawn as box pipe)
  const faucet = new THREE.Mesh(boxGeom, materials.metalSilver);
  faucet.scale.set(0.04, 0.22, 0.12);
  faucet.position.set(-counterW / 4, counterH + 0.15, -0.15);
  counterGroup.add(faucet);

  // Coffee machine prop (black box on counter)
  const coffeeMachine = new THREE.Group();
  coffeeMachine.position.set(counterW / 4, counterH + 0.22, 0);
  const cmBody = new THREE.Mesh(boxGeom, materials.metalDark);
  cmBody.scale.set(0.4, 0.4, 0.35);
  coffeeMachine.add(cmBody);
  const cmCup = new THREE.Mesh(cylGeom, materials.metalSilver);
  cmCup.scale.set(0.08, 0.12, 0.08);
  cmCup.position.set(0, -0.14, 0.1);
  coffeeMachine.add(cmCup);
  counterGroup.add(coffeeMachine);

  group.add(counterGroup);

  // 3. Refrigerator (tall metallic double-door fridge next to counter)
  const fridge = new THREE.Group();
  fridge.position.set(cx - counterW / 2 - 0.55, 0, counterZ);
  // Main body
  const fBody = new THREE.Mesh(boxGeom, materials.metalSilver);
  fBody.scale.set(0.8, 1.8, 0.75);
  fBody.position.y = 0.9;
  fridge.add(fBody);
  // Door seam line (thin dark line)
  const fSeam = new THREE.Mesh(boxGeom, materials.metalDark);
  fSeam.scale.set(0.01, 1.76, 0.01);
  fSeam.position.set(0, 0.9, 0.38);
  fridge.add(fSeam);
  // Handles
  const handleL = new THREE.Mesh(boxGeom, materials.metalDark);
  handleL.scale.set(0.03, 0.4, 0.03);
  handleL.position.set(-0.06, 1.1, 0.4);
  fridge.add(handleL);
  const handleR = new THREE.Mesh(boxGeom, materials.metalDark);
  handleR.scale.set(0.03, 0.4, 0.03);
  handleR.position.set(0.06, 1.1, 0.4);
  fridge.add(handleR);

  group.add(fridge);

  // 4. Dining Tables and Cafe Chairs (spaced out in front of the kitchen zone)
  const tableRowZ = cz + hM / 6;
  const tableSpace = 1.8;

  // Let's draw 2 tables if space permits
  const numTables = Math.max(1, Math.floor((wM - 1.2) / tableSpace));
  const startTableX = cx - ((numTables - 1) * tableSpace) / 2;

  const createDiningTableSetup = (tX, tZ) => {
    const tableSetup = new THREE.Group();
    tableSetup.position.set(tX, 0, tZ);

    // Round Dining Table
    const tableTop = new THREE.Mesh(cylGeom, materials.deskWood);
    tableTop.scale.set(0.9, 0.04, 0.9); // cylinder scale sets radius
    tableTop.position.y = 0.75;
    tableSetup.add(tableTop);

    const tableShaft = new THREE.Mesh(cylGeom, materials.metalSilver);
    tableShaft.scale.set(0.08, 0.73, 0.08);
    tableShaft.position.y = 0.365;
    tableSetup.add(tableShaft);

    const tableBase = new THREE.Mesh(cylGeom, materials.metalDark);
    tableBase.scale.set(0.45, 0.02, 0.45);
    tableBase.position.y = 0.01;
    tableSetup.add(tableBase);

    // Cafe Chairs (4 chairs around the table)
    const createCafeChair = (rad, angle) => {
      const chairGroup = new THREE.Group();
      chairGroup.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
      chairGroup.rotation.y = -angle - Math.PI / 2; // facing table center

      // Frame legs
      const leg1 = new THREE.Mesh(cylGeom, materials.metalSilver);
      leg1.scale.set(0.025, 0.44, 0.025);
      leg1.position.set(-0.15, 0.22, -0.15);
      chairGroup.add(leg1);
      const leg2 = new THREE.Mesh(cylGeom, materials.metalSilver);
      leg2.scale.set(0.025, 0.44, 0.025);
      leg2.position.set(0.15, 0.22, -0.15);
      chairGroup.add(leg2);
      const leg3 = new THREE.Mesh(cylGeom, materials.metalSilver);
      leg3.scale.set(0.025, 0.44, 0.025);
      leg3.position.set(-0.15, 0.22, 0.15);
      chairGroup.add(leg3);
      const leg4 = new THREE.Mesh(cylGeom, materials.metalSilver);
      leg4.scale.set(0.025, 0.44, 0.025);
      leg4.position.set(0.15, 0.22, 0.15);
      chairGroup.add(leg4);

      // Seat shell (fabric/colored plastic)
      const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
      seat.scale.set(0.36, 0.04, 0.36);
      seat.position.y = 0.44;
      chairGroup.add(seat);

      // Simple backrest
      const back = new THREE.Mesh(boxGeom, materials.chairFabric);
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
    group.add(createDiningTableSetup(startTableX + i * tableSpace, tableRowZ));
  }

  return group;
}
