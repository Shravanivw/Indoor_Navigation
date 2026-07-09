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
import { initCeilingInfrastructure, addRoomCeiling, finalizeCeilingInfrastructure } from "./models/CeilingInfrastructure";

// Layout Resolver and Furniture Generator
import { resolveRoomLayout } from "./layouts/LayoutResolver";
import { generateFurniture } from "./layouts/FurnitureLayoutGenerator";
import { layoutExecutiveDesk } from "./layouts/LayoutModules";
import { createPrinter, createSofaUnit, createWhiteboardUnit, createPlantUnit } from "./layouts/FurnitureModels";

const WALL_HEIGHT  = 3.0;
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

function isCabinRoom(room) {
  const nameLower = (room.name ?? "").toLowerCase();
  const type = (room.type ?? "").toUpperCase();
  if (nameLower.includes("dining") || nameLower.includes("toilet") || nameLower.includes("restroom") || nameLower.includes("lobby")) {
    return false;
  }
  const cabinKeywords = [
    "cabin", "ciso", "director", "manager", "ctio", "cfo", "vp", 
    "executive", "president", "officer", "head", "mulliner"
  ];
  if (cabinKeywords.some(keyword => nameLower.includes(keyword))) {
    return true;
  }
  if (type === "OFFICE" && (nameLower.includes("security") || nameLower.includes("soc room") || nameLower.includes("office"))) {
    return true;
  }
  return false;
}

