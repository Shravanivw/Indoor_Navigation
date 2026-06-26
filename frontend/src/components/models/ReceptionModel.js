import * as THREE from "three";

export function createReception(cx, cz, wM, hM, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  // 1. Polished tile floor zone
  const floorPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(wM - 0.05, hM - 0.05),
    materials.floorTile
  );
  floorPlate.rotation.x = -Math.PI / 2;
  floorPlate.position.set(cx, 0.012, cz);
  group.add(floorPlate);

  // 2. Decorative Wood Slat Accent Wall (placed at the North side of reception as a backdrop)
  const backdropH = 2.6;
  const backdropW = Math.min(wM * 0.75, 4.5);
  const backdropZ = cz - hM / 2 + 0.15;
  const backdropGroup = new THREE.Group();
  backdropGroup.position.set(cx, 0, backdropZ);

  // Core backing wall
  const backPanel = new THREE.Mesh(boxGeom, materials.wallNormal);
  backPanel.scale.set(backdropW, backdropH, 0.1);
  backPanel.position.y = backdropH / 2;
  backdropGroup.add(backPanel);

  // Wooden vertical slats
  const numSlats = 24;
  const slatW = 0.06;
  const slatGap = (backdropW - slatW) / (numSlats - 1);
  for (let i = 0; i < numSlats; i++) {
    const slat = new THREE.Mesh(boxGeom, materials.deskWood);
    slat.scale.set(slatW, backdropH, 0.04);
    slat.position.set(-backdropW / 2 + slatW / 2 + i * slatGap, backdropH / 2, 0.06);
    backdropGroup.add(slat);
  }

  // Brand Signboard
  const logoSign = new THREE.Mesh(boxGeom, materials.metalSilver);
  logoSign.scale.set(1.6, 0.5, 0.05);
  logoSign.position.set(0, backdropH * 0.65, 0.1);
  backdropGroup.add(logoSign);

  // Glowing brand backlight text mockup (just a blue box inside sign)
  const brandText = new THREE.Mesh(boxGeom, materials.screenGlow);
  brandText.scale.set(1.4, 0.35, 0.01);
  brandText.position.set(0, backdropH * 0.65, 0.13);
  backdropGroup.add(brandText);

  group.add(backdropGroup);

  // 3. Curved Reception Counter
  // Positioned in front of the backdrop (zOffset ~ +1.0m from backdrop)
  const counterGroup = new THREE.Group();
  counterGroup.position.set(cx, 0, backdropZ + 1.25);

  const counterW = Math.min(backdropW * 0.9, 3.2);
  const counterH = 1.05;
  const counterD = 0.65;

  // Center counter box
  const centerCounter = new THREE.Mesh(boxGeom, materials.cushionLounge); // Deep blue paint finish
  centerCounter.scale.set(counterW, counterH, counterD);
  centerCounter.position.y = counterH / 2;
  counterGroup.add(centerCounter);

  // Wooden counter ledge top
  const ledge = new THREE.Mesh(boxGeom, materials.deskWood);
  ledge.scale.set(counterW + 0.15, 0.06, counterD + 0.1);
  ledge.position.set(0, counterH + 0.03, 0.02);
  counterGroup.add(ledge);

  // Task chair behind counter
  const taskChair = new THREE.Group();
  taskChair.position.set(0, 0, -0.55); // behind counter
  const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
  seat.scale.set(0.42, 0.06, 0.42);
  seat.position.y = 0.5;
  taskChair.add(seat);
  const back = new THREE.Mesh(boxGeom, materials.chairFabric);
  back.scale.set(0.38, 0.35, 0.05);
  back.position.set(0, 0.78, -0.15);
  taskChair.add(back);
  const stand = new THREE.Mesh(cylGeom, materials.chairBase);
  stand.scale.set(0.05, 0.5, 0.05);
  stand.position.y = 0.25;
  taskChair.add(stand);
  counterGroup.add(taskChair);

  // Monitor on reception desk
  const monitor = new THREE.Mesh(boxGeom, materials.metalDark);
  monitor.scale.set(0.4, 0.28, 0.25);
  monitor.position.set(-0.5, counterH + 0.15, 0);
  counterGroup.add(monitor);

  group.add(counterGroup);

  // 4. Waiting Lounge Seating Area
  // Place this towards the front-left or front-right of the lobby (e.g. local zOffset ~ +1.0m to 2.5m)
  const loungeGroup = new THREE.Group();
  loungeGroup.position.set(cx - wM / 4, 0, cz + hM / 6);

  // Accent rug
  const loungeRug = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.8),
    materials.floorCarpet
  );
  loungeRug.rotation.x = -Math.PI / 2;
  loungeRug.position.set(0, 0.015, 0);
  loungeGroup.add(loungeRug);

  // Sofa (3-seater lounge)
  const sofa = new THREE.Group();
  sofa.position.set(0, 0, -0.5);
  // Base
  const sBase = new THREE.Mesh(boxGeom, materials.chairFabric);
  sBase.scale.set(1.5, 0.22, 0.65);
  sBase.position.y = 0.2;
  sofa.add(sBase);
  // Cushions
  const sSeat = new THREE.Mesh(boxGeom, materials.cushionLounge);
  sSeat.scale.set(1.4, 0.1, 0.55);
  sSeat.position.set(0, 0.35, -0.02);
  sofa.add(sSeat);
  // Backrest
  const sBack = new THREE.Mesh(boxGeom, materials.chairFabric);
  sBack.scale.set(1.5, 0.52, 0.15);
  sBack.position.set(0, 0.6, -0.28);
  sofa.add(sBack);
  // Left armrest
  const sArmL = new THREE.Mesh(boxGeom, materials.chairFabric);
  sArmL.scale.set(0.12, 0.44, 0.65);
  sArmL.position.set(-0.72, 0.32, 0);
  sofa.add(sArmL);
  // Right armrest
  const sArmR = new THREE.Mesh(boxGeom, materials.chairFabric);
  sArmR.scale.set(0.12, 0.44, 0.65);
  sArmR.position.set(0.72, 0.32, 0);
  sofa.add(sArmR);
  loungeGroup.add(sofa);

  // Low Coffee Table in front of Sofa
  const coffeeTable = new THREE.Group();
  coffeeTable.position.set(0, 0, 0.3);
  // Wooden top
  const ctTop = new THREE.Mesh(boxGeom, materials.deskWood);
  ctTop.scale.set(0.8, 0.04, 0.5);
  ctTop.position.y = 0.38;
  coffeeTable.add(ctTop);
  // Legs
  for (const [lx, lz] of [[0.3, 0.18], [-0.3, 0.18], [0.3, -0.18], [-0.3, -0.18]]) {
    const leg = new THREE.Mesh(cylGeom, materials.metalSilver);
    leg.scale.set(0.03, 0.36, 0.03);
    leg.position.set(lx, 0.18, lz);
    coffeeTable.add(leg);
  }
  loungeGroup.add(coffeeTable);

  group.add(loungeGroup);

  // 5. Planter Box / Plant in the opposite corner
  const planter = new THREE.Group();
  planter.position.set(cx + wM / 3.2, 0, cz + hM / 4);

  const pot = new THREE.Mesh(boxGeom, materials.plantPot);
  pot.scale.set(0.5, 0.5, 0.5);
  pot.position.y = 0.25;
  planter.add(pot);

  // Green bushes
  for (const p of [
    { x: 0, y: 0.6, z: 0, s: 0.45 },
    { x: 0.15, y: 0.75, z: 0.05, s: 0.35 },
    { x: -0.15, y: 0.78, z: -0.05, s: 0.32 },
    { x: -0.05, y: 0.9, z: 0.15, s: 0.28 }
  ]) {
    const foliage = new THREE.Mesh(geometries.sphere, materials.plantLeaves);
    foliage.scale.set(p.s, p.s * 1.2, p.s);
    foliage.position.set(p.x, p.y, p.z);
    planter.add(foliage);
  }
  group.add(planter);

  return group;
}
