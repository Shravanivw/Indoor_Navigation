import * as THREE from "three";

// ============================================================================
// 1. FURNITURE COMPONENTS
// ============================================================================

/**
 * CHAIR COMPONENT
 * Renders various seating types based on style parameter.
 */
export function createChair(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const style = params.style || "office";
  const upholsteryColor = params.upholsteryColor;
  
  // Custom fabric material if a specific color is provided
  let fabricMat = materials.chairFabric;
  if (upholsteryColor) {
    fabricMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(upholsteryColor),
      roughness: 0.8
    });
  }

  switch (style) {
    case "office":
    case "executive": {
      // Pedestal base
      const base = new THREE.Mesh(boxGeom, materials.chairBase);
      base.scale.set(0.38, 0.02, 0.38);
      base.position.y = 0.05;
      group.add(base);

      // Central shaft
      const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
      shaft.scale.set(0.04, 0.36, 0.04);
      shaft.position.y = 0.23;
      group.add(shaft);

      // Seat cushion
      const seat = new THREE.Mesh(boxGeom, fabricMat);
      seat.scale.set(0.42, 0.06, 0.42);
      seat.position.y = 0.43;
      group.add(seat);

      // Backrest
      const backHeight = style === "executive" ? 0.55 : 0.38;
      const back = new THREE.Mesh(boxGeom, fabricMat);
      back.scale.set(0.38, backHeight, 0.05);
      back.position.set(0, 0.43 + backHeight / 2 + 0.05, 0.19);
      group.add(back);

      // Armrests (if requested or executive)
      if (params.hasArms || style === "executive") {
        const armL = new THREE.Mesh(boxGeom, materials.chairBase);
        armL.scale.set(0.04, 0.22, 0.25);
        armL.position.set(-0.23, 0.54, 0.02);
        group.add(armL);

        const armR = new THREE.Mesh(boxGeom, materials.chairBase);
        armR.scale.set(0.04, 0.22, 0.25);
        armR.position.set(0.23, 0.54, 0.02);
        group.add(armR);
      }
      break;
    }

    case "visitor": {
      // 4 thin metal legs
      const legMat = materials.metalSilver;
      const legPositions = [
        [-0.17, -0.17], [0.17, -0.17],
        [-0.17, 0.17], [0.17, 0.17]
      ];
      legPositions.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(cylGeom, legMat);
        leg.scale.set(0.025, 0.42, 0.025);
        leg.position.set(lx, 0.21, lz);
        group.add(leg);
      });

      // Simple seat
      const seat = new THREE.Mesh(boxGeom, fabricMat);
      seat.scale.set(0.4, 0.04, 0.4);
      seat.position.y = 0.43;
      group.add(seat);

      // Backrest
      const back = new THREE.Mesh(boxGeom, fabricMat);
      back.scale.set(0.38, 0.35, 0.04);
      back.position.set(0, 0.625, 0.18);
      group.add(back);
      break;
    }

    case "dining":
    case "cafe": {
      // Slender wire-frame legs
      const legMat = materials.metalSilver;
      for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
        const leg = new THREE.Mesh(cylGeom, legMat);
        leg.scale.set(0.02, 0.44, 0.02);
        leg.position.set(lx, 0.22, lz);
        group.add(leg);
      }

      // Seat shell
      const seat = new THREE.Mesh(boxGeom, fabricMat);
      seat.scale.set(0.36, 0.03, 0.36);
      seat.position.y = 0.44;
      group.add(seat);

      // Simple curved-back look
      const back = new THREE.Mesh(boxGeom, fabricMat);
      back.scale.set(0.34, 0.32, 0.03);
      back.position.set(0, 0.6, 0.165);
      group.add(back);
      break;
    }

    case "stool": {
      // Stool legs (tall)
      const legMat = materials.metalSilver;
      const sh = 0.73; // seat height
      for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
        const leg = new THREE.Mesh(cylGeom, legMat);
        leg.scale.set(0.02, sh, 0.02);
        leg.position.set(lx, sh / 2, lz);
        group.add(leg);
      }

      // Footrest ring
      const ringGeom = new THREE.TorusGeometry(0.18, 0.015, 8, 24);
      const ring = new THREE.Mesh(ringGeom, materials.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25;
      group.add(ring);

      // Circular seat
      const seat = new THREE.Mesh(cylGeom, fabricMat);
      seat.scale.set(0.32, 0.04, 0.32);
      seat.position.y = sh + 0.02;
      group.add(seat);
      break;
    }

    case "lounge": {
      // Chunky low base
      const seat = new THREE.Mesh(boxGeom, materials.cushionLounge);
      seat.scale.set(0.5, 0.35, 0.5);
      seat.position.y = 0.175;
      group.add(seat);

      // Deep backrest
      const back = new THREE.Mesh(boxGeom, materials.cushionLounge);
      back.scale.set(0.5, 0.4, 0.12);
      back.position.set(0, 0.375, 0.19);
      group.add(back);
      break;
    }
  }

  return group;
}

