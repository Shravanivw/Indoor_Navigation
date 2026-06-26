import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "../css/Walk3D.css";

// Import modular room models and shared assets
import { initSharedResources, createRoomWalls, createPolygonWalls, findCorridorSegmentIndex } from "./models/ModelShared";
import { createOfficeDeskCluster } from "./models/OfficeDeskCluster";
import { createMeetingRoom } from "./models/MeetingRoomModel";
import { createReception } from "./models/ReceptionModel";
import { createPantry } from "./models/PantryModel";
import { createStaircase } from "./models/StaircaseModel";
import { createLift, createLiftLobby } from "./models/LiftModel";
import { createUtilityRoom } from "./models/UtilityRoomModel";
import { createBooth } from "./models/BoothModel";

const WALL_HEIGHT  = 2.7;
const EYE_HEIGHT   = 1.75;
const WALK_SPEED   = 1.4; // metres / second

function makeLabelSprite(text, colorHex = "#0C447C", bgAlpha = 0.93) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const r = 20;
  ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(canvas.width - r, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
  ctx.lineTo(canvas.width, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
  ctx.lineTo(r, canvas.height); ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 8;
  ctx.stroke();
  const maxChars = 18;
  const label = text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
  ctx.fillStyle = colorHex;
  ctx.font = "bold 72px DM Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(4, 1, 1);
  return sprite;
}

function getRoomTemplateType(room) {
  const type = (room.type ?? "").toUpperCase();
  const name = (room.name ?? "").toLowerCase();
  
  if (name.includes("lift lobby")) {
    return "LIFT_LOBBY";
  }
  if (type === "CORRIDOR" || name.includes("corridor") || name.includes("passage") || name.includes("walkway") || name.includes("hallway") || name.includes("lobby area")) {
    return "CORRIDOR";
  }
  if (type === "EXIT" || name.includes("stair") || name.includes("exit") || name.includes("escalator")) {
    return "STAIRCASE";
  }
  if (name.includes("lift") || name.includes("elevator")) {
    return "LIFT";
  }
  if (name.includes("booth") || name.includes("seating") || name.includes("sitting") || name.includes("sitting area")) {
    return "BOOTH";
  }
  if (type === "RECEPTION" || name.includes("reception") || name.includes("lobby") || name.includes("entrance")) {
    return "RECEPTION";
  }
  if (type === "PANTRY" || name.includes("cafeteria") || name.includes("pantry") || name.includes("food") || name.includes("cafe") || name.includes("dining")) {
    return "PANTRY";
  }
  if (type === "TOILET" || name.includes("restroom") || name.includes("toilet") || name.includes("washroom") || name.includes("shower")) {
    return "TOILET";
  }
  if (type === "SERVER_ROOM" || type === "STORAGE" || name.includes("server") || name.includes("storage") || name.includes("utility") || name.includes("ahu") || name.includes("ele") || name.includes("bms") || name.includes("janitor") || name.includes("hub") || name.includes("ups") || name.includes("av room") || name.includes("monitoring") || name.includes("repair") || name.includes("store")) {
    return "SERVER_ROOM";
  }
  if (type === "OPEN_WORKSPACE" || type === "WORKSPACE" || name.includes("workspace") || name.includes("innovation") || name.includes("hotdesk") || name.includes("desk") || name.includes("it bar") || name.includes("support")) {
    return "OPEN_WORKSPACE";
  }
  if (type === "MEETING_ROOM" || type === "BOARDROOM" || name.includes("meeting") || name.includes("board") || name.includes("cabin") || name.includes("conference") || name.includes("training")) {
    return "MEETING_ROOM";
  }
  return "OTHER";
}


export default function Walk3D({ floorMap, pathGridCells = [], destination, userRoom, livePosition = null }) {
  const mountRef = useRef(null);
  const livePosRef = useRef(livePosition);
  useEffect(() => { livePosRef.current = livePosition; }, [livePosition]);
  
  const stateRef = useRef({
    raf: 0,
    progress: 0,
    pathLengthM: 1,
    cumDist: [0],
    pathPoints: [],
    lastT: 0,
    yaw: null,
    cleanup: null,
  });

  const [arrived, setArrived]         = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [speedMul, setSpeedMul]       = useState(1);
  const [paused, setPaused]           = useState(false);

  const speedMulRef = useRef(1);
  const pausedRef   = useRef(false);
  
  useEffect(() => { speedMulRef.current = speedMul; }, [speedMul]);
  useEffect(() => { pausedRef.current   = paused;   }, [paused]);

  const SPEED_STEPS = [1, 2, 4];
  const cycleSpeed   = () => setSpeedMul(prev => SPEED_STEPS[(SPEED_STEPS.indexOf(prev) + 1) % SPEED_STEPS.length]);
  const togglePaused = () => setPaused(prev => !prev);

  useEffect(() => {
    if (!floorMap || !mountRef.current) return;

    const mount  = mountRef.current;
    const width  = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0xeef1f4);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xeef1f4, 16, 50);

    const camera = new THREE.PerspectiveCamera(72, width / height, 0.05, 200);

    // Initialize shared geometries/materials
    const resources = initSharedResources();
    const { geometries, materials } = resources;

    // ── LIGHTING ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(25, 40, 15);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-20, 25, -15);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ccd1, 0.5));

    // ── Coordinate helpers ──────────────────────────────────────────────────
    const gridCols = floorMap.gridCols ?? 80;
    const gridRows = floorMap.gridRows ?? 80;
    const realWidthM  = floorMap.realWidthM  ?? 73.579;
    const realHeightM = floorMap.realHeightM ?? 47.611;
    const cellSizeX = realWidthM / gridCols;
    const cellSizeZ = realHeightM / gridRows;

    const toWorld = (gx, gy) => ({
      x: (gx - gridCols / 2) * cellSizeX,
      z: (gridRows / 2 - gy) * cellSizeZ,
    });

    const widthM3d  = realWidthM;
    const heightM3d = realHeightM;
    const normPath = pathGridCells;

    // Floor (corridor texture as the backing default)
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM3d, heightM3d),
      materials.floorCorridor
    );
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM3d, heightM3d),
      materials.ceiling
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    scene.add(ceiling);

    // ── Rooms & Models ───────────────────────────────────────────────────────
    const rooms = floorMap.rooms ?? [];
    let destinationPin = null;
    const labelSprites = [];

    for (const r of rooms) {
      const isDest  = destination?.id === r.id;
      const isUser  = userRoom?.id === r.id;

      let cx, cz, wM, hM;
      if (Array.isArray(r.polygon) && r.polygon.length >= 3) {
        const pxs = r.polygon.map(p => p.x);
        const pys = r.polygon.map(p => p.y);
        const polyMinX = Math.min(...pxs), polyMaxX = Math.max(...pxs);
        const polyMinY = Math.min(...pys), polyMaxY = Math.max(...pys);
        const centerX  = (polyMinX + polyMaxX) / 2;
        const centerY  = (polyMinY + polyMaxY) / 2;
        const w = toWorld(centerX, centerY);
        cx = w.x; cz = w.z;
        wM = (polyMaxX - polyMinX) * cellSizeX;
        hM = (polyMaxY - polyMinY) * cellSizeZ;
      } else {
        const gridW = r.gridW ?? 4;
        const gridH = r.gridH ?? 4;
        const centerX = r.gridX + gridW / 2;
        const centerY = r.gridY - gridH / 2;
        const w = toWorld(centerX, centerY);
        cx = w.x; cz = w.z;
        wM = gridW * cellSizeX;
        hM = gridH * cellSizeZ;
      }

      // Safeguard sizes
      wM = Math.max(0.5, wM);
      hM = Math.max(0.5, hM);

      // Compute the polygon for this room (either actual polygon or generated from grid bounds)
      const roomPolygon = Array.isArray(r.polygon) && r.polygon.length >= 3
        ? r.polygon
        : [
            { x: r.gridX, y: r.gridY },
            { x: r.gridX + (r.gridW ?? 4), y: r.gridY },
            { x: r.gridX + (r.gridW ?? 4), y: r.gridY - (r.gridH ?? 4) },
            { x: r.gridX, y: r.gridY - (r.gridH ?? 4) }
          ];

      // Route through the template renderer
      const template = getRoomTemplateType(r);
      let roomModel = null;

      switch (template) {
        case "LIFT_LOBBY":
          roomModel = createLiftLobby(cx, cz, wM, hM, resources);
          break;
        case "CORRIDOR":
          // Keep corridors 100% open and clear of any walls/props
          roomModel = null;
          break;
        case "BOOTH":
          roomModel = createBooth(roomPolygon, cx, cz, wM, hM, r.name?.toLowerCase().includes("phone"), isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "RECEPTION":
          roomModel = createReception(cx, cz, wM, hM, resources);
          break;
        case "OPEN_WORKSPACE":
          roomModel = createOfficeDeskCluster(cx, cz, wM, hM, r.name?.toLowerCase().includes("innovation"), resources);
          break;
        case "MEETING_ROOM":
          roomModel = createMeetingRoom(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "PANTRY":
          roomModel = createPantry(cx, cz, wM, hM, r.name?.toLowerCase().includes("cafeteria"), resources);
          break;
        case "STAIRCASE":
          roomModel = createStaircase(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "LIFT":
          roomModel = createLift(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "SERVER_ROOM":
          roomModel = createUtilityRoom(roomPolygon, cx, cz, wM, hM, r.type === "SERVER_ROOM" || r.name?.toLowerCase().includes("server"), isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "TOILET":
          roomModel = new THREE.Group();
          const tDoorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
          roomModel.add(createPolygonWalls({ polygon: roomPolygon, wallHeight: 2.6, wallThickness: 0.12, material: isDest ? materials.wallDest : materials.wallNormal, doorSegmentIndex: tDoorIndex, doorWidth: 0.8, resources, toWorld }));
          // Toilet floor
          const tFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorTile);
          tFloor.rotation.x = -Math.PI / 2;
          tFloor.position.set(cx, 0.012, cz);
          roomModel.add(tFloor);
          // Privacy divider screen
          if (wM > 2.0) {
            const pScreen = new THREE.Mesh(geometries.box, materials.metalDark);
            pScreen.scale.set(0.04, 1.8, Math.min(1.6, hM * 0.5));
            pScreen.position.set(cx, 0.9, cz);
            roomModel.add(pScreen);
          }
          break;
        case "OTHER":
        default:
          roomModel = new THREE.Group();
          const oDoorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
          roomModel.add(createPolygonWalls({ polygon: roomPolygon, wallHeight: 2.6, wallThickness: 0.12, material: isDest ? materials.wallDest : materials.wallNormal, doorSegmentIndex: oDoorIndex, doorWidth: 0.8, resources, toWorld }));
          
          // Office floor plate
          const oFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorCarpet);
          oFloor.rotation.x = -Math.PI / 2;
          oFloor.position.set(cx, 0.012, cz);
          roomModel.add(oFloor);

          // Standard simple desk
          const desk = new THREE.Mesh(geometries.box, materials.deskSurface);
          desk.scale.set(Math.min(1.2, wM * 0.5), 0.75, Math.min(0.6, hM * 0.4));
          desk.position.set(cx, 0.375, cz);
          roomModel.add(desk);
          break;
      }

      if (roomModel) {
        scene.add(roomModel);
      }

      // Add local point spotlight for warm interior lighting in key landmarks
      if (template === "RECEPTION" || template === "MEETING_ROOM" || template === "PANTRY") {
        const localSpot = new THREE.PointLight(0xffecc4, 0.6, 6.0);
        localSpot.position.set(cx, 2.3, cz);
        scene.add(localSpot);
      }

      // Render Label Sprite floating just below the ceiling level (Y = 2.4)
      if (template !== "CORRIDOR") {
        const labelColor = isDest ? "#059669" : isUser ? "#1d4ed8" : "#374151";
        const label = makeLabelSprite(r.name, labelColor, isDest ? 0.97 : 0.88);
        label.position.set(cx, 2.4, cz);
        // Reduced label size dramatically to avoid eye-level blocking
        label.scale.set(Math.min(4.0, Math.max(1.8, wM * 0.45)), 0.85, 1.0);
        scene.add(label);

        labelSprites.push({
          sprite: label,
          cx, cz,
          template,
          isDest,
          isUser,
          name: r.name
        });
      }
    }

    // ── Destination Landmark Floating Pin ──────────────────────────────────
    if (destination && rooms.length > 0) {
      const destRoom = rooms.find(r => r.id === destination.id);
      if (destRoom) {
        let dcx, dcz;
        if (Array.isArray(destRoom.polygon) && destRoom.polygon.length >= 3) {
          const pxs = destRoom.polygon.map(p => p.x);
          const pys = destRoom.polygon.map(p => p.y);
          dcx = (Math.min(...pxs) + Math.max(...pxs)) / 2;
          dcz = (Math.min(...pys) + Math.max(...pys)) / 2;
        } else {
          dcx = destRoom.gridX + (destRoom.gridW ?? 4) / 2;
          dcz = destRoom.gridY - (destRoom.gridH ?? 4) / 2;
        }
        const dw = toWorld(dcx, dcz);

        const pinGroup = new THREE.Group();

        // Pin Top Sphere
        const pinSphere = new THREE.Mesh(
          geometries.sphere,
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x10b981,
            emissiveIntensity: 0.2,
          })
        );
        pinSphere.scale.set(0.46, 0.46, 0.46);
        pinSphere.position.y = 0.6;
        pinGroup.add(pinSphere);

        // Pin Point Cone
        const pinCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.5, 16),
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x10b981,
            emissiveIntensity: 0.2,
          })
        );
        pinCone.rotation.x = Math.PI;
        pinCone.position.y = 0.25;
        pinGroup.add(pinCone);

        // Floor ring indicator
        const ringGeom = new THREE.RingGeometry(0.1, 0.5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const floorRing = new THREE.Mesh(ringGeom, ringMat);
        floorRing.rotation.x = -Math.PI / 2;
        floorRing.position.y = 0.05;
        pinGroup.add(floorRing);

        pinGroup.position.set(dw.x, 1.35, dw.z);
        scene.add(pinGroup);
        destinationPin = pinGroup;
      }
    }

    // ── Outer boundary walls ─────────────────────────────────────────────────
    const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x8a939e, roughness: 0.92 });
    const bt = 0.4;
    for (const b of [
      { x: 0,             z: -heightM3d/2, w: widthM3d, d: bt },
      { x: 0,             z:  heightM3d/2, w: widthM3d, d: bt },
      { x: -widthM3d/2,   z: 0,            w: bt,        d: heightM3d },
      { x:  widthM3d/2,   z: 0,            w: bt,        d: heightM3d },
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, WALL_HEIGHT, b.d), boundaryMat,
      );
      mesh.position.set(b.x, WALL_HEIGHT/2, b.z);
      scene.add(mesh);
    }

    // ── Path: world-space points ─────────────────────────────────────────────
    // Lift the path to float slightly above the ground (Y = 0.16)
    const pathPoints = normPath.map(c => {
      const { x, z } = toWorld(c.x + 0.5, c.y + 0.5);
      return new THREE.Vector3(x, 0.16, z);
    });

    stateRef.current.pathPoints = pathPoints;

    const cumDist = [0];
    for (let i = 1; i < pathPoints.length; i++) {
      cumDist.push(cumDist[i-1] + pathPoints[i].distanceTo(pathPoints[i-1]));
    }
    const pathLengthM = cumDist[cumDist.length-1] || 1;
    stateRef.current.cumDist     = cumDist;
    stateRef.current.pathLengthM = pathLengthM;

    if (pathPoints.length >= 1) {
      // Configure chevrons repeat count relative to length
      const arrowTex = resources.textures.arrowTex;
      if (arrowTex) {
        arrowTex.repeat.set(pathLengthM * 1.5, 1);
      }

      // Render flowing tube path as a single continuous curve
      if (pathPoints.length >= 2) {
        const curve = new THREE.CurvePath();
        for (let i = 1; i < pathPoints.length; i++) {
          curve.add(new THREE.LineCurve3(pathPoints[i-1], pathPoints[i]));
        }
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.max(10, pathPoints.length * 2), 0.16, 8, false),
          materials.pathArrows
        );
        scene.add(tube);
      }

      // User starting position dot (blue)
      const startDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1d4ed8, emissiveIntensity: 0.5 }),
      );
      startDot.position.copy(pathPoints[0]);
      startDot.position.y = 0.3;
      scene.add(startDot);

      // Route destination position dot (green)
      if (pathPoints.length >= 2) {
        const endDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 24, 24),
          new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x059669, emissiveIntensity: 0.5 }),
        );
        const end = pathPoints[pathPoints.length-1];
        endDot.position.copy(end);
        endDot.position.y = 0.3;
        scene.add(endDot);
      }
    }

    function sampleAt(progress) {
      const target = Math.max(0, Math.min(1, progress)) * pathLengthM;
      for (let i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= target) {
          const segLen = cumDist[i] - cumDist[i-1] || 1;
          const t = (target - cumDist[i-1]) / segLen;
          const p = pathPoints[i-1].clone().lerp(pathPoints[i], t);
          const dir = pathPoints[i].clone().sub(pathPoints[i-1]);
          return { pos: p, yaw: Math.atan2(dir.x, dir.z) };
        }
      }
      return { pos: pathPoints[pathPoints.length-1] ?? new THREE.Vector3(), yaw: 0 };
    }

    function progressFromLive(gx, gy) {
      if (pathPoints.length < 2) return 0;
      const { x: wx, z: wz } = toWorld(gx, gy);
      let bestDist = Infinity, bestArc = 0;
      for (let i = 1; i < pathPoints.length; i++) {
        const a = pathPoints[i-1], b = pathPoints[i];
        const dx = b.x-a.x, dz = b.z-a.z;
        const segLen2 = dx*dx + dz*dz;
        if (segLen2 < 1e-9) continue;
        let t = ((wx-a.x)*dx + (wz-a.z)*dz) / segLen2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x+t*dx, pz = a.z+t*dz;
        const d2 = (wx-px)**2 + (wz-pz)**2;
        if (d2 < bestDist) { bestDist = d2; bestArc = cumDist[i-1] + t*Math.sqrt(segLen2); }
      }
      return bestArc / pathLengthM;
    }

    stateRef.current.progress = 0;
    stateRef.current.yaw = null;
    setArrived(false);
    setProgressPct(0);

    const lerpAngle = (from, to, t) => {
      let diff = ((to - from + Math.PI) % (Math.PI*2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI*2;
      return from + diff*t;
    };

    function tick(t) {
      const s = stateRef.current;
      const dt = Math.min(0.05, (t - (s.lastT || t)) / 1000);
      s.lastT = t;

      // 1. Flowing navigation arrows animation
      if (materials.pathArrows?.map) {
        materials.pathArrows.map.offset.x -= 0.4 * dt * speedMulRef.current;
      }

      // 2. Bobbing & spinning destination pin animation
      if (destinationPin) {
        destinationPin.position.y = 1.35 + Math.sin(t * 0.003) * 0.12;
        destinationPin.rotation.y += 0.015 * speedMulRef.current;
        const floorRing = destinationPin.children[2];
        if (floorRing) {
          const sVal = 1.0 + Math.sin(t * 0.006) * 0.25;
          floorRing.scale.set(sVal, sVal, 1);
          floorRing.material.opacity = 0.8 - (sVal - 0.75) * 0.8;
        }
      }

      // 2.5 LOD Label Fading Animation
      labelSprites.forEach(item => {
        const dist = camera.position.distanceTo(item.sprite.position);
        const nameL = (item.name ?? "").toLowerCase();
        const isImportant = item.isDest || item.isUser || 
          item.template === "RECEPTION" || 
          item.template === "LIFT_LOBBY" || 
          item.template === "PANTRY" || 
          item.template === "STAIRCASE" || 
          item.template === "LIFT" || 
          nameL.includes("board") || 
          nameL.includes("conference") ||
          nameL.includes("innovation") ||
          nameL.includes("meeting");

        if (!isImportant) {
          item.sprite.visible = false;
        } else {
          item.sprite.visible = true;
          // Fade close labels to prevent camera obstruction
          if (dist < 2.0) {
            item.sprite.material.opacity = 0.0;
          } else if (dist <= 5.0) {
            item.sprite.material.opacity = (dist - 2.0) / 3.0;
          } else {
            item.sprite.material.opacity = 1.0;
          }
        }
      });

      // 3. Movement and camera logic
      if (pathPoints.length >= 2 && pathLengthM > 0) {
        if (!pausedRef.current) {
          const live = livePosRef.current;
          if (live && typeof live.gx === "number" && typeof live.gy === "number") {
            s.progress = progressFromLive(live.gx, live.gy);
          } else if (s.progress < 1) {
            s.progress = Math.min(1, s.progress + (WALK_SPEED * speedMulRef.current * dt) / pathLengthM);
          }
          setProgressPct(Math.round(s.progress * 100));
        }

        const lookAheadM   = 1.5;
        const aheadProgress = Math.min(1, s.progress + lookAheadM / pathLengthM);
        const { pos }       = sampleAt(s.progress);
        const { yaw: targetYaw } = sampleAt(aheadProgress);

        if (s.yaw === null) s.yaw = targetYaw;
        else { const k = 1 - Math.exp(-6*dt); s.yaw = lerpAngle(s.yaw, targetYaw, k); }

        camera.position.set(pos.x, EYE_HEIGHT, pos.z);
        camera.lookAt(pos.x + Math.sin(s.yaw), EYE_HEIGHT, pos.z + Math.cos(s.yaw));
        const here = s.progress >= 0.995;
        setArrived(prev => (prev === here ? prev : here));
      }

      renderer.render(scene, camera);
      s.raf = requestAnimationFrame(tick);
    }
    stateRef.current.raf = requestAnimationFrame(tick);

    function handleResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    stateRef.current.cleanup = () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      
      // Safety teardown: Dispose ONLY local scene assets to protect globally cached textures/materials
      scene.traverse(obj => {
        if (obj.geometry && !obj.geometry.isShared) {
          obj.geometry.dispose?.();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            if (!m.isShared) {
              if (m.map && !m.map.isShared) m.map.dispose?.();
              m.dispose?.();
            }
          });
        }
      });
      if (renderer.domElement?.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    return () => { stateRef.current.cleanup?.(); };
  }, [floorMap, pathGridCells, destination, userRoom]);

  const hasPath = pathGridCells.length >= 2;

  return (
    <div className="walk3d-wrap" onClick={togglePaused}>
      <div ref={mountRef} className="walk3d-mount" />

      {!hasPath && (
        <div className="walk3d-hint">Pick a destination to walk through it in 3D.</div>
      )}
      {arrived && (
        <div className="walk3d-arrived">You've arrived at {destination?.name || "your destination"} </div>
      )}
      {hasPath && (
        <div className="walk3d-progress" aria-label="Progress along route">
          <div className="walk3d-progress-fill" style={{ width: `${progressPct}%` }} />
          <div className="walk3d-progress-label">{progressPct}%</div>
        </div>
      )}
      {hasPath && (
        <button
          type="button"
          className="walk3d-speed"
          onClick={e => { e.stopPropagation(); cycleSpeed(); }}
          aria-label={`Walk speed ${speedMul}x. Click to change.`}
          title="Change walk speed"
        >
          {speedMul}× Speed
        </button>
      )}
    </div>
  );
}