function getRoomTemplateType(room, isFloor6Or7 = false) {
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
  if (type === "SERVER_ROOM" || type === "STORAGE" || name.includes("server") || name.includes("storage") || name.includes("utility") || name.includes("ahu") || name.includes("ele") || name.includes("bms") || name.includes("janitor") || name.includes("hub") || name.includes("ups") || name.includes("av room") || name.includes("monitoring") || name.includes("repair") || name.includes("store") || (isFloor6Or7 && name.includes("battery"))) {
    if (isFloor6Or7 && name.includes("thinking")) {
      // Let it fall through to OTHER/MEETING_ROOM since it's a collab room, not utility
    } else {
      return "SERVER_ROOM";
    }
  }
  if (type === "OPEN_WORKSPACE" || type === "WORKSPACE" || name.includes("workspace") || name.includes("innovation") || name.includes("hotdesk") || name.includes("desk") || name.includes("it bar") || name.includes("support") || (isFloor6Or7 && (name.includes("lab") || name.includes("noc") || name.includes("gui") || name.includes("big data") || name.includes("workstation")))) {
    return "OPEN_WORKSPACE";
  }
  if (type === "MEETING_ROOM" || type === "BOARDROOM" || name.includes("meeting") || name.includes("board") || name.includes("cabin") || name.includes("conference") || name.includes("training") || (isFloor6Or7 && (name.includes("pax") || name.includes("nerd") || name.includes("lean") || name.includes("ciso") || name.includes("office") || name.includes("adaptive") || name.includes("opensource")))) {
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

    // Ceiling Infrastructure
    const ceilingInfra = initCeilingInfrastructure(scene, resources);

    // ── Rooms & Models ───────────────────────────────────────────────────────
    const rooms = floorMap.rooms ?? [];
    const isFloor6Or7 = String(floorMap?.level) === "6" || String(floorMap?.level) === "7";
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
      const template = getRoomTemplateType(r, isFloor6Or7);
      let roomModel = null;

      switch (template) {
        case "LIFT_LOBBY":
          roomModel = createLiftLobby(cx, cz, wM, hM, resources);
          break;
        case "CORRIDOR":
          // Keep corridors 100% open and clear of any walls/props
          roomModel = null;
          break;
        case "BOOTH": {
          const nameLower = r.name?.toLowerCase() ?? "";
          const isSittingArea = nameLower.includes("sitting area");
          roomModel = createBooth(roomPolygon, cx, cz, wM, hM, nameLower.includes("phone"), isDest, isUser, resources, toWorld, floorMap.grid, isSittingArea);
          break;
        }
        case "RECEPTION":
          roomModel = createReception(cx, cz, wM, hM, resources);
          break;
        case "OPEN_WORKSPACE": {
          const layoutConfig = resolveRoomLayout(r, floorMap);
          let furnitureModel = null;
          if (layoutConfig) {
            furnitureModel = generateFurniture(layoutConfig, cx, cz, wM, hM, resources);
          } else {
            const nameLower = r.name?.toLowerCase() ?? "";
            furnitureModel = createOfficeDeskCluster(cx, cz, wM, hM, nameLower.includes("innovation"), resources, nameLower.includes("it bar"));
          }

          const nameLower = r.name?.toLowerCase() ?? "";
          const isClosedWorkspace = isFloor6Or7 && (
            nameLower.includes("lab") ||
            nameLower.includes("noc") ||
            nameLower.includes("gui") ||
            nameLower.includes("big data") ||
            nameLower.includes("workstation")
          );

          if (isClosedWorkspace) {
            roomModel = new THREE.Group();
            
            // 1. Walls: glass front wall, solid side/rear walls
            const doorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
            roomModel.add(createPolygonWalls({
              polygon: roomPolygon,
              wallHeight: 3.0,
              wallThickness: 0.12,
              material: isDest ? materials.wallDest : materials.wallNormal,
              doorSegmentIndex: doorIndex,
              glassDoor: true,
              glassWalls: false,
              resources,
              toWorld
            }));
            
            // 2. Floor: Carpet
            const oFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorCarpet);
            oFloor.rotation.x = -Math.PI / 2;
            oFloor.position.set(cx, 0.012, cz);
            roomModel.add(oFloor);
            
            // 3. Furniture
            roomModel.add(furnitureModel);
            
            // 4. Add printer station where appropriate
            if (nameLower.includes("noc") || nameLower.includes("lab")) {
              roomModel.add(createPrinter(cx + wM / 2.8, cz - hM / 2.8, resources));
            }
          } else {
            roomModel = furnitureModel;
          }
          break;
        }
        case "MEETING_ROOM": {
          const nameLower = r.name?.toLowerCase() ?? "";
          const isBoardRoom = nameLower.includes("board");
          
          if (isFloor6Or7) {
            // Render Floor 6/7 Meeting Rooms (with glass front corridor walls)
            roomModel = new THREE.Group();
            
            // 1. Walls: glass front wall facing corridor, solid side/rear walls
            const doorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
            const hasGlassWalls = nameLower.includes("opensource") || nameLower.includes("adaptive");
            roomModel.add(createPolygonWalls({
              polygon: roomPolygon,
              wallHeight: 3.0,
              wallThickness: 0.12,
              material: isDest ? materials.wallDest : materials.wallNormal,
              doorSegmentIndex: doorIndex,
              glassDoor: true,
              glassWalls: hasGlassWalls,
              resources,
              toWorld
            }));
            
            // 2. Floor: Carpet Rug + carpet floor
            const oFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorCarpet);
            oFloor.rotation.x = -Math.PI / 2;
            oFloor.position.set(cx, 0.012, cz);
            roomModel.add(oFloor);
            
            if (isCabinRoom(r)) {
              // 3. Furniture: Reusable executive office layout module
              const execFurniture = layoutExecutiveDesk(cx, cz, wM, hM, resources);
              roomModel.add(execFurniture);
            } else {
              const tableW = Math.max(1.2, Math.min(wM * 0.62, 4.2));
              const tableD = Math.max(0.7, Math.min(hM * 0.42, 1.8));
              const rug = new THREE.Mesh(
                new THREE.PlaneGeometry(tableW + 1.2, tableD + 1.2),
                materials.floorCarpet
              );
              rug.rotation.x = -Math.PI / 2;
              rug.position.set(cx, 0.015, cz);
              roomModel.add(rug);
              
              // 3. Conference Table
              const tableTop = new THREE.Mesh(geometries.box, materials.deskWood);
              tableTop.scale.set(tableW, 0.05, tableD);
              tableTop.position.set(cx, 0.75, cz);
              roomModel.add(tableTop);
              
              if (tableW > 1.8) {
                const drum1 = new THREE.Mesh(geometries.cylinder, materials.metalDark);
                drum1.scale.set(0.4, 0.72, 0.4);
                drum1.position.set(cx - tableW / 4, 0.36, cz);
                roomModel.add(drum1);
                const drum2 = new THREE.Mesh(geometries.cylinder, materials.metalDark);
                drum2.scale.set(0.4, 0.72, 0.4);
                drum2.position.set(cx + tableW / 4, 0.36, cz);
                roomModel.add(drum2);
              } else {
                const drum = new THREE.Mesh(geometries.cylinder, materials.metalDark);
                drum.scale.set(0.35, 0.72, 0.35);
                drum.position.set(cx, 0.36, cz);
                roomModel.add(drum);
              }
              
              // 4. Executive Chairs
              const chairSpacing = 0.65;
              const numChairsPerSide = Math.max(1, Math.floor(tableW / chairSpacing));
              const chairStartX = cx - ((numChairsPerSide - 1) * chairSpacing) / 2;
              
              const createMeetingChair = (chX, chZ, rotY) => {
                const chairGroup = new THREE.Group();
                chairGroup.position.set(chX, 0, chZ);
                chairGroup.rotation.y = rotY;
                
                const base = new THREE.Mesh(geometries.box, materials.chairBase);
                base.scale.set(0.38, 0.02, 0.38);
                base.position.y = 0.05;
                chairGroup.add(base);
                
                const shaft = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
                shaft.scale.set(0.04, 0.36, 0.04);
                shaft.position.y = 0.23;
                chairGroup.add(shaft);
                
                const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
                seat.scale.set(0.44, 0.08, 0.42);
                seat.position.y = 0.45;
                chairGroup.add(seat);
                
                const back = new THREE.Mesh(geometries.box, materials.chairFabric);
                back.scale.set(0.4, 0.5, 0.06);
                back.position.set(0, 0.76, 0.18);
                chairGroup.add(back);
                
                return chairGroup;
              };
              
              for (let i = 0; i < numChairsPerSide; i++) {
                const x = chairStartX + i * chairSpacing;
                roomModel.add(createMeetingChair(x, cz - tableD / 2 - 0.32, Math.PI));
                roomModel.add(createMeetingChair(x, cz + tableD / 2 + 0.32, 0));
              }
              
              if (tableW > 2.2) {
                roomModel.add(createMeetingChair(cx + tableW / 2 + 0.32, cz, -Math.PI / 2));
                roomModel.add(createMeetingChair(cx - tableW / 2 - 0.32, cz, Math.PI / 2));
              }
              
              // 5. TV Display + Whiteboard + Plant
              const tvGroup = new THREE.Group();
              tvGroup.position.set(cx, 1.4, cz - tableD / 2 - 0.85);
              const tvBezel = new THREE.Mesh(geometries.box, materials.metalDark);
              tvBezel.scale.set(1.2, 0.7, 0.04);
              tvGroup.add(tvBezel);
              const tvScreen = new THREE.Mesh(geometries.box, materials.screenGlow);
              tvScreen.scale.set(1.15, 0.65, 0.005);
              tvScreen.position.z = 0.022;
              tvGroup.add(tvScreen);
              roomModel.add(tvGroup);
              
              roomModel.add(createWhiteboardUnit(cx - wM / 2.5, cz + hM / 2.5, Math.PI / 4, resources));
              roomModel.add(createPlantUnit(cx + wM / 2.5, cz - hM / 2.5, resources));
            }
          } else {
            // Original logic for Floor 5
            const isGlassCabin = nameLower.includes("cabin") && (
              nameLower.includes("1") ||
              nameLower.includes("2") ||
              nameLower.includes("3") ||
              nameLower.includes("ctio")
            );
            roomModel = createMeetingRoom(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid, isBoardRoom || isGlassCabin, isCabinRoom(r));
          }
          break;
        }
        case "PANTRY": {
          const nameLower = r.name?.toLowerCase() ?? "";
          const isCafeteriaOrDining = nameLower.includes("cafeteria") || nameLower.includes("dining");
          roomModel = createPantry(roomPolygon, cx, cz, wM, hM, isCafeteriaOrDining, isDest, isUser, resources, toWorld, floorMap.grid, isFloor6Or7);
          break;
        }
        case "STAIRCASE":
          roomModel = createStaircase(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "LIFT":
          roomModel = createLift(roomPolygon, cx, cz, wM, hM, isDest, isUser, resources, toWorld, floorMap.grid);
          break;
        case "SERVER_ROOM": {
          const nameLower = r.name?.toLowerCase() ?? "";
          // DMS Monitoring and Laptop Repair Room have glass walls. IT Store is opaque.
          const isGlassUtility = nameLower.includes("monitoring") || nameLower.includes("repair") || nameLower.includes("av room");
          const isServer = r.type === "SERVER_ROOM" || nameLower.includes("server") || nameLower.includes("ups") || nameLower.includes("battery");
          roomModel = createUtilityRoom(roomPolygon, cx, cz, wM, hM, isServer, isDest, isUser, resources, toWorld, floorMap.grid, isGlassUtility);
          
          if (isFloor6Or7 && roomModel) {
            // Add tile floor plate to the utility room model
            const uFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorTile);
            uFloor.rotation.x = -Math.PI / 2;
            uFloor.position.set(cx, 0.012, cz);
            roomModel.add(uFloor);
          }
          break;
        }
        case "TOILET":
          roomModel = new THREE.Group();
          const tDoorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
          roomModel.add(createPolygonWalls({ polygon: roomPolygon, wallHeight: 3.0, wallThickness: 0.12, material: isDest ? materials.wallDest : materials.wallNormal, doorSegmentIndex: tDoorIndex, doorWidth: 0.8, resources, toWorld }));
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
        default: {
          roomModel = new THREE.Group();
          const oDoorIndex = findCorridorSegmentIndex(roomPolygon, floorMap.grid);
          const nameLower = r.name?.toLowerCase() ?? "";
          const isPKIRoom = nameLower.includes("pki");
          const isGlassRoom = nameLower.includes("informal") || nameLower.includes("ml room") || nameLower.includes("aws room") || isPKIRoom || nameLower.includes("vr lab") || nameLower.includes("medical room") || (isFloor6Or7 && (nameLower.includes("thinking") || nameLower.includes("huddle") || nameLower.includes("breakout") || nameLower.includes("lounge")));
          const isCabin = isCabinRoom(r);
          roomModel.add(createPolygonWalls({
            polygon: roomPolygon,
            wallHeight: 3.0,
            wallThickness: 0.12,
            material: isDest ? materials.wallDest : materials.wallNormal,
            doorSegmentIndex: oDoorIndex,
            doorWidth: 0.8,
            resources,
            toWorld,
            glassDoor: isGlassRoom || isCabin,
            glassWalls: isGlassRoom
          }));
          
          // Office floor plate
          const oFloor = new THREE.Mesh(new THREE.PlaneGeometry(wM - 0.05, hM - 0.05), materials.floorCarpet);
          oFloor.rotation.x = -Math.PI / 2;
          oFloor.position.set(cx, 0.012, cz);
          roomModel.add(oFloor);

          if (nameLower.includes("informal") || nameLower.includes("huddle") || nameLower.includes("thinking") || nameLower.includes("breakout") || nameLower.includes("lounge")) {
            // ── INFORMAL ROOM COLLABORATION SETUP ──
            // Center Round Coffee Table
            const tableTop = new THREE.Mesh(geometries.cylinder, materials.deskWood);
            tableTop.scale.set(0.9, 0.04, 0.9);
            tableTop.position.set(cx, 0.6, cz);
            roomModel.add(tableTop);
            
            const tableShift = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
            tableShift.scale.set(0.06, 0.58, 0.06);
            tableShift.position.set(cx, 0.29, cz);
            roomModel.add(tableShift);
            
            const tableBase = new THREE.Mesh(geometries.cylinder, materials.metalDark);
            tableBase.scale.set(0.4, 0.02, 0.4);
            tableBase.position.set(cx, 0.01, cz);
            roomModel.add(tableBase);

            // 3 comfortable lounge chairs
            const createLoungeChair = (angle) => {
              const chair = new THREE.Group();
              const dist = 0.65;
              chair.position.set(cx + Math.cos(angle) * dist, 0, cz + Math.sin(angle) * dist);
              chair.rotation.y = -angle - Math.PI / 2;

              // Cushion seat
              const seat = new THREE.Mesh(geometries.box, materials.cushionLounge);
              seat.scale.set(0.45, 0.35, 0.45);
              seat.position.y = 0.175;
              chair.add(seat);

              // Backrest
              const back = new THREE.Mesh(geometries.box, materials.cushionLounge);
              back.scale.set(0.45, 0.4, 0.1);
              back.position.set(0, 0.4, 0.185);
              chair.add(back);

              return chair;
            };
            
            roomModel.add(createLoungeChair(0));
            roomModel.add(createLoungeChair((Math.PI * 2) / 3));
            roomModel.add(createLoungeChair((Math.PI * 4) / 3));
            
          } else if (nameLower.includes("pax") || nameLower.includes("ml room") || nameLower.includes("aws room")) {
            // ── 4 PAX MEETING ROOM SETUP ──
            // Rectangular Table
            const tableW = Math.max(1.2, Math.min(wM * 0.6, 1.6));
            const tableD = Math.max(0.7, Math.min(hM * 0.4, 0.9));
            const tableTop = new THREE.Mesh(geometries.box, materials.deskWood);
            tableTop.scale.set(tableW, 0.04, tableD);
            tableTop.position.set(cx, 0.75, cz);
            roomModel.add(tableTop);

            // Table legs
            const legW = 0.06;
            for (const [lx, lz] of [
              [tableW / 2 - 0.08, tableD / 2 - 0.08],
              [-tableW / 2 + 0.08, tableD / 2 - 0.08],
              [tableW / 2 - 0.08, -tableD / 2 + 0.08],
              [-tableW / 2 + 0.08, -tableD / 2 + 0.08]
            ]) {
              const leg = new THREE.Mesh(geometries.box, materials.metalDark);
              leg.scale.set(legW, 0.73, legW);
              leg.position.set(cx + lx, 0.365, cz + lz);
              roomModel.add(leg);
            }

            // 4 Executive/Office chairs
            const createOfficeChair = (chX, chZ, rotY) => {
              const chair = new THREE.Group();
              chair.position.set(chX, 0, chZ);
              chair.rotation.y = rotY;

              const base = new THREE.Mesh(geometries.box, materials.chairBase);
              base.scale.set(0.3, 0.02, 0.3);
              base.position.y = 0.05;
              chair.add(base);

              const shaft = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
              shaft.scale.set(0.03, 0.36, 0.03);
              shaft.position.y = 0.23;
              chair.add(shaft);

              const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
              seat.scale.set(0.38, 0.06, 0.38);
              seat.position.y = 0.43;
              chair.add(seat);

              const back = new THREE.Mesh(geometries.box, materials.chairFabric);
              back.scale.set(0.36, 0.4, 0.05);
              back.position.set(0, 0.63, 0.165);
              chair.add(back);

              return chair;
            };

            // Two on North side, two on South side
            const offset = tableW / 4;
            roomModel.add(createOfficeChair(cx - offset, cz - tableD / 2 - 0.25, Math.PI));
            roomModel.add(createOfficeChair(cx + offset, cz - tableD / 2 - 0.25, Math.PI));
            roomModel.add(createOfficeChair(cx - offset, cz + tableD / 2 + 0.25, 0));
            roomModel.add(createOfficeChair(cx + offset, cz + tableD / 2 + 0.25, 0));

          } else if (nameLower.includes("pki")) {
            // ── PKI ROOM CUSTOM INTERIOR SETUP ──
            const tableD = 0.65; // table depth (along Z)
            const tableW = Math.max(1.8, wM * 0.7); // table length (along X)
            
            // Long table running along the south side wall
            const tableTop = new THREE.Mesh(geometries.box, materials.deskWood);
            tableTop.scale.set(tableW, 0.04, tableD);
            const tz = cz + hM / 2 - tableD / 2 - 0.15;
            tableTop.position.set(cx, 0.75, tz);
            roomModel.add(tableTop);

            // Table legs
            const legW = 0.06;
            for (const [lx, lz] of [
              [tableW / 2 - 0.08, tableD / 2 - 0.08],
              [-tableW / 2 + 0.08, tableD / 2 - 0.08],
              [tableW / 2 - 0.08, -tableD / 2 + 0.08],
              [-tableW / 2 + 0.08, -tableD / 2 + 0.08]
            ]) {
              const leg = new THREE.Mesh(geometries.box, materials.metalDark);
              leg.scale.set(legW, 0.73, legW);
              leg.position.set(cx + lx, 0.365, tz + lz);
              roomModel.add(leg);
            }

            // Two office/task chairs facing South (towards the desk)
            const createPKIChair = (chX) => {
              const chair = new THREE.Group();
              chair.position.set(chX, 0, tz - tableD / 2 - 0.35);
              chair.rotation.y = Math.PI; // facing South

              const base = new THREE.Mesh(geometries.box, materials.chairBase);
              base.scale.set(0.3, 0.02, 0.3);
              base.position.y = 0.05;
              chair.add(base);

              const shaft = new THREE.Mesh(geometries.cylinder, materials.metalSilver);
              shaft.scale.set(0.03, 0.36, 0.03);
              shaft.position.y = 0.23;
              chair.add(shaft);

              const seat = new THREE.Mesh(geometries.box, materials.chairFabric);
              seat.scale.set(0.38, 0.06, 0.38);
              seat.position.y = 0.43;
              chair.add(seat);

              const back = new THREE.Mesh(geometries.box, materials.chairFabric);
              back.scale.set(0.36, 0.4, 0.05);
              back.position.set(0, 0.63, 0.165);
              chair.add(back);

              return chair;
            };

            roomModel.add(createPKIChair(cx - 0.5));
            roomModel.add(createPKIChair(cx + 0.5));

          } else if (isCabinRoom(r)) {
            // If it is a cabin mapped to OTHER (like Mulliner or Information Security), render executive desk layout!
            const execFurniture = layoutExecutiveDesk(cx, cz, wM, hM, resources);
            roomModel.add(execFurniture);
          } else {
            // Standard simple desk for other rooms
            const desk = new THREE.Mesh(geometries.box, materials.deskSurface);
            desk.scale.set(Math.min(1.2, wM * 0.5), 0.75, Math.min(0.6, hM * 0.4));
            desk.position.set(cx, 0.375, cz);
            roomModel.add(desk);
          }
          break;
        }
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

      // Add ceiling infrastructure for this room
      addRoomCeiling(ceilingInfra, r, template, cx, cz, wM, hM, roomPolygon, toWorld);
    }

    // Finalize all accumulated instanced ceiling items
    finalizeCeilingInfrastructure(ceilingInfra, scene);

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