/**
 * DESKBENCH COMPONENT
 * Renders single/double desking rows with customizable slots and partitions.
 */
export function createDeskBench(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const desksAcross = params.desksAcross || 2;
  const deskSides = params.deskSides || 2; // 1 or 2
  const dividerType = params.dividerType || "glass";

  const deskW = 1.2;
  const deskD = 0.6;

  // Render desks
  const totalW = desksAcross * deskW;
  const startX = -((desksAcross - 1) * deskW) / 2;

  // Shared tabletop material
  const topMat = params.woodFinish ? materials.deskWood : materials.deskSurface;

  for (let c = 0; c < desksAcross; c++) {
    const dx = startX + c * deskW;

    // Side 1 (facing North, chair on South side)
    const deskGroup1 = new THREE.Group();
    deskGroup1.position.set(dx, 0, -deskD / 2);

    // Desktop
    const top1 = new THREE.Mesh(boxGeom, topMat);
    top1.scale.set(deskW, 0.03, deskD);
    top1.position.y = 0.73;
    deskGroup1.add(top1);

    // Legs
    const legL = new THREE.Mesh(boxGeom, materials.deskLegs);
    legL.scale.set(0.04, 0.71, 0.5);
    legL.position.set(-deskW / 2 + 0.05, 0.355, 0);
    deskGroup1.add(legL);

    const legR = new THREE.Mesh(boxGeom, materials.deskLegs);
    legR.scale.set(0.04, 0.71, 0.5);
    legR.position.set(deskW / 2 - 0.05, 0.355, 0);
    deskGroup1.add(legR);

    // Monitor
    const stand = new THREE.Mesh(cylGeom, materials.metalDark);
    stand.scale.set(0.06, 0.3, 0.06);
    stand.position.set(0, 0.88, -deskD / 2 + 0.1);
    deskGroup1.add(stand);
    const bezel = new THREE.Mesh(boxGeom, materials.screenBody);
    bezel.scale.set(0.52, 0.32, 0.03);
    bezel.position.set(0, 1.05, -deskD / 2 + 0.1);
    deskGroup1.add(bezel);
    const display = new THREE.Mesh(boxGeom, materials.screenGlow);
    display.scale.set(0.5, 0.3, 0.005);
    display.position.set(0, 1.05, -deskD / 2 + 0.118);
    deskGroup1.add(display);

    // Keyboard
    const kb = new THREE.Mesh(boxGeom, materials.keyboard);
    kb.scale.set(0.38, 0.015, 0.14);
    kb.position.set(0, 0.75, 0.12);
    deskGroup1.add(kb);

    // Chair
    const chair = createChair(0, 0.5, { style: "office" }, resources);
    deskGroup1.add(chair);

    group.add(deskGroup1);

    // Side 2 (facing South, if double-sided)
    if (deskSides === 2) {
      const deskGroup2 = new THREE.Group();
      deskGroup2.position.set(dx, 0, deskD / 2);
      deskGroup2.rotation.y = Math.PI;

      // Desktop
      const top2 = new THREE.Mesh(boxGeom, topMat);
      top2.scale.set(deskW, 0.03, deskD);
      top2.position.y = 0.73;
      deskGroup2.add(top2);

      // Legs
      const legL2 = new THREE.Mesh(boxGeom, materials.deskLegs);
      legL2.scale.set(0.04, 0.71, 0.5);
      legL2.position.set(-deskW / 2 + 0.05, 0.355, 0);
      deskGroup2.add(legL2);

      const legR2 = new THREE.Mesh(boxGeom, materials.deskLegs);
      legR2.scale.set(0.04, 0.71, 0.5);
      legR2.position.set(deskW / 2 - 0.05, 0.355, 0);
      deskGroup2.add(legR2);

      // Monitor
      const stand2 = new THREE.Mesh(cylGeom, materials.metalDark);
      stand2.scale.set(0.06, 0.3, 0.06);
      stand2.position.set(0, 0.88, -deskD / 2 + 0.1);
      deskGroup2.add(stand2);
      const bezel2 = new THREE.Mesh(boxGeom, materials.screenBody);
      bezel2.scale.set(0.52, 0.32, 0.03);
      bezel2.position.set(0, 1.05, -deskD / 2 + 0.1);
      deskGroup2.add(bezel2);
      const display2 = new THREE.Mesh(boxGeom, materials.screenGlow);
      display2.scale.set(0.5, 0.3, 0.005);
      display2.position.set(0, 1.05, -deskD / 2 + 0.118);
      deskGroup2.add(display2);

      // Keyboard
      const kb2 = new THREE.Mesh(boxGeom, materials.keyboard);
      kb2.scale.set(0.38, 0.015, 0.14);
      kb2.position.set(0, 0.75, 0.12);
      deskGroup2.add(kb2);

      // Chair
      const chair2 = createChair(0, 0.5, { style: "office" }, resources);
      deskGroup2.add(chair2);

      group.add(deskGroup2);

      // Divider screen between the facing desks
      if (dividerType !== "none") {
        const divMat = dividerType === "glass" ? materials.glass : materials.chairFabric;
        const divider = new THREE.Mesh(boxGeom, divMat);
        divider.scale.set(deskW, 0.38, 0.02);
        divider.position.set(dx, 0.92, 0);
        group.add(divider);
      }
    }
  }

  return group;
}

