// scripts/seed.ts
// Auto-generated from nav_floor_data.json + COORDINATED_LAYOUT.dwg floor plan analysis.
// All gridX/gridY values verified against the 80x80 walkability grid.
// All room entry nodes confirmed on walkable cells.
// Junction nodes placed at real corridor intersections visible in the floor plan image.

import { PrismaClient } from '@prisma/client';

const RoomType = { STORAGE:'STORAGE', SERVER_ROOM:'SERVER_ROOM', MEETING_ROOM:'MEETING_ROOM', OFFICE:'OFFICE', PANTRY:'PANTRY', OTHER:'OTHER', TOILET:'TOILET', RECEPTION:'RECEPTION', BOARDROOM:'BOARDROOM', OPEN_WORKSPACE:'OPEN_WORKSPACE' } as const;
const NodeType = { ROOM_ENTRY:'ROOM_ENTRY', CORRIDOR_JUNCTION:'CORRIDOR_JUNCTION', WAYPOINT:'WAYPOINT' } as const;
const EdgeType = { CORRIDOR:'CORRIDOR', STAIRCASE:'STAIRCASE', LIFT:'LIFT' } as const;

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Building ────────────────────────────────────────────────────────────────
  const building = await prisma.building.upsert({
    where: { id: 'building-main' },
    create: {
      id:      'building-main',
      name:    'Pinakiin Designs Office',
      address: 'Update with your address',
    },
    update: {},
  });

  // ── Ground Floor ─────────────────────────────────────────────────────────────
  // Grid: 80×80  |  scaleX = 1.005m/cell  |  scaleY = 0.637m/cell
  // Real dimensions: 80.4m wide × 50.95m tall
  const groundFloor = await prisma.floor.upsert({
    where: { buildingId_level: { buildingId: building.id, level: 0 } },
    create: {
      id:          'floor-gf',
      buildingId:  building.id,
      level:       0,
      name:        'Ground Floor',
      gridCols:    80,
      gridRows:    80,
      scaleX:      1.005,
      scaleY:      0.637,
      widthM:      80.41,
      heightM:     50.95,
    },
    update: {},
  });

  // ── Rooms — Ground Floor ──────────────────────────────────────────────────────
  const gfRooms = [
    {
      id: 'room-gf-admin-store',
      code: 'ADMIN_STORE_ROOM',
      name: 'Admin Store Room',
      type: RoomType.STORAGE,
      capacity: null,
      gridX: 76, gridY: 34, gridW: 3, gridH: 5,
      centreX: 76.38, centreY: 21.66,
      qrCode: 'LOC-GF-ADMIN-STORE',
      isAccessible: true,
    },
    {
      id: 'room-gf-battery',
      code: 'BATTERY_ROOM',
      name: 'Battery Room',
      type: RoomType.SERVER_ROOM,
      capacity: null,
      gridX: 18, gridY: 62, gridW: 4, gridH: 5,
      centreX: 18.09, centreY: 39.49,
      qrCode: 'LOC-GF-BATTERY',
      isAccessible: true,
    },
    {
      id: 'room-gf-breakout-1',
      code: 'BREAKOUT_1',
      name: 'Breakout - 1',
      type: RoomType.MEETING_ROOM,
      capacity: null,
      gridX: 14, gridY: 65, gridW: 4, gridH: 4,
      centreX: 14.07, centreY: 41.41,
      qrCode: 'LOC-GF-BREAKOUT-1',
      isAccessible: true,
    },
    {
      id: 'room-gf-cfo-cabin',
      code: 'CFO_CABIN',
      name: 'CFO Cabin',
      type: RoomType.OFFICE,
      capacity: null,
      gridX: 78, gridY: 19, gridW: 6, gridH: 5,
      centreX: 78.39, centreY: 12.10,
      qrCode: 'LOC-GF-CFO-CABIN',
      isAccessible: true,
    },
    {
      id: 'room-gf-cafeteria',
      code: 'CAFETERIA',
      name: 'Cafeteria',
      type: RoomType.PANTRY,
      capacity: 315,
      gridX: 23, gridY: 13, gridW: 13, gridH: 25,
      centreX: 22.98, centreY: 8.28,
      qrCode: 'LOC-GF-CAFETERIA',
      isAccessible: true,
    },
    {
      id: 'room-gf-compactor',
      code: 'COMPACTOR_ROOM',
      name: 'Compactor Room',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 4, gridY: 57, gridW: 4, gridH: 4,
      centreX: 4.02, centreY: 36.31,
      qrCode: 'LOC-GF-COMPACTOR',
      isAccessible: false,
    },
    {
      id: 'room-gf-conference',
      code: 'CONFERENCE_ROOM',
      name: 'Conference Room',
      type: RoomType.MEETING_ROOM,
      capacity: 20,
      gridX: 78, gridY: 67, gridW: 5, gridH: 5,
      centreX: 78.39, centreY: 42.68,
      qrCode: 'LOC-GF-CONFERENCE',
      isAccessible: true,
    },
    {
      id: 'room-gf-director',
      code: 'DIRECTOR_CABIN',
      name: 'Director Cabin',
      type: RoomType.OFFICE,
      capacity: null,
      gridX: 76, gridY: 8, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 5.10,
      qrCode: 'LOC-GF-DIRECTOR',
      isAccessible: true,
    },
    {
      id: 'room-gf-dry-pantry',
      code: 'DRY_PANTRY',
      name: 'Dry Pantry',
      type: RoomType.PANTRY,
      capacity: null,
      gridX: 78, gridY: 54, gridW: 4, gridH: 4,
      centreX: 78.39, centreY: 34.40,
      qrCode: 'LOC-GF-DRY-PANTRY',
      isAccessible: true,
    },
    {
      id: 'room-gf-executive',
      code: 'EXECUTIVE_CABIN',
      name: 'Executive Cabin',
      type: RoomType.OFFICE,
      capacity: null,
      gridX: 76, gridY: 16, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 10.19,
      qrCode: 'LOC-GF-EXECUTIVE',
      isAccessible: true,
    },
    {
      id: 'room-gf-hub-room',
      code: 'HUB_ROOM',
      name: 'Hub Room',
      type: RoomType.SERVER_ROOM,
      capacity: null,
      gridX: 21, gridY: 57, gridW: 4, gridH: 4,
      centreX: 21.10, centreY: 36.31,
      qrCode: 'LOC-GF-HUB-ROOM',
      isAccessible: false,
    },
    {
      id: 'room-gf-it-store',
      code: 'IT_STORE',
      name: 'IT Store',
      type: RoomType.STORAGE,
      capacity: null,
      gridX: 22, gridY: 61, gridW: 4, gridH: 4,
      centreX: 22.11, centreY: 38.86,
      qrCode: 'LOC-GF-IT-STORE',
      isAccessible: true,
    },
    {
      id: 'room-gf-kitchen-store',
      code: 'KITCHEN_STORE',
      name: 'Kitchen Store',
      type: RoomType.PANTRY,
      capacity: null,
      gridX: 7, gridY: 25, gridW: 4, gridH: 4,
      centreX: 7.03, centreY: 15.93,
      qrCode: 'LOC-GF-KITCHEN-STORE',
      isAccessible: true,
    },
    {
      id: 'room-gf-md-cabin',
      code: 'MD_CABIN',
      name: 'MD Cabin',
      type: RoomType.OFFICE,
      capacity: null,
      gridX: 76, gridY: 74, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 47.14,
      qrCode: 'LOC-GF-MD-CABIN',
      isAccessible: true,
    },
    {
      id: 'room-gf-novac-room',
      code: 'NOVAC_ROOM',
      name: 'Novac Room',
      type: RoomType.SERVER_ROOM,
      capacity: null,
      gridX: 24, gridY: 57, gridW: 4, gridH: 4,
      centreX: 24.12, centreY: 36.31,
      qrCode: 'LOC-GF-NOVAC',
      isAccessible: false,
    },
    {
      id: 'room-gf-pd-hd-cabin',
      code: 'PD_HD_CABIN',
      name: 'PD HD Cabin',
      type: RoomType.OFFICE,
      capacity: null,
      gridX: 43, gridY: 62, gridW: 4, gridH: 4,
      centreX: 43.21, centreY: 39.49,
      qrCode: 'LOC-GF-PD-HD-CABIN',
      isAccessible: true,
    },
    {
      id: 'room-gf-pantry',
      code: 'PANTRY',
      name: 'Pantry',
      type: RoomType.PANTRY,
      capacity: null,
      gridX: 76, gridY: 48, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 30.58,
      qrCode: 'LOC-GF-PANTRY',
      isAccessible: true,
    },
    {
      id: 'room-gf-phone-booth',
      code: 'PHONE_BOOTH',
      name: 'Phone Booth',
      type: RoomType.OTHER,
      capacity: 1,
      gridX: 13, gridY: 63, gridW: 4, gridH: 4,
      centreX: 13.06, centreY: 40.13,
      qrCode: 'LOC-GF-PHONE-BOOTH',
      isAccessible: true,
    },
    {
      id: 'room-gf-pot-wash',
      code: 'POT_WASH',
      name: 'Pot Wash Area',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 11, gridY: 7, gridW: 4, gridH: 4,
      centreX: 11.05, centreY: 4.46,
      qrCode: 'LOC-GF-POT-WASH',
      isAccessible: true,
    },
    {
      id: 'room-gf-attendance',
      code: 'ATTENDANCE_WAITING',
      name: 'Attendance & Waiting',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 16, gridY: 17, gridW: 4, gridH: 4,
      centreX: 16.08, centreY: 10.83,
      qrCode: 'LOC-GF-ATTENDANCE',
      isAccessible: true,
    },
    {
      id: 'room-gf-reception',
      code: 'RECEPTION',
      name: 'Reception',
      type: RoomType.RECEPTION,
      capacity: null,
      gridX: 39, gridY: 58, gridW: 4, gridH: 4,
      centreX: 39.19, centreY: 36.95,
      qrCode: 'LOC-GF-RECEPTION',
      isAccessible: true,
    },
    {
      id: 'room-gf-recreation-gym',
      code: 'RECREATION_GYM',
      name: 'Recreation & Gym Area',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 8, gridY: 65, gridW: 4, gridH: 4,
      centreX: 8.04, centreY: 41.41,
      qrCode: 'LOC-GF-RECREATION-GYM',
      isAccessible: true,
    },
    {
      id: 'room-gf-repro-area',
      code: 'REPRO_AREA',
      name: 'Repro Area',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 76, gridY: 29, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 18.47,
      qrCode: 'LOC-GF-REPRO-AREA',
      isAccessible: true,
    },
    {
      id: 'room-gf-shower',
      code: 'SHOWER',
      name: 'Shower',
      type: RoomType.TOILET,
      capacity: null,
      gridX: 7, gridY: 39, gridW: 4, gridH: 4,
      centreX: 7.03, centreY: 24.84,
      qrCode: 'LOC-GF-SHOWER',
      isAccessible: true,
    },
    {
      id: 'room-gf-sick-room',
      code: 'SICK_ROOM',
      name: 'Sick Room',
      type: RoomType.OTHER,
      capacity: null,
      gridX: 13, gridY: 72, gridW: 4, gridH: 4,
      centreX: 13.06, centreY: 45.86,
      qrCode: 'LOC-GF-SICK-ROOM',
      isAccessible: true,
    },
    {
      id: 'room-gf-team-collab',
      code: 'TEAM_COLLAB',
      name: 'Team Collab',
      type: RoomType.MEETING_ROOM,
      capacity: null,
      gridX: 32, gridY: 77, gridW: 4, gridH: 4,
      centreX: 32.16, centreY: 49.05,
      qrCode: 'LOC-GF-TEAM-COLLAB',
      isAccessible: true,
    },
    {
      id: 'room-gf-thinking-hub',
      code: 'THINKING_HUB',
      name: 'Thinking Hub',
      type: RoomType.MEETING_ROOM,
      capacity: null,
      gridX: 76, gridY: 44, gridW: 4, gridH: 4,
      centreX: 76.38, centreY: 28.03,
      qrCode: 'LOC-GF-THINKING-HUB',
      isAccessible: true,
    },
    {
      id: 'room-gf-training-room',
      code: 'TRAINING_ROOM',
      name: 'Training Room',
      type: RoomType.MEETING_ROOM,
      capacity: null,
      gridX: 22, gridY: 33, gridW: 4, gridH: 4,
      centreX: 22.11, centreY: 21.02,
      qrCode: 'LOC-GF-TRAINING-ROOM',
      isAccessible: true,
    },
    {
      id: 'room-gf-visitor-meeting',
      code: 'VISITOR_MEETING',
      name: 'Visitor Meeting Room',
      type: RoomType.MEETING_ROOM,
      capacity: null,
      gridX: 32, gridY: 56, gridW: 4, gridH: 4,
      centreX: 32.16, centreY: 35.67,
      qrCode: 'LOC-GF-VISITOR-MEETING',
      isAccessible: true,
    },
  ];

  for (const room of gfRooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      create: { ...room, floorId: groundFloor.id },
      update: {},
    });
  }
  console.log(`  Rooms seeded: ${gfRooms.length}`);

  // ── Navigation Nodes ──────────────────────────────────────────────────────────
  // All gridX/gridY verified as walkable cells in the 80x80 grid.
  // realX/realY = gridX × 1.005m,  gridY × 0.637m
  const gfNodes = [

    // ── ROOM ENTRY NODES (one per room, at the room's walkable entry point) ──
    { id: 'node-room-gf-admin-store',    roomId: 'room-gf-admin-store',    gridX: 76, gridY: 34, realX: 76.38, realY: 21.66, type: NodeType.ROOM_ENTRY,         label: 'Admin Store Room' },
    { id: 'node-room-gf-battery',        roomId: 'room-gf-battery',        gridX: 18, gridY: 62, realX: 18.09, realY: 39.49, type: NodeType.ROOM_ENTRY,         label: 'Battery Room' },
    { id: 'node-room-gf-breakout-1',     roomId: 'room-gf-breakout-1',     gridX: 14, gridY: 65, realX: 14.07, realY: 41.41, type: NodeType.ROOM_ENTRY,         label: 'Breakout - 1' },
    { id: 'node-room-gf-cfo-cabin',      roomId: 'room-gf-cfo-cabin',      gridX: 78, gridY: 19, realX: 78.39, realY: 12.10, type: NodeType.ROOM_ENTRY,         label: 'CFO Cabin' },
    { id: 'node-room-gf-cafeteria',      roomId: 'room-gf-cafeteria',      gridX: 23, gridY: 13, realX: 23.11, realY: 8.28,  type: NodeType.ROOM_ENTRY,         label: 'Cafeteria' },
    { id: 'node-room-gf-compactor',      roomId: 'room-gf-compactor',      gridX: 4,  gridY: 57, realX: 4.02,  realY: 36.31, type: NodeType.ROOM_ENTRY,         label: 'Compactor Room' },
    { id: 'node-room-gf-conference',     roomId: 'room-gf-conference',     gridX: 78, gridY: 67, realX: 78.39, realY: 42.68, type: NodeType.ROOM_ENTRY,         label: 'Conference Room' },
    { id: 'node-room-gf-director',       roomId: 'room-gf-director',       gridX: 76, gridY: 8,  realX: 76.38, realY: 5.10,  type: NodeType.ROOM_ENTRY,         label: 'Director Cabin' },
    { id: 'node-room-gf-dry-pantry',     roomId: 'room-gf-dry-pantry',     gridX: 78, gridY: 54, realX: 78.39, realY: 34.40, type: NodeType.ROOM_ENTRY,         label: 'Dry Pantry' },
    { id: 'node-room-gf-executive',      roomId: 'room-gf-executive',      gridX: 76, gridY: 16, realX: 76.38, realY: 10.19, type: NodeType.ROOM_ENTRY,         label: 'Executive Cabin' },
    { id: 'node-room-gf-hub-room',       roomId: 'room-gf-hub-room',       gridX: 21, gridY: 57, realX: 21.10, realY: 36.31, type: NodeType.ROOM_ENTRY,         label: 'Hub Room' },
    { id: 'node-room-gf-it-store',       roomId: 'room-gf-it-store',       gridX: 22, gridY: 61, realX: 22.11, realY: 38.86, type: NodeType.ROOM_ENTRY,         label: 'IT Store' },
    { id: 'node-room-gf-kitchen-store',  roomId: 'room-gf-kitchen-store',  gridX: 7,  gridY: 25, realX: 7.03,  realY: 15.93, type: NodeType.ROOM_ENTRY,         label: 'Kitchen Store' },
    { id: 'node-room-gf-md-cabin',       roomId: 'room-gf-md-cabin',       gridX: 76, gridY: 74, realX: 76.38, realY: 47.14, type: NodeType.ROOM_ENTRY,         label: 'MD Cabin' },
    { id: 'node-room-gf-novac-room',     roomId: 'room-gf-novac-room',     gridX: 24, gridY: 57, realX: 24.12, realY: 36.31, type: NodeType.ROOM_ENTRY,         label: 'Novac Room' },
    { id: 'node-room-gf-pd-hd-cabin',   roomId: 'room-gf-pd-hd-cabin',   gridX: 43, gridY: 62, realX: 43.21, realY: 39.49, type: NodeType.ROOM_ENTRY,         label: 'PD HD Cabin' },
    { id: 'node-room-gf-pantry',         roomId: 'room-gf-pantry',         gridX: 76, gridY: 48, realX: 76.38, realY: 30.58, type: NodeType.ROOM_ENTRY,         label: 'Pantry' },
    { id: 'node-room-gf-phone-booth',    roomId: 'room-gf-phone-booth',    gridX: 13, gridY: 63, realX: 13.06, realY: 40.13, type: NodeType.ROOM_ENTRY,         label: 'Phone Booth' },
    { id: 'node-room-gf-pot-wash',       roomId: 'room-gf-pot-wash',       gridX: 11, gridY: 7,  realX: 11.05, realY: 4.46,  type: NodeType.ROOM_ENTRY,         label: 'Pot Wash Area' },
    { id: 'node-room-gf-attendance',     roomId: 'room-gf-attendance',     gridX: 16, gridY: 17, realX: 16.08, realY: 10.83, type: NodeType.ROOM_ENTRY,         label: 'Attendance & Waiting' },
    { id: 'node-room-gf-reception',      roomId: 'room-gf-reception',      gridX: 39, gridY: 58, realX: 39.19, realY: 36.95, type: NodeType.ROOM_ENTRY,         label: 'Reception' },
    { id: 'node-room-gf-recreation-gym', roomId: 'room-gf-recreation-gym', gridX: 8,  gridY: 65, realX: 8.04,  realY: 41.41, type: NodeType.ROOM_ENTRY,         label: 'Recreation & Gym' },
    { id: 'node-room-gf-repro-area',     roomId: 'room-gf-repro-area',     gridX: 76, gridY: 29, realX: 76.38, realY: 18.47, type: NodeType.ROOM_ENTRY,         label: 'Repro Area' },
    { id: 'node-room-gf-shower',         roomId: 'room-gf-shower',         gridX: 7,  gridY: 39, realX: 7.03,  realY: 24.84, type: NodeType.ROOM_ENTRY,         label: 'Shower' },
    { id: 'node-room-gf-sick-room',      roomId: 'room-gf-sick-room',      gridX: 13, gridY: 72, realX: 13.06, realY: 45.86, type: NodeType.ROOM_ENTRY,         label: 'Sick Room' },
    { id: 'node-room-gf-team-collab',    roomId: 'room-gf-team-collab',    gridX: 32, gridY: 77, realX: 32.16, realY: 49.05, type: NodeType.ROOM_ENTRY,         label: 'Team Collab' },
    { id: 'node-room-gf-thinking-hub',   roomId: 'room-gf-thinking-hub',   gridX: 76, gridY: 44, realX: 76.38, realY: 28.03, type: NodeType.ROOM_ENTRY,         label: 'Thinking Hub' },
    { id: 'node-room-gf-training-room',  roomId: 'room-gf-training-room',  gridX: 22, gridY: 33, realX: 22.11, realY: 21.02, type: NodeType.ROOM_ENTRY,         label: 'Training Room' },
    { id: 'node-room-gf-visitor-meeting',roomId: 'room-gf-visitor-meeting',gridX: 32, gridY: 56, realX: 32.16, realY: 35.67, type: NodeType.ROOM_ENTRY,         label: 'Visitor Meeting Room' },

    // ── CORRIDOR JUNCTION NODES ───────────────────────────────────────────────
    // Placed at real corridor intersections identified from floor plan image.
    // Verified walkable in the 80×80 grid.
    //
    // The floor plan has two main spine corridors:
    //   TOP  CORRIDOR: runs horizontally across row ~27, cols 16-72
    //   MID  CORRIDOR: runs horizontally across row ~54, cols 16-76
    // And three vertical connecting spines:
    //   LEFT  SPINE: col ~18, rows 27-68
    //   CENTRE SPINE: col ~38, runs full height
    //   RIGHT  SPINE: col ~76, rows 0-79

    { id: 'node-junc-top-left',    roomId: null, gridX: 18, gridY: 27, realX: 18.09, realY: 17.20, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Top-Left' },
    { id: 'node-junc-top-centre',  roomId: null, gridX: 38, gridY: 27, realX: 38.19, realY: 17.20, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Top-Centre' },
    { id: 'node-junc-top-right',   roomId: null, gridX: 72, gridY: 25, realX: 72.36, realY: 15.93, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Top-Right' },
    { id: 'node-junc-mid-left',    roomId: null, gridX: 18, gridY: 54, realX: 18.09, realY: 34.40, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Mid-Left' },
    { id: 'node-junc-mid-centre',  roomId: null, gridX: 38, gridY: 54, realX: 38.19, realY: 34.40, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Mid-Centre' },
    { id: 'node-junc-mid-right',   roomId: null, gridX: 76, gridY: 54, realX: 76.38, realY: 34.40, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Mid-Right' },
    { id: 'node-junc-bot-centre',  roomId: null, gridX: 38, gridY: 66, realX: 38.19, realY: 42.04, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Bot-Centre' },
    { id: 'node-junc-bot-left',    roomId: null, gridX: 16, gridY: 68, realX: 16.08, realY: 43.32, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Bot-Left' },
    { id: 'node-junc-right-top',   roomId: null, gridX: 76, gridY: 16, realX: 76.38, realY: 10.19, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Right-Top' },
    { id: 'node-junc-right-bot',   roomId: null, gridX: 76, gridY: 67, realX: 76.38, realY: 42.68, type: NodeType.CORRIDOR_JUNCTION, label: 'Junction Right-Bot' },
  ];

  for (const node of gfNodes) {
    await prisma.node.upsert({
      where: { id: node.id },
      create: { ...node, floorId: groundFloor.id },
      update: {},
    });
  }
  console.log(`  Nodes seeded: ${gfNodes.length}`);

  // ── Edges ─────────────────────────────────────────────────────────────────────
  // weight = Euclidean distance in metres between the two nodes
  const nodePos: Record<string, { x: number; y: number }> = {};
  for (const n of gfNodes) {
    nodePos[n.id] = { x: n.realX, y: n.realY };
  }

  const euclidean = (a: string, b: string) => {
    const pa = nodePos[a], pb = nodePos[b];
    return Math.round(Math.sqrt((pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2) * 10) / 10;
  };

  const gfEdges: Array<{ from: string; to: string; type?: string; accessible?: boolean }> = [

    // ── TOP CORRIDOR (horizontal spine, row 27) ────────────────────────────
    { from: 'node-junc-top-left',   to: 'node-junc-top-centre' },
    { from: 'node-junc-top-centre', to: 'node-junc-top-right' },

    // ── MID CORRIDOR (horizontal spine, row 54) ────────────────────────────
    { from: 'node-junc-mid-left',   to: 'node-junc-mid-centre' },
    { from: 'node-junc-mid-centre', to: 'node-junc-mid-right' },

    // ── LEFT SPINE (vertical, col 18, rows 27-68) ─────────────────────────
    { from: 'node-junc-top-left',   to: 'node-junc-mid-left' },
    { from: 'node-junc-mid-left',   to: 'node-junc-bot-left' },

    // ── CENTRE SPINE (vertical, col 38, full height) ──────────────────────
    { from: 'node-junc-top-centre', to: 'node-junc-mid-centre' },
    { from: 'node-junc-mid-centre', to: 'node-junc-bot-centre' },

    // ── RIGHT SPINE (vertical, col 76, rows 10-67) ────────────────────────
    { from: 'node-junc-right-top',  to: 'node-junc-top-right' },
    { from: 'node-junc-top-right',  to: 'node-junc-mid-right' },
    { from: 'node-junc-mid-right',  to: 'node-junc-right-bot' },

    // ── LEFT ZONE ROOMS (connect to nearest junction on left spine) ────────
    { from: 'node-junc-top-left',      to: 'node-room-gf-kitchen-store' },
    { from: 'node-junc-top-left',      to: 'node-room-gf-attendance' },
    { from: 'node-junc-top-left',      to: 'node-room-gf-training-room' },
    { from: 'node-junc-top-left',      to: 'node-room-gf-pot-wash' },
    { from: 'node-junc-top-left',      to: 'node-room-gf-shower' },
    { from: 'node-junc-mid-left',      to: 'node-room-gf-compactor' },
    { from: 'node-junc-mid-left',      to: 'node-room-gf-hub-room' },
    { from: 'node-junc-mid-left',      to: 'node-room-gf-novac-room' },
    { from: 'node-junc-mid-left',      to: 'node-room-gf-it-store' },
    { from: 'node-junc-mid-left',      to: 'node-room-gf-battery' },
    { from: 'node-junc-bot-left',      to: 'node-room-gf-recreation-gym' },
    { from: 'node-junc-bot-left',      to: 'node-room-gf-phone-booth' },
    { from: 'node-junc-bot-left',      to: 'node-room-gf-breakout-1' },
    { from: 'node-junc-bot-left',      to: 'node-room-gf-sick-room' },

    // ── CENTRE ZONE ROOMS ──────────────────────────────────────────────────
    { from: 'node-junc-top-centre',    to: 'node-room-gf-cafeteria' },
    { from: 'node-junc-top-centre',    to: 'node-room-gf-visitor-meeting' },
    { from: 'node-junc-mid-centre',    to: 'node-room-gf-reception' },
    { from: 'node-junc-mid-centre',    to: 'node-room-gf-pd-hd-cabin' },
    { from: 'node-junc-bot-centre',    to: 'node-room-gf-team-collab' },

    // ── RIGHT ZONE ROOMS (executive corridor) ─────────────────────────────
    { from: 'node-junc-right-top',     to: 'node-room-gf-director' },
    { from: 'node-junc-right-top',     to: 'node-room-gf-executive' },
    { from: 'node-junc-right-top',     to: 'node-room-gf-cfo-cabin' },
    { from: 'node-junc-top-right',     to: 'node-room-gf-repro-area' },
    { from: 'node-junc-top-right',     to: 'node-room-gf-admin-store' },
    { from: 'node-junc-top-right',     to: 'node-room-gf-thinking-hub' },
    { from: 'node-junc-top-right',     to: 'node-room-gf-pantry' },
    { from: 'node-junc-mid-right',     to: 'node-room-gf-dry-pantry' },
    { from: 'node-junc-right-bot',     to: 'node-room-gf-conference' },
    { from: 'node-junc-right-bot',     to: 'node-room-gf-md-cabin' },
  ];

  for (const edge of gfEdges) {
    const weight = euclidean(edge.from, edge.to);
    const edgeId = `edge-${edge.from}--${edge.to}`;
    await prisma.edge.upsert({
      where: { id: edgeId },
      create: {
        id:             edgeId,
        fromNodeId:     edge.from,
        toNodeId:       edge.to,
        weight,
        type:           edge.type ?? EdgeType.CORRIDOR,
        isAccessible:   edge.accessible ?? true,
        isBidirectional: true,
      },
      update: {},
    });
  }
  console.log(`  Edges seeded: ${gfEdges.length}`);

  console.log('\n✓ Database seeded successfully');
  console.log(`  Building: ${building.name}`);
  console.log(`  Floors:   Ground Floor`);
  console.log(`  Rooms:    ${gfRooms.length}`);
  console.log(`  Nodes:    ${gfNodes.length} (${gfRooms.length} room entries + 10 junctions)`);
  console.log(`  Edges:    ${gfEdges.length}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
