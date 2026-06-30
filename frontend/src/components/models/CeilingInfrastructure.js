import * as THREE from "three";

// Set to true to render wall top bounds, ceiling bounds, and placement points
const DEBUG_CEILING = false;

/**
 * Helper: Calculates the shortest distance from point (x, z) to line segment (x1, z1) -> (x2, z2)
 */
function pointToSegmentDistance(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(x - x1, z - z1);
  
  let t = ((x - x1) * dx + (z - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t)); // clamp to segment bounds
  
  const projX = x1 + t * dx;
  const projZ = z1 + t * dz;
  return Math.hypot(x - projX, z - projZ);
}

/**
 * Helper: Ray-casting point-in-polygon check + segment distance safety margin check
 */
function isPointInWorldPolygon(x, z, worldPolygon, margin = 0.3) {
  if (!worldPolygon || worldPolygon.length < 3) return false;
  
  // 1. Ray-casting point-in-polygon check
  let inside = false;
  for (let i = 0, j = worldPolygon.length - 1; i < worldPolygon.length; j = i++) {
    const xi = worldPolygon[i].x, zi = worldPolygon[i].z;
    const xj = worldPolygon[j].x, zj = worldPolygon[j].z;
    
    const intersect = ((zi > z) !== (zj > z))
        && (x < (xj - xi) * (z - zi) / (zj - zi + 0.0001) + xi);
    if (intersect) inside = !inside;
  }
  if (!inside) return false;

  // 2. Safety margin check: ensure point is at least `margin` away from all walls
  for (let i = 0; i < worldPolygon.length; i++) {
    const p1 = worldPolygon[i];
    const p2 = worldPolygon[(i + 1) % worldPolygon.length];
    if (pointToSegmentDistance(x, z, p1.x, p1.z, p2.x, p2.z) < margin) {
      return false;
    }
  }
  return true;
}

/**
 * Helper: Walks outwards from a start coordinate along X or Z axis to find the max valid length before hitting walls/margins.
 */
function getValidLineInterval(startVal, step, lengthLimit, constantVal, isAxisX, worldPolygon, margin = 0.3) {
  let minVal = startVal;
  let maxVal = startVal;
  
  // Scan negative direction
  for (let d = 0; d <= lengthLimit; d += step) {
    const val = startVal - d;
    const testX = isAxisX ? val : constantVal;
    const testZ = isAxisX ? constantVal : val;
    if (isPointInWorldPolygon(testX, testZ, worldPolygon, margin)) {
      minVal = val;
    } else {
      break;
    }
  }
  // Scan positive direction
  for (let d = 0; d <= lengthLimit; d += step) {
    const val = startVal + d;
    const testX = isAxisX ? val : constantVal;
    const testZ = isAxisX ? constantVal : val;
    if (isPointInWorldPolygon(testX, testZ, worldPolygon, margin)) {
      maxVal = val;
    } else {
      break;
    }
  }
  return { minVal, maxVal };
}

/**
 * Initializes geometries, materials, and instancing collections for the ceiling infrastructure.
 */
