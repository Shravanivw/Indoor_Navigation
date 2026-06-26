import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';

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

    const roomsToAudit = [
      { name: 'Reception', id: 'editor-floor-hudson-f5-room-reception' },
      { name: 'AHU Room', id: 'editor-floor-hudson-f5-room-ahu-room' },
      { name: 'AHU Room 3', id: 'editor-floor-hudson-f5-room-ahu-room-3' },
      { name: 'DishWash Area', id: 'editor-floor-hudson-f5-room-dishwash-area' },
      { name: 'Balcony 1', id: 'editor-floor-hudson-f5-room-balcony-1' }
    ];

    for (const roomItem of roomsToAudit) {
      const roomRec = await prisma.room.findFirst({
        where: { floorId: 'floor-hudson-f5', name: { contains: roomItem.name } }
      });
      if (!roomRec) continue;
      
      console.log(`\nRoom: ${roomRec.name}`);
      console.log(`- Original candidates (from DB):`, graph.roomEntryNodes.get(roomRec.id) ?? []);
      console.log(`- Corrected Candidates:`, getRoomCandidatesCorrect(roomRec.id, roomRec, graph));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
