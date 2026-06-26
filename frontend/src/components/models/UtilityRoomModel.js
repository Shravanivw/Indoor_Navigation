import * as THREE from "three";
import { createRoomWalls } from "./ModelShared";

export function createUtilityRoom(cx, cz, wM, hM, isServerRoom, isDest, isUser, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.15;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Build room walls with a doorway on the South wall
  group.add(
    createRoomWalls({
      cx,
      cz,
      wM,
      hM,
      wallHeight,
      wallThickness: wt,
      material: wallMat,
      doorSide: "south",
      doorWidth: 0.9,
      doorHeight: 2.0,
      resources
    })
  );

  // 2. Render internal fixtures based on whether it is a Server Room or a Storage Room
  if (isServerRoom) {
    // ── SERVER ROOM FIXTURES ──
    // Render columns of server racks
    const rackW = 0.8;
    const rackD = 0.7;
    const rackH = 1.9;
    const spacing = 1.1;

    // Arrange racks inside the bounds
    const numRacks = Math.max(1, Math.floor((wM - 0.8) / spacing));
    const startX = cx - ((numRacks - 1) * spacing) / 2;

    const createServerRack = (rx, rz) => {
      const rack = new THREE.Group();
      rack.position.set(rx, 0, rz);

      // Main frame casing
      const frame = new THREE.Mesh(boxGeom, materials.metalDark);
      frame.scale.set(rackW, rackH, rackD);
      frame.position.y = rackH / 2;
      rack.add(frame);

      // Glossy front glass pane
      const glass = new THREE.Mesh(boxGeom, materials.glass);
      glass.scale.set(rackW - 0.05, rackH - 0.05, 0.02);
      glass.position.set(0, rackH / 2, rackD / 2 + 0.01);
      rack.add(glass);

      // Blinking LEDs inside (status indicator lights on server face)
      const numLeds = 14;
      const ledSpacing = (rackH - 0.3) / numLeds;
      const startLedY = 0.15;

      for (let i = 0; i < numLeds; i++) {
        const ledY = startLedY + i * ledSpacing;
        // Randomly pick color (green, red, amber)
        const rand = Math.random();
        const ledMat = rand > 0.65 ? materials.rackLedGreen : rand > 0.2 ? materials.rackLedAmber : materials.rackLedRed;

        // Left LED
        const ledL = new THREE.Mesh(boxGeom, ledMat);
        ledL.scale.set(0.04, 0.02, 0.005);
        ledL.position.set(-rackW / 4, ledY, rackD / 2 - 0.01);
        rack.add(ledL);

        // Right LED
        const ledR = new THREE.Mesh(boxGeom, ledMat);
        ledR.scale.set(0.04, 0.02, 0.005);
        ledR.position.set(-rackW / 4 + 0.08, ledY, rackD / 2 - 0.01);
        rack.add(ledR);
      }

      return rack;
    };

    for (let i = 0; i < numRacks; i++) {
      // Rack row along the center
      group.add(createServerRack(startX + i * spacing, cz));
    }

  } else {
    // ── STORAGE ROOM FIXTURES ──
    // Render shelving racks holding cardboard boxes
    const shelfW = Math.max(1.0, wM * 0.7);
    const shelfD = 0.5;
    const shelfH = 1.8;

    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(cx, 0, cz - hM / 6); // pushed back slightly

    // Shelving frame posts (4 metal pillars)
    const pMat = materials.metalSilver;
    for (const [px, pz] of [
      [shelfW / 2 - 0.02, shelfD / 2 - 0.02],
      [-shelfW / 2 + 0.02, shelfD / 2 - 0.02],
      [shelfW / 2 - 0.02, -shelfD / 2 + 0.02],
      [-shelfW / 2 + 0.02, -shelfD / 2 + 0.02]
    ]) {
      const pillar = new THREE.Mesh(cylGeom, pMat);
      pillar.scale.set(0.03, shelfH, 0.03);
      pillar.position.set(px, shelfH / 2, pz);
      shelfGroup.add(pillar);
    }

    // 4 shelves planks
    const numShelves = 4;
    const shelfSpacing = shelfH / numShelves;
    for (let i = 0; i < numShelves; i++) {
      const plank = new THREE.Mesh(boxGeom, pMat);
      plank.scale.set(shelfW, 0.03, shelfD);
      plank.position.y = (i + 1) * shelfSpacing - 0.05;
      shelfGroup.add(plank);

      // Put cardboard boxes on each shelf
      const boxW = 0.35;
      const boxD = 0.38;
      const boxH = 0.28;
      const numBoxes = Math.floor((shelfW - 0.1) / (boxW + 0.08));

      for (let b = 0; b < numBoxes; b++) {
        // Randomly skip some boxes to look natural
        if (Math.random() > 0.85) continue;

        const cardboardBox = new THREE.Mesh(boxGeom, materials.plantPot); // reuse brownish wood color for cardboard
        cardboardBox.scale.set(boxW, boxH, boxD);

        const bx = -shelfW / 2 + boxW / 2 + 0.08 + b * (boxW + 0.08);
        const by = (i + 1) * shelfSpacing - 0.05 + boxH / 2 + 0.015;
        const bz = (Math.random() * 0.06 - 0.03); // slight noise in positioning

        cardboardBox.position.set(bx, by, bz);
        shelfGroup.add(cardboardBox);
      }
    }

    group.add(shelfGroup);
  }

  return group;
}