/**
 * TABLE COMPONENT
 * Configurable table supporting dining, meetings, huddles, and coffee table setups.
 */
export function createTable(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const shape = params.shape || "rectangular";
  const height = params.height || 0.75;
  const w = params.width || 0.9;
  const l = params.length || w;
  const baseStyle = params.baseStyle || "legs";

  // Table Top Materials
  let topMat = materials.deskSurface;
  if (params.finish === "wood") {
    topMat = materials.deskWood;
  } else if (params.finish === "glass") {
    topMat = materials.glass;
  } else if (params.finish === "dark") {
    topMat = materials.metalDark;
  }

  // 1. Table Top Mesh
  let topMesh;
  const thickness = 0.04;
  if (shape === "round") {
    topMesh = new THREE.Mesh(cylGeom, topMat);
    topMesh.scale.set(w, thickness, w);
  } else {
    // rectangular or oval (oval represents stretched box here)
    topMesh = new THREE.Mesh(boxGeom, topMat);
    topMesh.scale.set(l, thickness, w);
  }
  topMesh.position.y = height - thickness / 2;
  group.add(topMesh);

  // 2. Table Base Support
  const legThickness = 0.06;
  const legH = height - thickness;

  if (baseStyle === "legs") {
    // 4 Corner legs
    const offsets = [
      [l / 2 - 0.08, w / 2 - 0.08],
      [-l / 2 + 0.08, w / 2 - 0.08],
      [l / 2 - 0.08, -w / 2 + 0.08],
      [-l / 2 + 0.08, -w / 2 + 0.08]
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(boxGeom, materials.deskLegs);
      leg.scale.set(legThickness, legH, legThickness);
      leg.position.set(ox, legH / 2, oz);
      group.add(leg);
    });
  } else if (baseStyle === "pedestal") {
    // Central single pedestal shaft and flat floor plate
    const shaft = new THREE.Mesh(cylGeom, materials.metalSilver);
    shaft.scale.set(0.08, legH, 0.08);
    shaft.position.y = legH / 2;
    group.add(shaft);

    const basePlate = new THREE.Mesh(cylGeom, materials.metalDark);
    basePlate.scale.set(w * 0.45, 0.02, w * 0.45);
    basePlate.position.y = 0.01;
    group.add(basePlate);
  } else if (baseStyle === "base-drums") {
    // Drum bases for boardrooms/conference setups
    if (l > 1.8) {
      const drum1 = new THREE.Mesh(cylGeom, materials.metalDark);
      drum1.scale.set(0.4, legH, 0.4);
      drum1.position.set(-l / 4, legH / 2, 0);
      group.add(drum1);

      const drum2 = new THREE.Mesh(cylGeom, materials.metalDark);
      drum2.scale.set(0.4, legH, 0.4);
      drum2.position.set(l / 4, legH / 2, 0);
      group.add(drum2);
    } else {
      const drum = new THREE.Mesh(cylGeom, materials.metalDark);
      drum.scale.set(0.35, legH, 0.35);
      drum.position.set(0, legH / 2, 0);
      group.add(drum);
    }
  }

  return group;
}

