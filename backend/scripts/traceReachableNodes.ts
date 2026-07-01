import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';
  const nodes = await prisma.node.findMany({ where: { floorId } });
  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId } },
        { toNode: { floorId } }
      ]
    }
  });

  const graphNodes = nodes.map(n => ({
    id: n.id,
    floorId: n.floorId,
    roomId: n.roomId,
    gridX: n.gridX,
    gridY: n.gridY,
    realX: n.realX,
    realY: n.realY,
    type: n.type,
    label: n.label
  }));

  const graphEdges = edges.map(e => ({
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    weight: e.weight,
    isAccessible: e.isAccessible,
  }));

  const graph = buildGraph(graphNodes, graphEdges);

  const startId = 'editor-floor-hudson-f6-node-d152';
  const targetId = 'editor-floor-hudson-f6-node-d128';

  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of (graph.adjacency.get(current) ?? [])) {
      queue.push(edge.nodeId);
    }
  }

  console.log(`=== REACHABILITY TRACE ===`);
  console.log(`Total nodes on Floor 6: ${nodes.length}`);
  console.log(`Reachable nodes from Reception (${startId}): ${visited.size}`);
  console.log(`Is target BYOD node (${targetId}) in reachable set? : ${visited.has(targetId)}`);
  
  if (!visited.has(targetId)) {
    console.log("\nTarget node is NOT reachable! Let's check which component the target node belongs to.");
    const targetVisited = new Set<string>();
    const q = [targetId];
    while (q.length) {
      const current = q.shift()!;
      if (targetVisited.has(current)) continue;
      targetVisited.add(current);
      for (const edge of (graph.adjacency.get(current) ?? [])) {
        q.push(edge.nodeId);
      }
    }
    console.log(`Reachable nodes from target BYOD node (${targetId}): ${targetVisited.size}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
