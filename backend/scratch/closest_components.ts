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

    const comp0 = componentMembers.get(0)!; // LCC
    const comp1 = componentMembers.get(1)!; // DishWash / Balcony 1
    const comp2 = componentMembers.get(2)!; // AHU Room

    console.log('--- CLOSEST NODES COMPONENT 0 <-> COMPONENT 1 ---');
    let minD1 = Infinity;
    let bestC0_1 = null, bestC1 = null;
    for (const id0 of comp0) {
      const n0 = graph.nodesById.get(id0)!;
      for (const id1 of comp1) {
        const n1 = graph.nodesById.get(id1)!;
        const d = Math.hypot(n0.gridX - n1.gridX, n0.gridY - n1.gridY);
        if (d < minD1) {
          minD1 = d;
          bestC0_1 = n0;
          bestC1 = n1;
        }
      }
    }
    console.log(`Min Distance: ${minD1.toFixed(2)} px`);
    console.log(`Component 0 Node: ${bestC0_1?.id} ("${bestC0_1?.label}") at (${bestC0_1?.gridX}, ${bestC0_1?.gridY})`);
    console.log(`Component 1 Node: ${bestC1?.id} ("${bestC1?.label}") at (${bestC1?.gridX}, ${bestC1?.gridY})`);

    console.log('\n--- CLOSEST NODES COMPONENT 0 <-> COMPONENT 2 ---');
    let minD2 = Infinity;
    let bestC0_2 = null, bestC2 = null;
    for (const id0 of comp0) {
      const n0 = graph.nodesById.get(id0)!;
      for (const id2 of comp2) {
        const n2 = graph.nodesById.get(id2)!;
        const d = Math.hypot(n0.gridX - n2.gridX, n0.gridY - n2.gridY);
        if (d < minD2) {
          minD2 = d;
          bestC0_2 = n0;
          bestC2 = n2;
        }
      }
    }
    console.log(`Min Distance: ${minD2.toFixed(2)} px`);
    console.log(`Component 0 Node: ${bestC0_2?.id} ("${bestC0_2?.label}") at (${bestC0_2?.gridX}, ${bestC0_2?.gridY})`);
    console.log(`Component 2 Node: ${bestC2?.id} ("${bestC2?.label}") at (${bestC2?.gridX}, ${bestC2?.gridY})`);

  } finally {
    await prisma.$disconnect();
  }
}

main();