/**
 * SOFA COMPONENT
 * Parametric seating component for lounge sofas or high-backed booth modules.
 */
export function createSofa(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;

  const seatsCount = params.seatsCount || 3;
  const backrestHeight = params.backrestHeight || 0.65;
  
  const seatW = 0.6; // Width per seat
  const totalW = seatsCount * seatW;
  const depth = 0.75;

  let cushionColor = materials.cushionLounge;
  if (params.color) {
    cushionColor = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.color),
      roughness: 0.7
    });
  }

  // 1. Sofa base platform
  const base = new THREE.Mesh(boxGeom, materials.chairFabric);
  base.scale.set(totalW, 0.22, depth);
  base.position.y = 0.11;
  group.add(base);

  // 2. Soft seat cushions
  const seatCushion = new THREE.Mesh(boxGeom, cushionColor);
  seatCushion.scale.set(totalW - 0.08, 0.1, depth - 0.08);
  seatCushion.position.set(0, 0.27, -0.01);
  group.add(seatCushion);

  // 3. Backrest panel
  const backPanel = new THREE.Mesh(boxGeom, materials.chairFabric);
  backPanel.scale.set(totalW, backrestHeight, 0.14);
  backPanel.position.set(0, backrestHeight / 2 + 0.1, -depth / 2 + 0.07);
  group.add(backPanel);

  // 4. Side armrests
  const armL = new THREE.Mesh(boxGeom, materials.chairFabric);
  armL.scale.set(0.12, 0.44, depth);
  armL.position.set(-totalW / 2 - 0.06, 0.22, 0);
  group.add(armL);

  const armR = new THREE.Mesh(boxGeom, materials.chairFabric);
  armR.scale.set(0.12, 0.44, depth);
  armR.position.set(totalW / 2 + 0.06, 0.22, 0);
  group.add(armR);

  return group;
}

/**
 * CABINET COMPONENT
 * Configurable storage cupboard, credenza, locker block, or printer station base.
 */
