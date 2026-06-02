// scripts/seedManualGraph.ts
// Seeds the manually authored Hudson Floor 5 navigation graph.
// Replaces the auto-generated graph.nodes / graph.edges from nav_hudson_f5.json.
// Room metadata (from nav_hudson_f5.json) is left untouched.
//
// Run:
//   ts-node scripts/seed.ts && ts-node scripts/seedManualGraph.ts
// or use:
//   npm run db:seed
//
// This script is SAFE to re-run — it uses upsert throughout.

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ─── LOAD MANUAL GRAPH ────────────────────────────────────────────────────────

const graphPath = path.resolve(__dirname, '../src/data/manualGraph.json');
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ManualNode {
  id: string;
  x: number;
  y: number;
}

interface ManualEdge {
  from: string;
  to: string;
}

interface POI {
  id: string;
  name: string;
  x: number;
  y: number;
  nearestNode: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) * 10) / 10;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export async function seedHudsonManualGraph(prisma: PrismaClient): Promise<void> {
  console.log('Seeding manual Hudson Floor 5 navigation graph...');

  const FLOOR_ID = 'floor-hudson-f5';

  // ── Step 0: Ensure POI-only rooms exist ──────────────────────────────────────
// These destinations exist physically on the floor but have no room record
// in nav_hudson_f5.json. We create minimal room records so the routing
// service can resolve them to nodes via roomId.

const poiRooms = [
  { id: 'room-h5-cafeteria',            code: 'HUDSON_CAFETERIA',              name: 'Cafeteria',              gridX: 34, gridY: 34, gridW: 1, gridH: 1, centreX: 337, centreY: 340 },
  { id: 'room-h5-it_bar',               code: 'HUDSON_IT_BAR',                 name: 'IT Bar',                 gridX: 14, gridY: 29, gridW: 1, gridH: 1, centreX: 144, centreY: 293 },
  { id: 'room-h5-recreational_room',    code: 'HUDSON_RECREATIONAL_ROOM',      name: 'Recreational Room',      gridX: 73, gridY: 28, gridW: 1, gridH: 1, centreX: 739, centreY: 283 },
  { id: 'room-h5-executive_dining_room',code: 'HUDSON_EXECUTIVE_DINING_ROOM',  name: 'Executive Dining Room',  gridX: 9,  gridY: 39, gridW: 1, gridH: 1, centreX: 95,  centreY: 390 },
  { id: 'room-h5-fire_exit_1',          code: 'HUDSON_FIRE_EXIT_1',            name: 'Fire Exit 1',            gridX: 48, gridY: 32, gridW: 1, gridH: 1, centreX: 483, centreY: 321 },
  { id: 'room-h5-training_room',        code: 'HUDSON_TRAINING_ROOM',          name: 'Training Room',          gridX: 45, gridY: 39, gridW: 1, gridH: 1, centreX: 454, centreY: 390 },
  { id: 'room-h5-innovation_lab',       code: 'HUDSON_INNOVATION_LAB',         name: 'Innovation Lab',         gridX: 59, gridY: 10, gridW: 1, gridH: 1, centreX: 594, centreY: 103 },
  { id: 'room-h5-fire_exit_2',          code: 'HUDSON_FIRE_EXIT_2',            name: 'Fire Exit 2',            gridX: 64, gridY: 10, gridW: 1, gridH: 1, centreX: 640, centreY: 103 },
  { id: 'room-h5-aws_room',             code: 'HUDSON_AWS_ROOM',               name: 'AWS Room',               gridX: 2,  gridY: 16, gridW: 1, gridH: 1, centreX: 22,  centreY: 164 },
  { id: 'room-h5-vending_machine',      code: 'HUDSON_VENDING_MACHINE',        name: 'Vending Machine',        gridX: 73, gridY: 36, gridW: 1, gridH: 1, centreX: 739, centreY: 360 },
  { id: 'room-h5-board_room',           code: 'HUDSON_BOARD_ROOM',             name: 'Board Room',             gridX: 27, gridY: 5,  gridW: 1, gridH: 1, centreX: 277, centreY: 58  },
];

for (const r of poiRooms) {
  await prisma.room.upsert({
    where: { code: r.code },
    create: {
      id:           r.id,
      floorId:      FLOOR_ID,
      code:         r.code,
      name:         r.name,
      type:         'OTHER',
      gridX:        r.gridX,
      gridY:        r.gridY,
      gridW:        r.gridW,
      gridH:        r.gridH,
      centreX:      r.centreX,
      centreY:      r.centreY,
      qrCode:       `LOC-H5-${r.code.replace('HUDSON_', '')}`,
      isAccessible: true,
    },
    update: { name: r.name },
  });
}
console.log(`  POI-only rooms ensured: ${poiRooms.length}`);

  // ── Step 1: Delete old auto-generated nodes and edges ─────────────────────
  // Edges must be deleted before nodes (foreign key constraint)
  console.log('  Clearing old graph nodes and edges...');
  await prisma.edge.deleteMany({ where: { fromNode: { floorId: FLOOR_ID } } });
  await prisma.node.deleteMany({ where: { floorId: FLOOR_ID } });
  console.log('  Old graph cleared.');

  // ── Step 2: Seed manual graph nodes ───────────────────────────────────────
  const nodes: ManualNode[] = graph.nodes;
  const nodeIdMap: Record<string, string> = {}; // N1 → prisma node id

  console.log(`  Seeding ${nodes.length} manual nodes...`);
  for (const n of nodes) {
    const dbId = `manual-node-${n.id.toLowerCase()}-hudson-f5`;
    await prisma.node.upsert({
      where: { id: dbId },
      create: {
        id:      dbId,
        floorId: FLOOR_ID,
        roomId:  null,
        // Store pixel coordinates in gridX/gridY
        // (the field names say "grid" but we use them for pixel space here)
        gridX:   n.x,
        gridY:   n.y,
        realX:   n.x,
        realY:   n.y,
        type:    'CORRIDOR_JUNCTION',
        label:   n.id,
      },
      update: {
        gridX: n.x,
        gridY: n.y,
        realX: n.x,
        realY: n.y,
        label: n.id,
      },
    });
    nodeIdMap[n.id] = dbId;
  }
  console.log(`  ${nodes.length} nodes seeded.`);

  // ── Step 3: Seed manual graph edges (bidirectional) ───────────────────────
  const edges: ManualEdge[] = graph.edges;
  const nodesById: Record<string, ManualNode> = {};
  for (const n of nodes) nodesById[n.id] = n;

  console.log(`  Seeding ${edges.length * 2} edges (${edges.length} bidirectional pairs)...`);
  for (const e of edges) {
    const fromNode = nodesById[e.from];
    const toNode   = nodesById[e.to];
    const weight   = euclidean(fromNode.x, fromNode.y, toNode.x, toNode.y);

    const fromDbId = nodeIdMap[e.from];
    const toDbId   = nodeIdMap[e.to];

    // Forward edge
    const fwdId = `manual-edge-${e.from.toLowerCase()}-${e.to.toLowerCase()}`;
    await prisma.edge.upsert({
      where: { id: fwdId },
      create: {
        id:             fwdId,
        fromNodeId:     fromDbId,
        toNodeId:       toDbId,
        weight,
        isAccessible:   true,
        isBidirectional: true,
      },
      update: { weight },
    });

    // Reverse edge
    const revId = `manual-edge-${e.to.toLowerCase()}-${e.from.toLowerCase()}`;
    await prisma.edge.upsert({
      where: { id: revId },
      create: {
        id:             revId,
        fromNodeId:     toDbId,
        toNodeId:       fromDbId,
        weight,
        isAccessible:   true,
        isBidirectional: true,
      },
      update: { weight },
    });
  }
  console.log(`  Edges seeded.`);

// ── Step 4: Seed POIs as ROOM_ENTRY nodes linked to rooms ─────────────────
const pois: POI[] = graph.pois;

// Build a lookup: normalised name → room id, from what seed.ts actually creates.
// seed.ts creates room IDs as: room-h5-${r.code.toLowerCase()}
// and room codes as: HUDSON_${r.code}
// The rooms table has a `code` column — use that for exact matching.
const allHudsonRooms = await prisma.room.findMany({
  where: { floorId: FLOOR_ID },
  select: { id: true, name: true, code: true },
});

// Normalise for loose matching: lowercase, strip spaces/punctuation
const normalise = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '');

