import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';
import { findRoute } from '../src/engine/astar';

const prisma = new PrismaClient();

function getRoomCandidatesCorrect(
  roomId: string,
  room: { gridX: number; gridY: number; floorId: string },
  graph: any
): string[] {
  const entries = graph.roomEntryNodes.get(roomId) ?? [];
  const connectedEntries = entries.filter((id: string) => (graph.adjacency.get(id)?.length ?? 0) > 0);
  if (connectedEntries.length > 0) {
    return connectedEntries;
  }
  const nearest = findNearestConnectedNodeCorrect(graph, room);
  return nearest ? [nearest] : [];
}

function findNearestConnectedNodeCorrect(
  graph: any,
  room: { gridX: number; gridY: number; floorId: string },
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [nodeId, node] of graph.nodesById) {
    if (node.floorId !== room.floorId) continue;
    if ((graph.adjacency.get(nodeId)?.length ?? 0) === 0) continue;

    const dist = Math.hypot(room.gridX - node.gridX, room.gridY - node.gridY);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = nodeId;
    }
  }
  return bestId;
}

function getPathCost(path: string[], adjacency: any): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const edge = adjacency.get(prev)?.find((e: any) => e.nodeId === curr);
    if (edge) {
      cost += edge.weight;
    }
  }
  return cost;
}

// Breadth-First Search to find connected components
function computeConnectedComponents(
  nodesList: any[],
  adjacency: Map<string, any[]>
): { componentIds: Map<string, number>; componentSizes: Map<number, number>; largestComponentId: number } {
  const visited = new Set<string>();
  const componentIds = new Map<string, number>();
  const componentSizes = new Map<number, number>();
  let currentComponentId = 0;

  for (const node of nodesList) {
    if (visited.has(node.id)) continue;

    // Start a new BFS
    const queue = [node.id];
    let size = 0;
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentIds.set(current, currentComponentId);
      size++;

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          queue.push(neighbor.nodeId);
        }
      }
    }

    componentSizes.set(currentComponentId, size);
    currentComponentId++;
  }

  // Find the largest component ID
  let largestComponentId = -1;
  let maxSize = -1;
  for (const [id, size] of componentSizes.entries()) {
    if (size > maxSize) {
      maxSize = size;
      largestComponentId = id;
    }
  }

  return { componentIds, componentSizes, largestComponentId };
}

async function main() {
  try {
    const nodes = await prisma.node.findMany({ where: { floorId: 'floor-hudson-f5' } });
    const edges = await prisma.edge.findMany({ where: { fromNode: { floorId: 'floor-hudson-f5' } } });

    console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges for Floor Hudson F5.`);

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

    const { componentIds, componentSizes, largestComponentId } = computeConnectedComponents(
      graphNodes,
      graph.adjacency
    );

    console.log(`Computed ${componentSizes.size} connected components.`);
    for (const [compId, size] of componentSizes.entries()) {
      console.log(`- Component ${compId}: size ${size} nodes ${compId === largestComponentId ? '(LARGEST)' : ''}`);
    }

    const roomsToAudit = [
      { name: 'Reception', id: 'editor-floor-hudson-f5-room-reception' },
      { name: 'AHU Room', id: 'editor-floor-hudson-f5-room-ahu-room' },
      { name: 'AHU Room 3', id: 'editor-floor-hudson-f5-room-ahu-room-3' },
      { name: 'DishWash Area', id: 'editor-floor-hudson-f5-room-dishwash-area' },
      { name: 'Balcony 1', id: 'editor-floor-hudson-f5-room-balcony-1' }
    ];

    const resolvedRooms = [];
    for (const roomItem of roomsToAudit) {
      const roomRec = await prisma.room.findFirst({
        where: {
          floorId: 'floor-hudson-f5',
          name: { contains: roomItem.name }
        }
      });
      if (!roomRec) {
        console.error(`Could not find room record in database for name containing ${roomItem.name}`);
        continue;
      }
      resolvedRooms.push({
        label: roomItem.name,
        roomId: roomRec.id,
        dbName: roomRec.name,
        gridX: roomRec.gridX,
        gridY: roomRec.gridY,
        floorId: roomRec.floorId
      });
    }

    // Audit each route from Reception
    const reception = resolvedRooms.find(r => r.label === 'Reception')!;
    const targets = resolvedRooms.filter(r => r.label !== 'Reception');

    for (const target of targets) {
      console.log(`\n======================================================`);
      console.log(`AUDIT ROUTE: Reception (${reception.dbName}) -> ${target.label} (${target.dbName})`);
      console.log(`======================================================`);

      const startCandidates = getRoomCandidatesCorrect(reception.roomId, reception, graph);
      const endCandidates = getRoomCandidatesCorrect(target.roomId, target, graph);

      console.log(`Candidate Source Nodes (Reception):`);
      for (const node of startCandidates) {
        const adj = graph.adjacency.get(node) ?? [];
        const compId = componentIds.get(node);
        const isLCC = compId === largestComponentId;
        console.log(`  - Node: ${node}, Adjacency Count: ${adj.length}, Component ID: ${compId}, Is LCC: ${isLCC}`);
      }

      console.log(`Candidate Destination Nodes (${target.label}):`);
      for (const node of endCandidates) {
        const adj = graph.adjacency.get(node) ?? [];
        const compId = componentIds.get(node);
        const isLCC = compId === largestComponentId;
        console.log(`  - Node: ${node}, Adjacency Count: ${adj.length}, Component ID: ${compId}, Is LCC: ${isLCC}`);
      }

      // Run A* combinations
      let finalBestPath: string[] | null = null;
      let finalBestCost = Infinity;
      console.log(`A* Attempts:`);
      for (const startNode of startCandidates) {
        for (const endNode of endCandidates) {
          const path = findRoute(graph.adjacency, graph.nodesById, startNode, endNode, {});
          if (path) {
            const cost = getPathCost(path, graph.adjacency);
            console.log(`  - Route ${startNode} -> ${endNode}: SUCCESS. Cost: ${cost.toFixed(2)}, Nodes count: ${path.length}`);
            if (cost < finalBestCost) {
              finalBestCost = cost;
              finalBestPath = path;
            }
          } else {
            console.log(`  - Route ${startNode} -> ${endNode}: FAILED (No path found via A*)`);
          }
        }
      }

      console.log(`Final Selected Route Cost: ${finalBestCost === Infinity ? 'N/A (Failed)' : finalBestCost.toFixed(2)}`);
      if (finalBestPath) {
        console.log(`Final Selected Path Nodes:`, finalBestPath);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
