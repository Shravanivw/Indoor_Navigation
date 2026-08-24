import * as THREE from "three";

export function createOfficeDeskCluster(cx, cz, wM, hM, isInnovation, resources, isITBar = false) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;

  const createSofa = (sx, sz, rotY) => {
    const sofa = new THREE.Group();
    sofa.position.set(sx, 0, sz);
    sofa.rotation.y = rotY;

    // Cushion base
    const baseMesh = new THREE.Mesh(boxGeom, materials.cushionLounge);
    baseMesh.scale.set(1.6, 0.3, 0.6);
    baseMesh.position.y = 0.25;
    sofa.add(baseMesh);

    // Backrest
    const backMesh = new THREE.Mesh(boxGeom, materials.cushionLounge);
    backMesh.scale.set(1.6, 0.5, 0.15);
    backMesh.position.set(0, 0.6, 0.225);
    sofa.add(backMesh);

    return sofa;
  };
  const cylGeom = geometries.cylinder;

  // Floor plate decoration (rug/carpet zone for open workspaces)
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(wM - 0.1, hM - 0.1),
    materials.floorCarpet
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(cx, 0.01, cz);
  group.add(rug);

  // Helper to create a single desk setup
  const createDeskSetup = (dx, dz, rotationY) => {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(dx, 0, dz);
    deskGroup.rotation.y = rotationY;

    // 1. Desk top
    const top = new THREE.Mesh(boxGeom, materials.deskSurface);
    top.scale.set(1.2, 0.03, 0.6);
    top.position.y = 0.73;
    deskGroup.add(top);

    // 2. Desk legs (metal frame)
    const legL = new THREE.Mesh(boxGeom, materials.deskLegs);
    legL.scale.set(0.04, 0.71, 0.5);
    legL.position.set(-0.55, 0.355, 0);
    deskGroup.add(legL);

    const legR = new THREE.Mesh(boxGeom, materials.deskLegs);
    legR.scale.set(0.04, 0.71, 0.5);
    legR.position.set(0.55, 0.355, 0);
    deskGroup.add(legR);

    // 3. Monitor
    // Stand
    const stand = new THREE.Mesh(cylGeom, materials.metalDark);
    stand.scale.set(0.06, 0.3, 0.06);
    stand.position.set(0, 0.88, -0.18);
    deskGroup.add(stand);
    // Bezel
    const bezel = new THREE.Mesh(boxGeom, materials.screenBody);
    bezel.scale.set(0.52, 0.32, 0.03);
    bezel.position.set(0, 1.05, -0.18);
    deskGroup.add(bezel);
    // Display screen glow
    const display = new THREE.Mesh(boxGeom, materials.screenGlow);
    display.scale.set(0.5, 0.3, 0.005);
    display.position.set(0, 1.05, -0.162);
    deskGroup.add(display);

    // 4. Keyboard
    const kb = new THREE.Mesh(boxGeom, materials.keyboard);
    kb.scale.set(0.38, 0.015, 0.14);
    kb.position.set(0, 0.75, 0.12);
    deskGroup.add(kb);

    // 5. Office Chair
    const chair = new THREE.Group();
    chair.position.set(0, 0, 0.5); // Placed in front of desk

    // Base star legs
    const base = new THREE.Mesh(boxGeom, materials.chairBase);
    base.scale.set(0.4, 0.02, 0.4);
    base.position.y = 0.05;
    chair.add(base);

    // Center shaft
    const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
    shaft.scale.set(0.04, 0.35, 0.04);
    shaft.position.y = 0.225;
    chair.add(shaft);

    // Seat cushion
    const seat = new THREE.Mesh(boxGeom, materials.chairFabric);
    seat.scale.set(0.42, 0.06, 0.42);
    seat.position.y = 0.43;
    chair.add(seat);

    // Backrest
    const back = new THREE.Mesh(boxGeom, materials.chairFabric);
    back.scale.set(0.38, 0.38, 0.05);
    back.position.set(0, 0.72, 0.19);
    chair.add(back);

    // Armrests
    const armL = new THREE.Mesh(boxGeom, materials.chairBase);
    armL.scale.set(0.04, 0.22, 0.25);
    armL.position.set(-0.23, 0.54, 0.02);
    chair.add(armL);

    const armR = new THREE.Mesh(boxGeom, materials.chairBase);
    armR.scale.set(0.04, 0.22, 0.25);
    armR.position.set(0.23, 0.54, 0.02);
    chair.add(armR);

    deskGroup.add(chair);
    return deskGroup;
  };

  // Generate layouts
  if (isITBar) {
    // ── IT BAR SPECIAL DESIGN (ONE BIG DESK, TWO SOFAS) ──
    const deskGroup = new THREE.Group();
    deskGroup.position.set(cx, 0, cz - 0.8);

    // Big desk top (maple wood)
    const top = new THREE.Mesh(boxGeom, materials.deskWood);
    top.scale.set(2.2, 0.05, 0.9);
    top.position.y = 0.75;
    deskGroup.add(top);

    // Thick legs
    const legW = 0.08;
    for (const [lx, lz] of [
      [2.2 / 2 - 0.1, 0.9 / 2 - 0.1],
      [-2.2 / 2 + 0.1, 0.9 / 2 - 0.1],
      [2.2 / 2 - 0.1, -0.9 / 2 + 0.1],
      [-2.2 / 2 + 0.1, -0.9 / 2 + 0.1]
    ]) {
      const leg = new THREE.Mesh(boxGeom, materials.metalDark);
      leg.scale.set(legW, 0.725, legW);
      leg.position.set(lx, 0.3625, lz);
      deskGroup.add(leg);
    }
    
    // Add a couple of laptop props on the desk to make it look active!
    const laptop = new THREE.Mesh(boxGeom, materials.keyboard);
    laptop.scale.set(0.4, 0.02, 0.25);
    laptop.position.set(-0.4, 0.78, 0);
    deskGroup.add(laptop);

    const laptop2 = new THREE.Mesh(boxGeom, materials.keyboard);
    laptop2.scale.set(0.4, 0.02, 0.25);
    laptop2.position.set(0.4, 0.78, 0);
    deskGroup.add(laptop2);

    group.add(deskGroup);

    // Two comfortable sofas facing each other in front of the IT Bar counter
    group.add(createSofa(cx - 1.5, cz + 0.8, Math.PI / 2));
    group.add(createSofa(cx + 1.5, cz + 0.8, -Math.PI / 2));

  } else if (isInnovation && wM >= 4.5 && hM >= 4.5) {
    // ── INNOVATION / COLLABORATIVE AREA ──
    // Half of the room is desks, the other half is collaborative (rug, sofa, whiteboard)
    const midX = cx;

    // Desks on the Left (West)
    const deskCountX = Math.min(6, Math.max(1, Math.floor((wM / 2 - 0.8) / 1.4)));
    const deskCountZ = Math.min(6, Math.max(1, Math.floor((hM - 1.2) / 1.4)));
    const deskStartX = cx - wM / 4 - ((deskCountX - 1) * 1.4) / 2;
    const deskStartZ = cz - ((deskCountZ - 1) * 1.4) / 2;

    for (let c = 0; c < deskCountX; c++) {
      for (let r = 0; r < deskCountZ; r++) {
        group.add(createDeskSetup(deskStartX + c * 1.4, deskStartZ + r * 1.4, 0));
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

    // Modern curved sofas / lounge chairs around it
    const sofa = new THREE.Group();
    sofa.position.set(collabCX, 0, collabCZ + 0.8);
    // Cushion base
    const baseMesh = new THREE.Mesh(boxGeom, materials.cushionLounge);
    baseMesh.scale.set(1.5, 0.3, 0.6);
    baseMesh.position.y = 0.25;
    sofa.add(baseMesh);
    // Backrest
    const backMesh = new THREE.Mesh(boxGeom, materials.cushionLounge);
    backMesh.scale.set(1.5, 0.5, 0.15);
    backMesh.position.set(0, 0.6, 0.225);
    sofa.add(backMesh);
    group.add(sofa);

    // Portable whiteboard
    const board = new THREE.Group();
    board.position.set(collabCX - 0.7, 0, collabCZ - 0.8);
    board.rotation.y = Math.PI / 6;
    // Frame stand
    const stand = new THREE.Mesh(boxGeom, materials.deskLegs);
    stand.scale.set(1.0, 1.8, 0.05);
    stand.position.y = 0.9;
    board.add(stand);
    // Writing surface
    const surface = new THREE.Mesh(boxGeom, materials.deskSurface);
    surface.scale.set(0.9, 1.2, 0.01);
    surface.position.set(0, 1.1, 0.025);
    board.add(surface);
    group.add(board);

    // Decorative potted plant
    const plant = new THREE.Group();
    plant.position.set(collabCX + 0.8, 0, collabCZ - 0.8);
    // Pot
    const pot = new THREE.Mesh(cylGeom, materials.plantPot);
    pot.scale.set(0.3, 0.4, 0.3);
    pot.position.y = 0.2;
    plant.add(pot);
    // Foliage
    for (const p of [
      { x: 0, y: 0.5, z: 0, s: 0.35 },
      { x: 0.1, y: 0.62, z: -0.05, s: 0.28 },
      { x: -0.1, y: 0.6, z: 0.1, s: 0.25 },
      { x: 0.05, y: 0.72, z: 0.05, s: 0.22 }
    ]) {
      const foliage = new THREE.Mesh(geometries.sphere, materials.plantLeaves);
      foliage.scale.set(p.s, p.s * 1.3, p.s);
      foliage.position.set(p.x, p.y, p.z);
      plant.add(foliage);
    }
    group.add(plant);

  } else {
    // ── STANDARD DESK ROW LAYOUT ──
    const deskW = 1.2;
    const deskD = 0.6;
    const gapX  = 0.4;
    const gapZ  = 0.4;

    // Determine counts fitting the space (capped safely)
    const cols = Math.min(8, Math.max(1, Math.floor((wM - 0.6) / (deskW + gapX))));
    const rows = Math.min(8, Math.max(1, Math.floor((hM - 0.6) / (deskD + gapZ))));

    const startX = cx - ((cols - 1) * (deskW + gapX)) / 2;
    const startZ = cz - ((rows - 1) * (deskD + gapZ)) / 2;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Alternate screen rotations so it feels natural (rows facing opposite each other)
        const rotY = (r % 2 === 0) ? 0 : Math.PI;
        group.add(createDeskSetup(startX + c * (deskW + gapX), startZ + r * (deskD + gapZ), rotY));

        // Render a subtle partition divider between back-to-back rows
        if (r > 0 && r % 2 === 1) {
          const divider = new THREE.Mesh(boxGeom, materials.glass);
          divider.scale.set(deskW, 0.4, 0.02);
          // Positioned between row r and row r-1
          const prevZ = startZ + (r - 1) * (deskD + gapZ);
          const currZ = startZ + r * (deskD + gapZ);
          divider.position.set(startX + c * (deskW + gapX), 0.95, (prevZ + currZ) / 2);
          group.add(divider);
        }
      }
    }
  }

  return group;
}