const roomByNormName = new Map<string, string>();
const roomByCode     = new Map<string, string>();
for (const r of allHudsonRooms) {
  roomByNormName.set(normalise(r.name), r.id);
  roomByCode.set(r.code.toLowerCase(), r.id);
}

console.log(`  Seeding ${pois.length} POI nodes...`);
for (const poi of pois) {
  const poiDbId = `manual-poi-${poi.id}-hudson-f5`;

  // Try exact code match first (most reliable), then normalised name
  const hudsonCode = `hudson_${normalise(poi.name)}`;
  const roomId =
    roomByCode.get(hudsonCode) ??
    roomByNormName.get(normalise(poi.name)) ??
    null;

  if (!roomId) {
    console.warn(`  [WARN] No room found for POI "${poi.name}" — node will have roomId=null`);
  } else {
    console.log(`  [OK]   POI "${poi.name}" → room ${roomId}`);
  }

  await prisma.node.upsert({
    where: { id: poiDbId },
    create: {
      id:      poiDbId,
      floorId: FLOOR_ID,
      roomId,
      gridX:   poi.x,
      gridY:   poi.y,
      realX:   poi.x,
      realY:   poi.y,
      type:    'ROOM_ENTRY',
      label:   poi.name,
    },
    update: {
      roomId,          // ← was missing before; re-seed now fixes it
      gridX: poi.x,
      gridY: poi.y,
      realX: poi.x,
      realY: poi.y,
      label: poi.name,
    },
  });
  nodeIdMap[poi.id] = poiDbId;

  // Connect POI node to its nearest graph node
  const nearestNode = nodesById[poi.nearestNode];
  const nearestDbId = nodeIdMap[poi.nearestNode];
  const poiWeight   = euclidean(poi.x, poi.y, nearestNode.x, nearestNode.y);

  const poiFwdId = `manual-edge-${poi.id}-to-${poi.nearestNode.toLowerCase()}`;
  await prisma.edge.upsert({
    where: { id: poiFwdId },
    create: {
      id:              poiFwdId,
      fromNodeId:      poiDbId,
      toNodeId:        nearestDbId,
      weight:          poiWeight,
      isAccessible:    true,
      isBidirectional: true,
    },
    update: { weight: poiWeight },
  });

  const poiRevId = `manual-edge-${poi.nearestNode.toLowerCase()}-to-${poi.id}`;
  await prisma.edge.upsert({
    where: { id: poiRevId },
    create: {
      id:              poiRevId,
      fromNodeId:      nearestDbId,
      toNodeId:        poiDbId,
      weight:          poiWeight,
      isAccessible:    true,
      isBidirectional: true,
    },
    update: { weight: poiWeight },
  });
}
console.log(`  POI nodes seeded.`);

  console.log('\n✓ Manual graph seeded successfully.');
  console.log(`  Nodes:  ${nodes.length} graph + ${pois.length} POI = ${nodes.length + pois.length} total`);
  console.log(`  Edges:  ${edges.length * 2} corridor + ${pois.length * 2} POI connector`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedHudsonManualGraph(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