export function createCabinet(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;

  const w = params.width || 1.2;
  const h = params.height || 0.85;
  const d = params.depth || 0.45;
  const style = params.style || "closed-doors";

  // Cabinet body
  let bodyMat = materials.deskWood;
  if (params.finish === "metal") {
    bodyMat = materials.deskLegs;
  } else if (params.finish === "white") {
    bodyMat = materials.deskSurface;
  }

  const body = new THREE.Mesh(boxGeom, bodyMat);
  body.scale.set(w, h, d);
  body.position.y = h / 2;
  group.add(body);

  // Style details (draw lines for doors/shelves/lockers)
  if (style === "closed-doors") {
    // Vertical center split line
    const split = new THREE.Mesh(boxGeom, materials.chairBase);
    split.scale.set(0.01, h - 0.04, 0.01);
    split.position.set(0, h / 2, d / 2 + 0.002);
    group.add(split);

    // Minimal door handles
    const handleL = new THREE.Mesh(boxGeom, materials.metalSilver);
    handleL.scale.set(0.02, 0.08, 0.02);
    handleL.position.set(-0.06, h * 0.65, d / 2 + 0.012);
    group.add(handleL);

    const handleR = new THREE.Mesh(boxGeom, materials.metalSilver);
    handleR.scale.set(0.02, 0.08, 0.02);
    handleR.position.set(0.06, h * 0.65, d / 2 + 0.012);
    group.add(handleR);
  } else if (style === "open-shelves") {
    // Darker inside shelf mockups
    const numShelves = Math.max(1, Math.floor(h / 0.35));
    const shelfSpacing = (h - 0.08) / numShelves;
    for (let i = 1; i < numShelves; i++) {
      const shelf = new THREE.Mesh(boxGeom, materials.chairBase);
      shelf.scale.set(w - 0.08, 0.02, d - 0.02);
      shelf.position.set(0, 0.04 + i * shelfSpacing, 0.01);
      group.add(shelf);
    }
  } else if (style === "lockers-grid") {
    // Draw grid partition splits
    const cols = Math.max(2, Math.floor(w / 0.45));
    const rows = Math.max(2, Math.floor(h / 0.45));

    // Vertical seam splits
    for (let c = 1; c < cols; c++) {
      const sx = -w / 2 + c * (w / cols);
      const seam = new THREE.Mesh(boxGeom, materials.chairBase);
      seam.scale.set(0.01, h - 0.04, 0.01);
      seam.position.set(sx, h / 2, d / 2 + 0.002);
      group.add(seam);
    }
    // Horizontal seam splits
    for (let r = 1; r < rows; r++) {
      const sy = r * (h / rows);
      const seam = new THREE.Mesh(boxGeom, materials.chairBase);
      seam.scale.set(w - 0.04, 0.01, 0.01);
      seam.position.set(0, sy, d / 2 + 0.002);
      group.add(seam);
    }
    // Keyholes
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const lx = -w / 2 + (c + 0.8) * (w / cols);
        const ly = (r + 0.8) * (h / rows);
        const keyhole = new THREE.Mesh(boxGeom, materials.metalDark);
        keyhole.scale.set(0.02, 0.02, 0.005);
        keyhole.position.set(lx, ly, d / 2 + 0.005);
        group.add(keyhole);
      }
    }
  }

  return group;
}


// ============================================================================
// 2. LANDMARK MODULES (NAVIGATION MARKERS)
// ============================================================================

/**
 * PRINTER LANDMARK
 * A detailed corporate photocopier printer unit.
 */
export function createPrinter(x, z, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  // Base cabinet (white/grey)
  const base = new THREE.Mesh(boxGeom, materials.deskSurface);
  base.scale.set(0.65, 0.72, 0.62);
  base.position.y = 0.36;
  group.add(base);

  // Upper scanner housing (slate dark metal)
  const top = new THREE.Mesh(boxGeom, materials.metalDark);
  top.scale.set(0.65, 0.35, 0.62);
  top.position.y = 0.72 + 0.175;
  group.add(top);

  // Paper output tray cutout
  const tray = new THREE.Mesh(boxGeom, materials.chairBase);
  tray.scale.set(0.48, 0.1, 0.5);
  tray.position.set(0.05, 0.65, 0.05);
  group.add(tray);

  // Control screen console (angled)
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(-0.15, 0.92, 0.28);
  consoleGroup.rotation.x = Math.PI / 8; // angled forward
  const consoleBody = new THREE.Mesh(boxGeom, materials.screenBody);
  consoleBody.scale.set(0.24, 0.18, 0.04);
  consoleGroup.add(consoleBody);
  const consoleGlow = new THREE.Mesh(boxGeom, materials.screenGlow);
  consoleGlow.scale.set(0.22, 0.16, 0.008);
  consoleGlow.position.z = 0.022;
  consoleGroup.add(consoleGlow);
  group.add(consoleGroup);

  // Paper feeder top feeder tray
  const feeder = new THREE.Mesh(boxGeom, materials.screenBody);
  feeder.scale.set(0.42, 0.05, 0.38);
  feeder.position.set(-0.04, 1.1, -0.04);
  group.add(feeder);

  return group;
}

