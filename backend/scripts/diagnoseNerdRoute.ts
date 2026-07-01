import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { getRoute } from '../src/services/routingService';
import { buildGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function run() {
  const fromRoomId = 'editor-floor-hudson-f6-room-reception';
  const toRoomId = 'editor-floor-hudson-f6-room-4-pax-nerd-room';

  console.log("=== END-TO-END VERIFICATION: RECEPTION -> 4 PAX NERD ROOM ===");

  // 1. Fetch Rooms & Verify Entry Nodes
  const fromRoom = await prisma.room.findUnique({ where: { id: fromRoomId } });
  const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });

  console.log("\n3. Coordinates of ROOM_ENTRY nodes:");
  if (fromRoom) {
    console.log(`* Reception Room Grid: (gridX: ${fromRoom.gridX}, gridY: ${fromRoom.gridY})`);
    const fromNodes = await prisma.node.findMany({ where: { roomId: fromRoomId } });
    for (const node of fromNodes) {
      console.log(`  - Entry Node ID: ${node.id} -> rawX: ${node.realX}, rawY: ${node.realY}, dbGridX: ${node.gridX}, dbGridY: ${node.gridY}`);
    }
  }
  if (toRoom) {
    console.log(`* 4 Pax NERD Room Grid: (gridX: ${toRoom.gridX}, gridY: ${toRoom.gridY})`);
    const toNodes = await prisma.node.findMany({ where: { roomId: toRoomId } });
    for (const node of toNodes) {
      console.log(`  - Entry Node ID: ${node.id} -> rawX: ${node.realX}, rawY: ${node.realY}, dbGridX: ${node.gridX}, dbGridY: ${node.gridY}`);
    }
  }

  // 2. Query Route payload
  const route = await getRoute(prisma, { fromRoomId, toRoomId });
  console.log("\n1. Path Node IDs returned by A*:");
  console.log(route.pathNodeIds);

  // 3. Print Node coordinates and edges
  const nodes = await prisma.node.findMany({ where: { floorId: 'floor-hudson-f6' } });
  const nodesById = new Map(nodes.map(n => [n.id, n]));

  // Calculate dynamic boundaries from layout JSON just like mapService.ts does
  const layoutData = JSON.parse(fs.readFileSync(path.join('src', 'data', 'Hudson_6th_Floor.json'), 'utf8'));
  const layoutRooms = layoutData.rooms || [];
  const allPoints = layoutRooms.flatMap((room: any) => [
    ...room.polygon,
    ...(room.doors ?? []),
  ]);
  const minX = Math.min(...allPoints.map((p: any) => p.x));
  const maxX = Math.max(...allPoints.map((p: any) => p.x));
  const minY = Math.min(...allPoints.map((p: any) => p.y));
  const maxY = Math.max(...allPoints.map((p: any) => p.y));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const gridCols = 80;
  const gridRows = 80;

  console.log(`\nFloor 6 Layout Bounds (Calculated Dynamically):`);
  console.log(`* minX: ${minX}, maxX: ${maxX}, spanX: ${spanX}`);
  console.log(`* minY: ${minY}, maxY: ${maxY}, spanY: ${spanY}`);

  console.log("\n2. Node details along the path:");
  for (const nodeId of route.pathNodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) continue;

    // Dynamically projected coordinates (corresponds to what the UI renders)
    const projectedGridX = ((node.realX - minX) / spanX) * gridCols;
    const projectedGridY = gridRows - (((node.realY - minY) / spanY) * gridRows);

    console.log(`- Node ${node.id}:`);
    console.log(`  * editorX (rawX in DB): ${node.realX}`);
    console.log(`  * editorY (rawY in DB): ${node.realY}`);
    console.log(`  * projectedGridX (dynamic): ${projectedGridX.toFixed(2)}`);
    console.log(`  * projectedGridY (dynamic): ${projectedGridY.toFixed(2)}`);
    console.log(`  * database gridX: ${node.gridX}`);
    console.log(`  * database gridY: ${node.gridY}`);
  }

  // 4. Edges along the path
  console.log("\n4. Edges used by final path:");
  for (let i = 1; i < route.pathNodeIds.length; i++) {
    const fromId = route.pathNodeIds[i - 1];
    const toId = route.pathNodeIds[i];
    const edge = await prisma.edge.findFirst({
      where: {
        OR: [
          { fromNodeId: fromId, toNodeId: toId },
          { fromNodeId: toId, toNodeId: fromId }
        ]
      }
    });
    if (edge) {
      console.log(`* ${edge.fromNodeId} -> ${edge.toNodeId}`);
      console.log(`  distance/weight: ${edge.weight}`);
    }
  }

  // 5. PathGridCells returned to frontend
  console.log("\n5. pathGridCells returned to frontend:");
  console.log(route.pathGridCells);

  // 6. Compare pathGridCells against projected locations and calculate error
  console.log("\n6. Coordinate systems divergence comparison:");
  for (let i = 0; i < route.pathNodeIds.length; i++) {
    const nodeId = route.pathNodeIds[i];
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const projectedGridX = ((node.realX - minX) / spanX) * gridCols;
    const projectedGridY = gridRows - (((node.realY - minY) / spanY) * gridRows);

    const pathGridCell = route.pathGridCells[i];
    const errX = pathGridCell.x - projectedGridX;
    const errY = pathGridCell.y - projectedGridY;

    console.log(`- Node: ${node.id}`);
    console.log(`  * graphNode projected location: (${projectedGridX.toFixed(2)}, ${projectedGridY.toFixed(2)})`);
    console.log(`  * pathGridCell location:        (${pathGridCell.x.toFixed(2)}, ${pathGridCell.y.toFixed(2)})`);
    console.log(`  * error:                        (dx: ${errX.toFixed(2)}, dy: ${errY.toFixed(2)})`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