export function initCeilingInfrastructure(scene, resources) {
  const { geometries, materials } = resources;

  // Procedural texture for standard suspended ceiling tiles
  const createCeilingGridTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fafafa"; // off-white
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#e2e8f0"; // thin grey grid gridline
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  };

  const gridTex = createCeilingGridTexture();

  // Add specialized materials to resources if not already present
  if (!materials.ceilingGrid) {
    materials.ceilingGrid = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.95,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }
  if (!materials.exposedCeilingDeck) {
    materials.exposedCeilingDeck = new THREE.MeshStandardMaterial({
      color: 0x111827, // dark charcoal
      roughness: 0.9,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
  }
  if (!materials.ledGlow) {
    materials.ledGlow = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
  }
  if (!materials.sprinklerRed) {
    materials.sprinklerRed = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // fire red
      roughness: 0.5,
      metalness: 0.3,
    });
  }
  if (DEBUG_CEILING && !materials.debugLineMat) {
    materials.debugLineMat = new THREE.LineBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.7 });
    materials.debugPointMat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false, transparent: true, opacity: 0.8 });
  }

  // Shared geometries for instancing
  const recessedLightGeom = new THREE.BoxGeometry(0.6, 0.015, 0.6);
  const linearLightGeom = new THREE.BoxGeometry(1.2, 0.04, 0.12);
  const ventGeom = new THREE.BoxGeometry(0.4, 0.015, 0.4);
  
  // Tapered cylinder pendant light (cable + cone shape)
  // Cable of length 0.65, Shade of length 0.15
  const pendantGeom = new THREE.CylinderGeometry(0.01, 0.12, 0.8, 10);
  pendantGeom.translate(0, 0.4, 0); // origin at bottom shade (Y=0)

  // Exposed industrial HVAC Duct (length 1.0, scaled along length)
  const ductGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 12);
  ductGeom.rotateZ(Math.PI / 2); // orient along X-axis

  // Exposed Sprinkler Pipe (length 1.0, scaled along length)
  const sprinklerPipeGeom = new THREE.CylinderGeometry(0.016, 0.016, 1.0, 6);
  sprinklerPipeGeom.rotateZ(Math.PI / 2); // orient along X-axis

  // Exposed Sprinkler Head/Nozzle
  const sprinklerHeadGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6);
  sprinklerHeadGeom.translate(0, -0.03, 0);

  return {
    materials,
    geometries,
    instances: {
      recessedLight: [],
      linearLight: [],
      vent: [],
      pendant: [],
      duct: [],
      sprinklerPipe: [],
      sprinklerHead: [],
    },
    geoms: {
      recessedLightGeom,
      linearLightGeom,
      ventGeom,
      pendantGeom,
      ductGeom,
      sprinklerPipeGeom,
      sprinklerHeadGeom,
    },
    sceneAdd: [],
  };
}

/**
 * Adds appropriate ceiling plane and accumulates instanced infrastructure nodes for a room.
 */