/**
 * LOCKERS LANDMARK
 * Reuses Cabinet with grid parameters to form a tall locker storage wall.
 */
export function createLockers(x, z, params = {}, resources) {
  // Configured default sizes for a locker cluster
  const config = {
    width: params.width || 1.6,
    height: params.height || 1.6,
    depth: params.depth || 0.5,
    style: "lockers-grid",
    finish: params.finish || "metal"
  };
  return createCabinet(x, z, config, resources);
}

/**
 * COFFEE MACHINE LANDMARK
 * Countertop brewer unit.
 */
export function createCoffeeMachine(x, z, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  // Main machine body
  const body = new THREE.Mesh(boxGeom, materials.metalDark);
  body.scale.set(0.38, 0.44, 0.35);
  body.position.y = 0.22;
  group.add(body);

  // Chrome drip tray
  const tray = new THREE.Mesh(boxGeom, materials.metalSilver);
  tray.scale.set(0.34, 0.02, 0.14);
  tray.position.set(0, 0.02, 0.12);
  group.add(tray);

  // Metal cup spouts
  const spouts = new THREE.Mesh(cylGeom, materials.metalSilver);
  spouts.scale.set(0.04, 0.08, 0.04);
  spouts.position.set(0, 0.25, 0.08);
  group.add(spouts);

  // Tiny coffee cup placed in tray
  const cup = new THREE.Mesh(cylGeom, materials.deskSurface);
  cup.scale.set(0.08, 0.1, 0.08);
  cup.position.set(0, 0.08, 0.08);
  group.add(cup);

  // Glowing status LED indicator
  const led = new THREE.Mesh(geometries.sphere, materials.rackLedGreen);
  led.scale.set(0.02, 0.02, 0.02);
  led.position.set(0.12, 0.36, 0.18);
  group.add(led);

  return group;
}

/**
 * TV DISPLAY LANDMARK
 * Wall-mounted digital presentation display screen.
 */
export function createTVDisplay(x, z, params = {}, resources) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  if (params.rotation) {
    group.rotation.y = params.rotation;
  }

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;

  const w = params.width || 1.2;
  const h = params.height || 0.7;
  const d = 0.08;

  // Outer bezel frame
  const frame = new THREE.Mesh(boxGeom, materials.metalDark);
  frame.scale.set(w, h, d);
  frame.position.y = h / 2;
  group.add(frame);

  // Glowing display surface
  const screen = new THREE.Mesh(boxGeom, materials.screenGlow);
  screen.scale.set(w - 0.06, h - 0.05, 0.01);
  screen.position.set(0, h / 2, d / 2 + 0.005);
  group.add(screen);

  return group;
}

/**
 * WHITEBOARD LANDMARK
 * Portable brainstorming whiteboard.
 */
export function createWhiteboard(x, z, rotation = 0, resources) {
  const board = new THREE.Group();
  board.position.set(x, 0, z);
  board.rotation.y = rotation;

  const { geometries, materials } = resources;
  const boxGeom = geometries.box;

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

  return board;
}

/**
 * POTTED PLANT LANDMARK
 * Decorative planter pot.
 */
export function createPottedPlant(x, z, resources) {
  const plant = new THREE.Group();
  plant.position.set(x, 0, z);

  const { geometries, materials } = resources;
  const cylGeom = geometries.cylinder;

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

  return plant;
}

// ============================================================================
// 3. BACKWARDS COMPATIBILITY WRAPPERS
// ============================================================================
export function createDeskUnit(dx, dz, rotationY, resources) {
  return createDeskBench(dx, dz, { desksAcross: 1, deskSides: 1, dividerType: "none", rotation: rotationY }, resources);
}
export function createSofaUnit(sx, sz, rotY, resources) {
  return createSofa(sx, sz, { seatsCount: 3, rotation: rotY }, resources);
}
export function createWhiteboardUnit(bx, bz, rotY, resources) {
  return createWhiteboard(bx, bz, rotY, resources);
}
export function createPlantUnit(px, pz, resources) {
  return createPottedPlant(px, pz, resources);
}

