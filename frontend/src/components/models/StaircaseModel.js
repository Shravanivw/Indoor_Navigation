import * as THREE from "three";
import { createRoomWalls } from "./ModelShared";

export function createStaircase(cx, cz, wM, hM, isDest, isUser, resources) {
  const group = new THREE.Group();
  const { geometries, materials } = resources;
  const boxGeom = geometries.box;
  const cylGeom = geometries.cylinder;

  const wt = 0.15;
  const wallHeight = 2.6;
  const wallMat = isDest ? materials.wallDest : materials.wallNormal;

  // 1. Build walls with a doorway on the South wall (facing the corridor)
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
      doorWidth: 1.0,
      doorHeight: 2.1,
      resources
    })
  );

  // 2. Build Stair Steps ascending inside the stairwell
  // We place steps ascending from South to North, or North to South depending on the layout.
  // Standard stair width: 1.2m
  // Let's draw a straight flight of stairs starting at the South side ascending to the North.
  const stairW = Math.min(1.3, wM - 0.4);
  const stairL = hM - 0.6;
  const numSteps = 12;
  const stepRise = wallHeight / (numSteps + 2); // Rise per step
  const stepRun  = stairL / numSteps;          // Run per step

  const stairGroup = new THREE.Group();
  stairGroup.position.set(cx - wM / 2 + stairW / 2 + 0.2, 0, cz - stairL / 2);

  // Concrete support diagonal stringer slab
  const stringer = new THREE.Mesh(boxGeom, materials.wallNormal);
  stringer.scale.set(stairW, 0.15, stairL);
  stringer.position.set(0, wallHeight / 2 - 0.2, stairL / 2);
  stringer.rotation.x = Math.atan2(wallHeight - 0.4, stairL);
  stairGroup.add(stringer);

  // Individual steps
  for (let i = 0; i < numSteps; i++) {
    const step = new THREE.Mesh(boxGeom, materials.floorTile); // Tile finish steps
    const stepHeight = 0.08;
    step.scale.set(stairW, stepHeight, stepRun + 0.05);

    const stepY = i * stepRise + stepHeight / 2;
    const stepZ = i * stepRun + stepRun / 2;

    step.position.set(0, stepY, stepZ);
    stairGroup.add(step);
  }

  // Staircase landing platform at the top
  const landingW = wM - 0.4;
  const landingD = 0.7;
  const landing = new THREE.Mesh(boxGeom, materials.floorTile);
  landing.scale.set(landingW, 0.08, landingD);
  landing.position.set(cx, wallHeight - stepRise * 2, cz - hM / 2 + landingD / 2 + 0.1);
  group.add(landing);

  // 3. Railing (handrail cylinders/box frames running along the side of the stairs)
  const railMat = materials.metalSilver;
  const railGroup = new THREE.Group();
  railGroup.position.copy(stairGroup.position);

  // Posts
  const numPosts = 4;
  const postSpacing = stairL / (numPosts - 1);
  for (let i = 0; i < numPosts; i++) {
    const postZ = i * postSpacing;
    const postY = i * stepRise + 0.45; // post height is 0.9m above the step

    const post = new THREE.Mesh(cylGeom, railMat);
    post.scale.set(0.025, 0.9, 0.025);
    post.position.set(stairW / 2 - 0.03, postY, postZ);
    railGroup.add(post);
  }

  // Handrail bar (diagonal box running above the posts)
  const handrail = new THREE.Mesh(boxGeom, railMat);
  const handrailLength = Math.sqrt(stairL * stairL + (stepRise * numSteps) * (stepRise * numSteps));
  handrail.scale.set(0.04, 0.04, handrailLength);
  handrail.position.set(stairW / 2 - 0.03, wallHeight / 2 + 0.45, stairL / 2);
  handrail.rotation.x = Math.atan2(stepRise * numSteps, stairL);
  railGroup.add(handrail);

  group.add(railGroup);

  return group;
}
