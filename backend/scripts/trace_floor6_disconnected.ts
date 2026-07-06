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

  const startId = 'editor-floor-hudson-f6-node-d152'; // Reception
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

  const unreachableNodes = nodes.filter(n => !visited.has(n.id));
  console.log(`Found ${unreachableNodes.length} unreachable nodes out of ${nodes.length} total nodes.`);

  // Group unreachable nodes by room ID or category
  const unreachableByRoom: Record<string, typeof unreachableNodes> = {};
  for (const n of unreachableNodes) {
    const key = n.roomId || 'Corridor/Junction/Waypoint';
    if (!unreachableByRoom[key]) unreachableByRoom[key] = [];
    unreachableByRoom[key].push(n);
  }

  console.log('\n=== UNREACHABLE NODES BY ROOM ===');
  for (const [roomId, rNodes] of Object.entries(unreachableByRoom)) {
    let roomName = 'Corridor/Junction/Waypoint';
    if (roomId !== 'Corridor/Junction/Waypoint') {
      const rm = await prisma.room.findUnique({ where: { id: roomId } });
      roomName = rm ? `${rm.name} (${rm.id})` : roomId;
    }
    console.log(`\nRoom: ${roomName}`);
    for (const node of rNodes) {
      const neighbors = graph.adjacency.get(node.id) ?? [];
      const neighborList = neighbors.map(nb => {
        const nbNode = nodes.find(n => n.id === nb.nodeId);
        return `${nb.nodeId} (${nbNode?.label || 'unknown'})`;
      }).join(', ');
      console.log(`  - Node: ${node.id} (${node.label}) at (${node.realX}, ${node.realY}) | Connected to: [${neighborList}]`);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
