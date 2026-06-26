import * as THREE from "three";

// Cache for reuse across re-renders within the same session
let cachedResources = null;

export function initSharedResources() {
  if (cachedResources) return cachedResources;

  // 1. Procedural Texture Generators
  const createCarpetTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8a95a5"; // warm bluish grey
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2000; i++) {
      const val = Math.floor(Math.random() * 24) - 12;
      ctx.fillStyle = `rgba(${138 + val}, ${149 + val}, ${165 + val}, 0.18)`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  };

  const createWoodTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8f573c"; // medium-rich wood
    ctx.fillRect(0, 0, 256, 256);
    // Draw wood planks
    ctx.strokeStyle = "#5a3420";
    ctx.lineWidth = 2;
    const plankH = 32;
    for (let y = 0; y < 256; y += plankH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      // joints
      const shift = (y / plankH) % 2 === 0 ? 0 : 64;
      for (let x = shift; x < 256 + 64; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x % 256, y);
        ctx.lineTo(x % 256, y + plankH);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  };

  const createTileTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f4f6"; // off-white tiles
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  };

  const createArrowTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext("2d");
    // transparent background
    ctx.clearRect(0, 0, 128, 32);
    // Draw glowing chevrons
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let x = 16; x < 128; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x - 8, 6);
      ctx.lineTo(x + 2, 16);
      ctx.lineTo(x - 8, 26);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  };

  const carpetTex = createCarpetTexture();
  const woodTex   = createWoodTexture();
  const tileTex   = createTileTexture();
  const arrowTex  = createArrowTexture();

  // 2. Shared Geometries
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    sphere: new THREE.SphereGeometry(0.5, 16, 16),
  };

  // 3. Shared Materials
  const materials = {
    // Floor materials
    floorCarpet: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1.0, metalness: 0.1 }),
    floorWood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45, metalness: 0.15 }),
    floorTile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.2, metalness: 0.1 }),
    floorCorridor: new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.8 }),

    // Architectural materials
    wallNormal: new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.85 }),
    wallDest: new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      roughness: 0.6,
      emissive: 0x059669,
      emissiveIntensity: 0.25,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.2,
      side: THREE.DoubleSide,
    }),
    glassFrame: new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, metalness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.9, side: THREE.DoubleSide }),

    // Furniture/Prop materials
    deskSurface: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }), // white laminate
    deskWood: new THREE.MeshStandardMaterial({ color: 0xd69e2e, roughness: 0.6 }), // maple wood
    deskLegs: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.7 }),
    chairFabric: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
    chairBase: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.9 }),
    cushionLounge: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.75 }),
    screenBody: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }),
    screenGlow: new THREE.MeshBasicMaterial({ color: 0xbae6fd }),
    keyboard: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 }),
    metalSilver: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 }),
    plantLeaves: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }),
    plantPot: new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.6 }),
    rackLedGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    rackLedRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    rackLedAmber: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),

    // Path details
    pathArrows: new THREE.MeshBasicMaterial({
      map: arrowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  };

  // Tag them as shared so we do not dispose of them during scene teardown
  for (const key in geometries) {
    geometries[key].isShared = true;
  }
  for (const key in materials) {
    materials[key].isShared = true;
    if (materials[key].map) {
      materials[key].map.isShared = true;
    }
  }

  cachedResources = { geometries, materials, textures: { arrowTex } };
  return cachedResources;
}

/**
 * Builds walls for a rectangular area, optionally creating a doorway on one side.
 * doorSide can be 'north', 'south', 'east', 'west', or 'none'.
 */
export function createRoomWalls({ cx, cz, wM, hM, wallHeight, wallThickness, material, doorSide = "south", doorWidth = 0.9, doorHeight = 2.0, resources }) {
  const group = new THREE.Group();
  const boxGeom = resources.geometries.box;
  const wt = wallThickness;

  // East & West walls
  const buildEastWest = (xOffset, isDoorSide) => {
    if (isDoorSide && hM > doorWidth + 0.4) {
      // Split wall in two + header
      const segLen = (hM - doorWidth) / 2;
      const hSeg = wallHeight;
      const hHeader = wallHeight - doorHeight;

      // Segment 1 (North side)
      const mesh1 = new THREE.Mesh(boxGeom, material);
      mesh1.scale.set(wt, hSeg, segLen);
      mesh1.position.set(cx + xOffset, hSeg / 2, cz - hM / 2 + segLen / 2);
      group.add(mesh1);

      // Segment 2 (South side)
      const mesh2 = new THREE.Mesh(boxGeom, material);
      mesh2.scale.set(wt, hSeg, segLen);
      mesh2.position.set(cx + xOffset, hSeg / 2, cz + hM / 2 - segLen / 2);
      group.add(mesh2);

      // Header above door
      if (hHeader > 0.05) {
        const header = new THREE.Mesh(boxGeom, material);
        header.scale.set(wt, hHeader, doorWidth);
        header.position.set(cx + xOffset, doorHeight + hHeader / 2, cz);
        group.add(header);
      }
    } else {
      const mesh = new THREE.Mesh(boxGeom, material);
      mesh.scale.set(wt, wallHeight, hM);
      mesh.position.set(cx + xOffset, wallHeight / 2, cz);
      group.add(mesh);
    }
  };

  // North & South walls
  const buildNorthSouth = (zOffset, isDoorSide) => {
    if (isDoorSide && wM > doorWidth + 0.4) {
      // Split wall in two + header
      const segLen = (wM - doorWidth) / 2;
      const hSeg = wallHeight;
      const hHeader = wallHeight - doorHeight;

      // Segment 1 (West side)
      const mesh1 = new THREE.Mesh(boxGeom, material);
      mesh1.scale.set(segLen, hSeg, wt);
      mesh1.position.set(cx - wM / 2 + segLen / 2, hSeg / 2, cz + zOffset);
      group.add(mesh1);

      // Segment 2 (East side)
      const mesh2 = new THREE.Mesh(boxGeom, material);
      mesh2.scale.set(segLen, hSeg, wt);
      mesh2.position.set(cx + wM / 2 - segLen / 2, hSeg / 2, cz + zOffset);
      group.add(mesh2);

      // Header above door
      if (hHeader > 0.05) {
        const header = new THREE.Mesh(boxGeom, material);
        header.scale.set(doorWidth, hHeader, wt);
        header.position.set(cx, doorHeight + hHeader / 2, cz + zOffset);
        group.add(header);
      }
    } else {
      const mesh = new THREE.Mesh(boxGeom, material);
      mesh.scale.set(wM + wt * 2, wallHeight, wt);
      mesh.position.set(cx, wallHeight / 2, cz + zOffset);
      group.add(mesh);
    }
  };

  buildEastWest(-wM / 2, doorSide === "west");
  buildEastWest(wM / 2, doorSide === "east");
  buildNorthSouth(-hM / 2, doorSide === "north");
  buildNorthSouth(hM / 2, doorSide === "south");

  return group;
}
