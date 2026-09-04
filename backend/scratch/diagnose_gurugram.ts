import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';
import { buildGraph, validateGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== 1. CHECKING ROOMS IN DB FOR GURUGRAM ===');
  const rooms = await prisma.room.findMany({
    where: { floorId: 'floor-gurugram-f3' },
    include: { floor: { include: { building: true } } }
  });
  console.log(`Total rooms found for floor-gurugram-f3: ${rooms.length}`);
  
  const rec1 = rooms.find(r => r.name.toLowerCase().includes('reception 1') || r.code.toLowerCase().includes('reception 1'));
  const dtr = rooms.find(r => r.name.toLowerCase().includes('design thinking') || r.code.toLowerCase().includes('design thinking'));
  
  console.log('Reception 1 room:', rec1 ? { id: rec1.id, name: rec1.name, code: rec1.code, gridX: rec1.gridX, gridY: rec1.gridY, centreX: rec1.centreX, centreY: rec1.centreY, floorId: rec1.floorId } : 'NOT FOUND');
  console.log('Design Thinking Room:', dtr ? { id: dtr.id, name: dtr.name, code: dtr.code, gridX: dtr.gridX, gridY: dtr.gridY, centreX: dtr.centreX, centreY: dtr.centreY, floorId: dtr.floorId } : 'NOT FOUND');

  console.log('\n=== 2. CHECKING GRAPH DATA FOR GURUGRAM ===');
  const ggNodes = await prisma.node.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  const ggEdges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId: 'floor-gurugram-f3' } },
        { toNode: { floorId: 'floor-gurugram-f3' } }
      ]
    }
  });

  console.log(`Nodes count for floor-gurugram-f3: ${ggNodes.length}`);
  console.log(`Edges count for floor-gurugram-f3: ${ggEdges.length}`);
  if (ggNodes.length > 0) {
    console.log('Sample Node 0:', ggNodes[0]);
  }

  // Build full graph and validate
  const allNodes = await prisma.node.findMany();
  const allEdges = await prisma.edge.findMany();
  const graphNodes = allNodes.map(n => ({
    id: n.id,
    floorId: n.floorId,
    roomId: n.roomId,
    gridX: n.gridX,
    gridY: n.gridY,
    realX: n.realX,
    realY: n.realY,
    type: n.type,
    label: n.label,
  }));
  const graphEdges = allEdges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  const graph = buildGraph(graphNodes, graphEdges);
  const stats = validateGraph(graph);
  console.log('\nGlobal Graph Stats:', {
    totalNodes: stats.totalNodes,
    totalEdges: stats.totalEdges,
    isolatedNodesCount: stats.isolatedNodes.length
  });

  // Check room entry nodes in graph for rec1 and dtr
  if (rec1) {
    const rec1Entries = graph.roomEntryNodes.get(rec1.id) ?? [];
    console.log(`Reception 1 (${rec1.id}) entry nodes in graph:`, rec1Entries);
    for (const eid of rec1Entries) {
      console.log(`  Entry ${eid} adj count:`, graph.adjacency.get(eid)?.length ?? 0);
      console.log(`  Entry ${eid} in LCC:`, graph.lccNodes?.has(eid));
    }
  }

  if (dtr) {
    const dtrEntries = graph.roomEntryNodes.get(dtr.id) ?? [];
    console.log(`Design Thinking Room (${dtr.id}) entry nodes in graph:`, dtrEntries);
    for (const eid of dtrEntries) {
      console.log(`  Entry ${eid} adj count:`, graph.adjacency.get(eid)?.length ?? 0);
      console.log(`  Entry ${eid} in LCC:`, graph.lccNodes?.has(eid));
    }
  }

  console.log('\n=== 3. CALLING getRoute SERVICE ===');
  if (rec1 && dtr) {
    try {
      const routeResult = await getRoute(prisma, {
        fromRoomId: rec1.id,
        toRoomId: dtr.id,
      });
      console.log('Route Result found:', routeResult.found);
      console.log('Route Result totalDistanceM:', routeResult.totalDistanceM);
      console.log('Route Result pathNodeIds length:', routeResult.pathNodeIds.length);
      console.log('Route Result steps count:', routeResult.steps.length);
      console.log('Route Result sample steps:', routeResult.steps.slice(0, 3));
      console.log('Route Result pathGridCells sample:', routeResult.pathGridCells.slice(0, 3));
    } catch (err) {
      console.error('Error in getRoute:', err);
    }
  }

  await prisma.$disconnect();
}

diagnose().catch(console.error);
