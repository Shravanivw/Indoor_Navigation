import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

// Breadth-First Search to find connected components
function computeConnectedComponents(
  nodesList: any[],
  adjacency: Map<string, any[]>
) {
  const visited = new Set<string>();
  const componentIds = new Map<string, number>();
  const componentMembers = new Map<number, string[]>();
  let currentComponentId = 0;

  for (const node of nodesList) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const members: string[] = [];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentIds.set(current, currentComponentId);
      members.push(current);

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          queue.push(neighbor.nodeId);
        }
      }
    }

    componentMembers.set(currentComponentId, members);
    currentComponentId++;
  }

  return { componentIds, componentMembers };
}

async function main() {
  try {
    const nodes = await prisma.node.findMany({ where: { floorId: 'floor-hudson-f5' } });
    const edges = await prisma.edge.findMany({ where: { fromNode: { floorId: 'floor-hudson-f5' } } });

    const graphNodes = nodes.map(n => ({
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

    const graphEdges = edges.map(e => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      weight: e.weight,
      isAccessible: e.isAccessible,
    }));

    const graph = buildGraph(graphNodes, graphEdges);
    const { componentIds, componentMembers } = computeConnectedComponents(graphNodes, graph.adjacency);

    for (const [compId, members] of componentMembers.entries()) {
      console.log(`\nComponent ${compId} (${members.length} nodes):`);
      for (const nodeId of members) {
        const node = graph.nodesById.get(nodeId)!;
        const adj = graph.adjacency.get(nodeId) ?? [];
        console.log(`  - Node: ${node.id}, Label: "${node.label}", Room: "${node.roomId}", Type: ${node.type}, Adjacency: ${adj.map(e => e.nodeId).join(', ')}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
