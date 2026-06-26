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

    // Start with existing edges
    const graphEdges = edges.map(e => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      weight: e.weight,
      isAccessible: e.isAccessible,
    }));

    // Add candidate edge 1: N24 <-> N40
    graphEdges.push({
      fromNodeId: 'editor-floor-hudson-f5-node-n24',
      toNodeId: 'editor-floor-hudson-f5-node-n40',
      weight: 14.21,
      isAccessible: true
    });

    // Add candidate edge 2: J163 <-> N44
    graphEdges.push({
      fromNodeId: 'editor-floor-hudson-f5-node-j163',
      toNodeId: 'editor-floor-hudson-f5-node-n44',
      weight: 81.87,
      isAccessible: true
    });

    const graph = buildGraph(graphNodes, graphEdges);
    const { componentMembers } = computeConnectedComponents(graphNodes, graph.adjacency);

    console.log(`With added edges, there are ${componentMembers.size} connected components:`);
    for (const [compId, members] of componentMembers.entries()) {
      console.log(`- Component ${compId}: size ${members.length} nodes`);
      if (members.length < 10) {
        console.log(`  Members:`, members.map(m => graph.nodesById.get(m)?.label));
      }
    }

  } finally {
    await prisma.$disconnect();
  }
}

main();
