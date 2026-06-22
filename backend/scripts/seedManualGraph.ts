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

interface LayoutPoint {
  x: number;
  y: number;
}

interface LayoutDoor extends LayoutPoint {
  id: string;
  width?: number;
}

interface LayoutRoom {
  id: string;
  type?: string;
  polygon: LayoutPoint[];
  doors?: LayoutDoor[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) * 10) / 10;
}

function normaliseRoomName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function projectPoint(
  point: LayoutPoint,
  bounds: { minX: number; minY: number; spanX: number; spanY: number },
  width: number,
  height: number,
) {
  return {
    x: ((point.x - bounds.minX) / bounds.spanX) * width,
    y: height - (((point.y - bounds.minY) / bounds.spanY) * height),
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export async function seedHudsonManualGraph(prisma: PrismaClient): Promise<void> {
  console.log('Seeding manual Hudson Floor 5 navigation graph...');

  const FLOOR_ID = 'floor-hudson-f5';

  const layoutPath = path.resolve(__dirname, '../src/data/Hudson_5th.json');
  const layoutData = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) as { rooms?: LayoutRoom[] };
  const layoutRooms = Array.isArray(layoutData.rooms) ? layoutData.rooms : [];

  const allLayoutPoints = layoutRooms.flatMap((room) => [
    ...(room.polygon ?? []),
    ...(room.doors ?? []),
  ]);

  if (allLayoutPoints.length === 0) {
    throw new Error('Hudson_5th.json does not contain any geometry points');
  }

  const bounds = {
    minX: Math.min(...allLayoutPoints.map((point) => point.x)),
    minY: Math.min(...allLayoutPoints.map((point) => point.y)),
    spanX: Math.max(1, Math.max(...allLayoutPoints.map((point) => point.x)) - Math.min(...allLayoutPoints.map((point) => point.x))),
    spanY: Math.max(1, Math.max(...allLayoutPoints.map((point) => point.y)) - Math.min(...allLayoutPoints.map((point) => point.y))),
  };

  const roomLayoutByName = new Map(
    layoutRooms.map((room) => [normaliseRoomName(room.id), room])
  );

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

  // ── Step 4: Seed ROOM_ENTRY nodes from Hudson_5th door coordinates ───────
  const allHudsonRooms = await prisma.room.findMany({
    where: { floorId: FLOOR_ID },
    select: {
      id: true,
      name: true,
      code: true,
      centreX: true,
      centreY: true,
    },
  });

  console.log(`  Seeding ${allHudsonRooms.length} room entry nodes from Hudson_5th doors...`);
  let roomEntryCount = 0;

  for (const room of allHudsonRooms) {
    const layoutRoom = roomLayoutByName.get(normaliseRoomName(room.name));

    let doorPoint: LayoutPoint | null = null;
    if (layoutRoom?.doors && layoutRoom.doors.length > 0) {
      doorPoint = layoutRoom.doors[0];
    } else if (layoutRoom?.polygon && layoutRoom.polygon.length > 0) {
      const avg = layoutRoom.polygon.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 },
      );
      doorPoint = {
        x: avg.x / layoutRoom.polygon.length,
        y: avg.y / layoutRoom.polygon.length,
      };
    }

    if (!doorPoint) {
      console.warn(`  [WARN] No Hudson_5th geometry for room \"${room.name}\"; skipping entry node.`);
      continue;
    }

    const gridPoint = projectPoint(doorPoint, bounds, 80, 80);
    const pixelPoint = projectPoint(doorPoint, bounds, 800, 500);

    const roomNodeId = `room-entry-${room.id}`;
    await prisma.node.upsert({
      where: { id: roomNodeId },
      create: {
        id: roomNodeId,
        floorId: FLOOR_ID,
        roomId: room.id,
        gridX: Math.round(gridPoint.x),
        gridY: Math.round(gridPoint.y),
        realX: pixelPoint.x,
        realY: pixelPoint.y,
        type: 'ROOM_ENTRY',
        label: room.name,
      },
      update: {
        roomId: room.id,
        gridX: Math.round(gridPoint.x),
        gridY: Math.round(gridPoint.y),
        realX: pixelPoint.x,
        realY: pixelPoint.y,
        label: room.name,
      },
    });

    let nearestNode: ManualNode | null = null;
    let nearestDistance = Infinity;
    for (const corridorNode of nodes) {
      const distance = euclidean(pixelPoint.x, pixelPoint.y, corridorNode.x, corridorNode.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNode = corridorNode;
      }
    }

    if (!nearestNode) {
      console.warn(`  [WARN] No corridor node found for room \"${room.name}\".`);
      continue;
    }

    const nearestDbId = nodeIdMap[nearestNode.id];
    const edgeBase = `${roomNodeId}-to-${nearestNode.id.toLowerCase()}`;

    await prisma.edge.upsert({
      where: { id: `room-link-${edgeBase}` },
      create: {
        id: `room-link-${edgeBase}`,
        fromNodeId: roomNodeId,
        toNodeId: nearestDbId,
        weight: nearestDistance,
        isAccessible: true,
        isBidirectional: true,
      },
      update: { weight: nearestDistance },
    });

    await prisma.edge.upsert({
      where: { id: `room-link-${nearestNode.id.toLowerCase()}-to-${roomNodeId}` },
      create: {
        id: `room-link-${nearestNode.id.toLowerCase()}-to-${roomNodeId}`,
        fromNodeId: nearestDbId,
        toNodeId: roomNodeId,
        weight: nearestDistance,
        isAccessible: true,
        isBidirectional: true,
      },
      update: { weight: nearestDistance },
    });

    roomEntryCount += 1;
  }
  console.log(`  Room entry nodes seeded: ${roomEntryCount}`);

  console.log('\n✓ Manual graph seeded successfully.');
  console.log(`  Nodes:  ${nodes.length} graph + ${roomEntryCount} room entry = ${nodes.length + roomEntryCount} total`);
  console.log(`  Edges:  ${edges.length * 2} corridor + ${roomEntryCount * 2} room connectors`);
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