export function addRoomCeiling(infra, room, template, cx, cz, wM, hM, roomPolygon, toWorld) {
  const { materials, instances, sceneAdd } = infra;

  // Transform room grid polygon to world space coordinates
  const worldPolygon = roomPolygon.map(p => toWorld(p.x, p.y));

  // 1. Identify Exposed Ceilings
  const nameLower = (room.name ?? "").toLowerCase();
  const isExposed =
    (template === "PANTRY" && (nameLower.includes("cafeteria") || nameLower.includes("dining"))) ||
    (template === "OPEN_WORKSPACE" && nameLower.includes("innovation")) ||
    (template === "BOOTH" && (nameLower.includes("collaboration") || nameLower.includes("sitting area")));

  // Ceiling height: All ceilings sit exactly flush at the wall top of 3.0m to prevent vertical white gaps.
  const height = 3.0;

  // 2. Render Ceiling Plane (flush with wall tops)
  const ceilingGeom = new THREE.PlaneGeometry(wM - 0.02, hM - 0.02);
  const baseMat = isExposed ? materials.exposedCeilingDeck : materials.ceilingGrid;
  
  let activeMat = baseMat;
  if (!isExposed && baseMat.map) {
    // Clone texture to scale tile patterns to exact 0.6m repeating increments per room
    const clonedTex = baseMat.map.clone();
    clonedTex.repeat.set(wM / 0.6, hM / 0.6);
    clonedTex.needsUpdate = true;
    activeMat = baseMat.clone();
    activeMat.map = clonedTex;
  }

  const roomCeiling = new THREE.Mesh(ceilingGeom, activeMat);
  roomCeiling.rotation.x = Math.PI / 2;
  roomCeiling.position.set(cx, height, cz);
  sceneAdd.push(roomCeiling);

  // Debug: Render ceiling boundary outline
  if (DEBUG_CEILING) {
    const points = [];
    worldPolygon.forEach(wp => points.push(new THREE.Vector3(wp.x, height, wp.z)));
    points.push(points[0]); // close loop
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMesh = new THREE.Line(lineGeom, materials.debugLineMat);
    sceneAdd.push(lineMesh);
  }

  // 3. Distribute Infrastructure Elements (with 0.45m wall safety margin)
  const margin = 0.45;
  const quatNormal = new THREE.Quaternion();

  const addDebugPoint = (px, pz) => {
    if (DEBUG_CEILING) {
      const debugPointMesh = new THREE.Mesh(infra.geometries.sphere, materials.debugPointMat);
      debugPointMesh.scale.set(0.06, 0.06, 0.06);
      debugPointMesh.position.set(px, height - 0.02, pz);
      sceneAdd.push(debugPointMesh);
    }
  };

  if (template === "CORRIDOR") {
    // CORRIDORS: Linear lights, HVAC Vents, and Sprinkler Pipes
    const isHorizontal = wM > hM;
    const spacing = 3.0;
    const corridorMargin = 0.25; // narrower corridor safety margin

    if (isHorizontal) {
      // Find horizontal valid pipe segment within corridor bounds
      const interval = getValidLineInterval(cx, 0.05, wM / 2, cz, true, worldPolygon, corridorMargin);
      const pipeLen = interval.maxVal - interval.minVal;
      const pipeCenter = (interval.minVal + interval.maxVal) / 2;

      if (pipeLen > 0.5) {
        // Sprinkler pipe running horizontally
        const pipeMatrix = new THREE.Matrix4();
        pipeMatrix.compose(
          new THREE.Vector3(pipeCenter, height - 0.08, cz),
          quatNormal,
          new THREE.Vector3(pipeLen, 1, 1)
        );
        instances.sprinklerPipe.push(pipeMatrix);

        const count = Math.max(1, Math.floor(pipeLen / spacing));
        const startX = pipeCenter - ((count - 1) * spacing) / 2;

        for (let i = 0; i < count; i++) {
          const lx = startX + i * spacing;

          // Confirm point is inside corridor walls with safety margin
          if (isPointInWorldPolygon(lx, cz, worldPolygon, corridorMargin)) {
            // Linear light
            const lightMatrix = new THREE.Matrix4();
            lightMatrix.compose(
              new THREE.Vector3(lx, height - 0.02, cz),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.linearLight.push(lightMatrix);
            addDebugPoint(lx, cz);

            // Sprinkler head
            const sprinklerMatrix = new THREE.Matrix4();
            sprinklerMatrix.compose(
              new THREE.Vector3(lx + spacing / 4, height - 0.08, cz),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.sprinklerHead.push(sprinklerMatrix);

            // Alternate HVAC vents between lights
            if (i < count - 1) {
              const vx = lx + spacing / 2;
              if (isPointInWorldPolygon(vx, cz, worldPolygon, corridorMargin)) {
                const ventMatrix = new THREE.Matrix4();
                ventMatrix.compose(
                  new THREE.Vector3(vx, height - 0.015, cz),
                  quatNormal,
                  new THREE.Vector3(1, 1, 1)
                );
                instances.vent.push(ventMatrix);
              }
            }
          }
        }
      }
    } else {
      // Vertical corridor running along Z-axis (rotate 90 degrees around Y)
      const quatRotated = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      const interval = getValidLineInterval(cz, 0.05, hM / 2, cx, false, worldPolygon, corridorMargin);
      const pipeLen = interval.maxVal - interval.minVal;
      const pipeCenter = (interval.minVal + interval.maxVal) / 2;

      if (pipeLen > 0.5) {
        const pipeMatrix = new THREE.Matrix4();
        pipeMatrix.compose(
          new THREE.Vector3(cx, height - 0.08, pipeCenter),
          quatRotated,
          new THREE.Vector3(pipeLen, 1, 1)
        );
        instances.sprinklerPipe.push(pipeMatrix);

        const count = Math.max(1, Math.floor(pipeLen / spacing));
        const startZ = pipeCenter - ((count - 1) * spacing) / 2;

        for (let i = 0; i < count; i++) {
          const lz = startZ + i * spacing;

          if (isPointInWorldPolygon(cx, lz, worldPolygon, corridorMargin)) {
            const lightMatrix = new THREE.Matrix4();
            lightMatrix.compose(
              new THREE.Vector3(cx, height - 0.02, lz),
              quatRotated,
              new THREE.Vector3(1, 1, 1)
            );
            instances.linearLight.push(lightMatrix);
            addDebugPoint(cx, lz);

            const sprinklerMatrix = new THREE.Matrix4();
            sprinklerMatrix.compose(
              new THREE.Vector3(cx, height - 0.08, lz + spacing / 4),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.sprinklerHead.push(sprinklerMatrix);

            if (i < count - 1) {
              const vz = lz + spacing / 2;
              if (isPointInWorldPolygon(cx, vz, worldPolygon, corridorMargin)) {
                const ventMatrix = new THREE.Matrix4();
                ventMatrix.compose(
                  new THREE.Vector3(cx, height - 0.015, vz),
                  quatNormal,
                  new THREE.Vector3(1, 1, 1)
                );
                instances.vent.push(ventMatrix);
              }
            }
          }
        }
      }
    }
  } else if (isExposed) {
    // EXPOSED CEILINGS: ducts, sprinkler systems, and hanging pendant lights
    const spacingX = 2.0;
    const spacingZ = 2.0;
    const cols = Math.max(1, Math.floor(wM / spacingX));
    const rows = Math.max(1, Math.floor(hM / spacingZ));
    const startX = cx - ((cols - 1) * spacingX) / 2;
    const startZ = cz - ((rows - 1) * spacingZ) / 2;

    // Distribute hanging pendant lights (pendant is 0.6m tall, shade hangs at 2.0m)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const px = startX + c * spacingX;
        const pz = startZ + r * spacingZ;

        // Verify bounds & margin containment before placing pendant
        if (isPointInWorldPolygon(px, pz, worldPolygon, margin)) {
          const pendantMatrix = new THREE.Matrix4();
          pendantMatrix.compose(
            new THREE.Vector3(px, height - 0.6, pz), // Y = 2.0m (flush cord top at 2.6m)
            quatNormal,
            new THREE.Vector3(1, 1, 1)
          );
          instances.pendant.push(pendantMatrix);
          addDebugPoint(px, pz);
        }
      }
    }

    const isHorizontal = wM >= hM;
    if (isHorizontal) {
      const czOffset = cz - hM / 6;
      const intervalDuct = getValidLineInterval(cx, 0.05, wM / 2, czOffset, true, worldPolygon, margin);
      const ductLen = intervalDuct.maxVal - intervalDuct.minVal;
      const ductCenter = (intervalDuct.minVal + intervalDuct.maxVal) / 2;

      if (ductLen > 0.8) {
        // Main exposed air duct
        const ductMatrix = new THREE.Matrix4();
        ductMatrix.compose(
          new THREE.Vector3(ductCenter, height - 0.2, czOffset), // Y = 2.4m
          quatNormal,
          new THREE.Vector3(ductLen, 1, 1)
        );
        instances.duct.push(ductMatrix);
      }

      const czOffsetPipe = cz + hM / 6;
      const intervalPipe = getValidLineInterval(cx, 0.05, wM / 2, czOffsetPipe, true, worldPolygon, margin);
      const pipeLen = intervalPipe.maxVal - intervalPipe.minVal;
      const pipeCenter = (intervalPipe.minVal + intervalPipe.maxVal) / 2;

      if (pipeLen > 0.8) {
        // Sprinkler pipe
        const pipeMatrix = new THREE.Matrix4();
        pipeMatrix.compose(
          new THREE.Vector3(pipeCenter, height - 0.15, czOffsetPipe),
          quatNormal,
          new THREE.Vector3(pipeLen, 1, 1)
        );
        instances.sprinklerPipe.push(pipeMatrix);

        // Hanging sprinkler heads
        const sCount = Math.max(1, Math.floor(pipeLen / 2.0));
        const sStartX = pipeCenter - ((sCount - 1) * 2.0) / 2;
        for (let i = 0; i < sCount; i++) {
          const sx = sStartX + i * 2.0;
          if (isPointInWorldPolygon(sx, czOffsetPipe, worldPolygon, margin)) {
            const sprinklerMatrix = new THREE.Matrix4();
            sprinklerMatrix.compose(
              new THREE.Vector3(sx, height - 0.15, czOffsetPipe),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.sprinklerHead.push(sprinklerMatrix);
          }
        }
      }
    } else {
      const quatRotated = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      const cxOffset = cx - wM / 6;
      const intervalDuct = getValidLineInterval(cz, 0.05, hM / 2, cxOffset, false, worldPolygon, margin);
      const ductLen = intervalDuct.maxVal - intervalDuct.minVal;
      const ductCenter = (intervalDuct.minVal + intervalDuct.maxVal) / 2;

      if (ductLen > 0.8) {
        const ductMatrix = new THREE.Matrix4();
        ductMatrix.compose(
          new THREE.Vector3(cxOffset, height - 0.2, ductCenter),
          quatRotated,
          new THREE.Vector3(ductLen, 1, 1)
        );
        instances.duct.push(ductMatrix);
      }

      const cxOffsetPipe = cx + wM / 6;
      const intervalPipe = getValidLineInterval(cz, 0.05, hM / 2, cxOffsetPipe, false, worldPolygon, margin);
      const pipeLen = intervalPipe.maxVal - intervalPipe.minVal;
      const pipeCenter = (intervalPipe.minVal + intervalPipe.maxVal) / 2;

      if (pipeLen > 0.8) {
        const pipeMatrix = new THREE.Matrix4();
        pipeMatrix.compose(
          new THREE.Vector3(cxOffsetPipe, height - 0.15, pipeCenter),
          quatRotated,
          new THREE.Vector3(pipeLen, 1, 1)
        );
        instances.sprinklerPipe.push(pipeMatrix);

        const sCount = Math.max(1, Math.floor(pipeLen / 2.0));
        const sStartZ = pipeCenter - ((sCount - 1) * 2.0) / 2;
        for (let i = 0; i < sCount; i++) {
          const sz = sStartZ + i * 2.0;
          if (isPointInWorldPolygon(cxOffsetPipe, sz, worldPolygon, margin)) {
            const sprinklerMatrix = new THREE.Matrix4();
            sprinklerMatrix.compose(
              new THREE.Vector3(cxOffsetPipe, height - 0.15, sz),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.sprinklerHead.push(sprinklerMatrix);
          }
        }
      }
    }
  } else {
    // STANDARD OFFICE AREAS: Recessed LED lights and HVAC vents
    const spacingX = 2.4;
    const spacingZ = 2.4;
    const cols = Math.max(1, Math.floor(wM / spacingX));
    const rows = Math.max(1, Math.floor(hM / spacingZ));
    const startX = cx - ((cols - 1) * spacingX) / 2;
    const startZ = cz - ((rows - 1) * spacingZ) / 2;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const px = startX + c * spacingX;
        const pz = startZ + r * spacingZ;

        // Check safety margin boundary containment
        if (isPointInWorldPolygon(px, pz, worldPolygon, margin)) {
          if ((c + r) % 2 === 0) {
            // Recessed Light Matrix (Y = 2.5925m, flush with 2.6m ceiling)
            const lightMatrix = new THREE.Matrix4();
            lightMatrix.compose(
              new THREE.Vector3(px, height - 0.0075, pz),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.recessedLight.push(lightMatrix);
            addDebugPoint(px, pz);
          } else {
            // HVAC Vent Matrix (Y = 2.5925m, flush with 2.6m ceiling)
            const ventMatrix = new THREE.Matrix4();
            ventMatrix.compose(
              new THREE.Vector3(px, height - 0.0075, pz),
              quatNormal,
              new THREE.Vector3(1, 1, 1)
            );
            instances.vent.push(ventMatrix);
          }
        }
      }
    }
  }
}

/**
 * Combines all accumulated instance transform lists into InstancedMesh instances.
 */
export function finalizeCeilingInfrastructure(infra, scene) {
  const { geoms, materials, instances, sceneAdd } = infra;

  // Add individual ceiling planes and debug helpers to the scene
  if (sceneAdd && sceneAdd.length > 0) {
    sceneAdd.forEach((mesh) => scene.add(mesh));
  }

  // Utility to create an InstancedMesh from transform matrix list
  const instantiateGroup = (name, geometry, material) => {
    const list = instances[name];
    if (!list || list.length === 0) return;

    const instMesh = new THREE.InstancedMesh(geometry, material, list.length);
    instMesh.castShadow = false;
    instMesh.receiveShadow = false;

    for (let i = 0; i < list.length; i++) {
      instMesh.setMatrixAt(i, list[i]);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    scene.add(instMesh);
  };

  // Build the ceiling hardware in exactly 7 draw calls
  instantiateGroup("recessedLight", geoms.recessedLightGeom, materials.ledGlow);
  instantiateGroup("linearLight", geoms.linearLightGeom, materials.ledGlow);
  instantiateGroup("vent", geoms.ventGeom, materials.metalDark);
  instantiateGroup("pendant", geoms.pendantGeom, materials.metalDark);
  instantiateGroup("duct", geoms.ductGeom, materials.metalSilver);
  instantiateGroup("sprinklerPipe", geoms.sprinklerPipeGeom, materials.sprinklerRed);
  instantiateGroup("sprinklerHead", geoms.sprinklerHeadGeom, materials.sprinklerRed);
}
