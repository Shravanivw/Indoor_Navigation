import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';

  console.log(`=== STAGE 1: DATABASE COUNTS ===`);
  const roomCount = await prisma.room.count({ where: { floorId } });
  const nodeCount = await prisma.node.count({ where: { floorId } });
  const edgeCount = await prisma.edge.count({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } }
      ]
    }
  });

  console.log(`Room count: ${roomCount}`);
  console.log(`Node count: ${nodeCount}`);
  console.log(`Edge count: ${edgeCount}`);

  console.log(`\n=== STAGE 2: ROOM LOOKUP ===`);
  const rooms = await prisma.room.findMany({ where: { floorId } });
  
  // Test case A: Reception -> Cafeteria (Requested by user)
  const sourceA = rooms.find(r => r.name.toLowerCase() === "reception");
  const destA = rooms.find(r => r.name.toLowerCase() === "cafeteria");
  console.log(`[Case A: Reception -> Cafeteria]`);
  console.log(`Source room found:`, sourceA ? `${sourceA.name} (${sourceA.id})` : "NOT FOUND");
  console.log(`Destination room found:`, destA ? `${destA.name} (${destA.id})` : "NOT FOUND");

  // Test case B: Reception -> Dry Pantry (Using valid room as alternative)
  const sourceB = sourceA;
  const destB = rooms.find(r => r.name.toLowerCase().includes("dry pantry"));
  console.log(`\n[Case B: Reception -> Dry Pantry]`);
  console.log(`Source room found:`, sourceB ? `${sourceB.name} (${sourceB.id})` : "NOT FOUND");
  console.log(`Destination room found:`, destB ? `${destB.name} (${destB.id})` : "NOT FOUND");

  if (!sourceB || !destB) {
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== STAGE 3: ENTRY NODE LOOKUP ===`);
  const nodes = await prisma.node.findMany({ where: { floorId } });
  const srcNodeCandidates = nodes.filter(n => n.roomId === sourceB.id);
  const destNodeCandidates = nodes.filter(n => n.roomId === destB.id);
  console.log(`Source candidates:`, srcNodeCandidates.map(n => `${n.id} (roomId: ${n.roomId}, type: ${n.type})`));
  console.log(`Destination candidates:`, destNodeCandidates.map(n => `${n.id} (roomId: ${n.roomId}, type: ${n.type})`));

  console.log(`\n=== STAGE 4: GRAPH CHECK ===`);
  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } }
      ]
    }
  });

  // Build temporary Graph structure to check connected components
  const adjList: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!adjList[edge.fromNodeId]) adjList[edge.fromNodeId] = [];
    if (!adjList[edge.toNodeId]) adjList[edge.toNodeId] = [];
    adjList[edge.fromNodeId].push(edge.toNodeId);
    adjList[edge.toNodeId].push(edge.fromNodeId);
  }

  console.log(`Adjacency list size: ${Object.keys(adjList).length} nodes`);
  const isolatedNodes = nodes.filter(n => !adjList[n.id]);
  console.log(`Isolated nodes count: ${isolatedNodes.length}`);
  if (isolatedNodes.length > 0) {
    console.log(`Isolated node IDs:`, isolatedNodes.map(n => n.id).slice(0, 10));
  }

  console.log(`\n=== STAGE 5: A* ROUTING ===`);
  try {
    const route = await getRoute(prisma, {
      fromRoomId: sourceB.id,
      toRoomId: destB.id
    });
    console.log(`Start Node:`, route.pathNodeIds ? route.pathNodeIds[0] : "N/A");
    console.log(`End Node:`, route.pathNodeIds ? route.pathNodeIds[route.pathNodeIds.length - 1] : "N/A");
    console.log(`Path found?:`, route.found);
    console.log(`Path Node Count:`, route.pathNodeIds?.length);
    console.log(`Total Distance: ${route.totalDistanceM} m`);

    console.log(`\n=== STAGE 6: FRONTEND STRUCTURE ===`);
    console.log(`Route Response object contains:`, Object.keys(route));
    console.log(`pathNodeIds:`, route.pathNodeIds);
    console.log(`pathGridCells length:`, route.pathGridCells?.length);
    console.log(`First Grid Cell:`, route.pathGridCells?.[0]);
    console.log(`Last Grid Cell:`, route.pathGridCells?.[route.pathGridCells.length - 1]);
  } catch (err: any) {
    console.error("A* routing failed with error:", err.message);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
