import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';
import { buildGraph, validateGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function runValidation() {
  console.log('====================================================');
  console.log('GURUGRAM ROUTING & GRAPH VALIDATION SUITE');
  console.log('====================================================\n');

  // 1. Graph connectivity & isolated nodes check
  console.log('--- 1. Gurugram Graph Connectivity & Component Check ---');
  const ggNodes = await prisma.node.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  const ggEdges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId: 'floor-gurugram-f3' } },
        { toNode: { floorId: 'floor-gurugram-f3' } }
      ]
    }
  });

  const allNodes = await prisma.node.findMany();
  const allEdges = await prisma.edge.findMany();
  const graphNodes = allNodes.map(n => ({
    id: n.id, floorId: n.floorId, roomId: n.roomId,
    gridX: n.gridX, gridY: n.gridY, realX: n.realX, realY: n.realY,
    type: n.type, label: n.label,
  }));
  const graphEdges = allEdges.map(e => ({
    fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, weight: e.weight, isAccessible: e.isAccessible,
  }));

  const graph = buildGraph(graphNodes, graphEdges);
  const ggIsolated = ggNodes.filter(n => (graph.adjacency.get(n.id)?.length ?? 0) === 0);
  console.log(`Gurugram Nodes: ${ggNodes.length}, Edges: ${ggEdges.length}`);
  console.log(`Gurugram Isolated Nodes: ${ggIsolated.length}`);

  // 2. Unreachable rooms check
  console.log('\n--- 2. Unreachable Rooms Check for Gurugram Floor 3 ---');
  const ggRooms = await prisma.room.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  const rec1 = ggRooms.find(r => r.name === 'Reception 1')!;
  let unreachableCount = 0;

  for (const targetRoom of ggRooms) {
    if (targetRoom.id === rec1.id) continue;
    const route = await getRoute(prisma, { fromRoomId: rec1.id, toRoomId: targetRoom.id });
    if (!route.found) {
      console.error(`FAILED route from Reception 1 to ${targetRoom.name} (${targetRoom.id})`);
      unreachableCount++;
    }
  }
  console.log(`Unreachable rooms on Gurugram Floor 3: ${unreachableCount} / ${ggRooms.length - 1}`);

  // 3. Primary Route Test: Reception 1 -> Design Thinking Room
  console.log('\n--- 3. Primary Route Test: Reception 1 -> Design Thinking Room ---');
  const dtr = ggRooms.find(r => r.name === 'Design Thinking Room')!;
  const primaryRoute = await getRoute(prisma, { fromRoomId: rec1.id, toRoomId: dtr.id });
  console.log('Result:', {
    found: primaryRoute.found,
    distanceM: primaryRoute.totalDistanceM,
    nodesCount: primaryRoute.pathNodeIds.length,
    stepsCount: primaryRoute.steps.length,
  });
  console.log('Steps:');
  primaryRoute.steps.forEach((s, idx) => console.log(`  Step ${idx + 1}: ${s.instruction} (${s.distanceM}m)`));

  // 4. Additional Route Tests (at least 5 distinct routes)
  console.log('\n--- 4. Additional Route Tests (5+ Routes) ---');
  const testPairs = [
    { from: 'Reception 1', to: 'Reception 2' },
    { from: 'HUB Room', to: 'Design Thinking Room' },
    { from: 'UPS Room', to: 'Reception 1' },
    { from: 'Reception 2', to: 'HUB Room' },
    { from: 'Design Thinking Room', to: 'UPS Room' },
    { from: 'Reception 1', to: 'HUB Room' },
  ];

  for (const pair of testPairs) {
    const rFrom = ggRooms.find(r => r.name === pair.from);
    const rTo = ggRooms.find(r => r.name === pair.to);
    if (!rFrom || !rTo) {
      console.warn(`Pair missing: ${pair.from} -> ${pair.to}`);
      continue;
    }
    const res = await getRoute(prisma, { fromRoomId: rFrom.id, toRoomId: rTo.id });
    console.log(`✓ Route [${pair.from}] -> [${pair.to}]: ${res.found ? `PASS (${res.totalDistanceM}m, ${res.steps.length} steps)` : 'FAIL'}`);
  }

  // 5. Regression Tests for Hudson, Ganges, and Jupiter
  console.log('\n--- 5. Regression Tests (Hudson, Ganges, Jupiter) ---');
  const regressionFloors = [
    { floorId: 'floor-hudson-f5', name: 'Hudson F5' },
    { floorId: 'floor-ganges-f9', name: 'Ganges F9' },
    { floorId: 'floor-jupiter-f1', name: 'Jupiter F1' },
    { floorId: 'floor-gravity-f1', name: 'Gravity F1' },
  ];

  for (const rf of regressionFloors) {
    const rList = await prisma.room.findMany({ where: { floorId: rf.floorId }, take: 2 });
    if (rList.length < 2) continue;
    const r1 = rList[0];
    const r2 = rList[1];
    const res = await getRoute(prisma, { fromRoomId: r1.id, toRoomId: r2.id });
    console.log(`✓ Regression [${rf.name}] (${r1.name} -> ${r2.name}): ${res.found ? `PASS (${res.totalDistanceM}m)` : 'FAIL'}`);
  }

  console.log('\n====================================================');
  console.log('VALIDATION SUITE COMPLETE');
  console.log('====================================================');

  await prisma.$disconnect();
}

runValidation().catch(console.error);
