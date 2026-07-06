import { PrismaClient } from '@prisma/client';
import { buildGraph } from '../src/engine/graphBuilder';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';
  const rooms = await prisma.room.findMany({ where: { floorId } });
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

  // We find a reception node as start
  const receptionRoom = rooms.find(r => r.name.toLowerCase() === 'reception');
  if (!receptionRoom) {
    console.error("Could not find Reception room.");
    await prisma.$disconnect();
    return;
  }
  const recNodes = nodes.filter(n => n.roomId === receptionRoom.id);
  if (recNodes.length === 0) {
    console.error("Reception room has no nodes.");
    await prisma.$disconnect();
    return;
  }

  const startId = recNodes[0].id;
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

  console.log(`Reachable nodes from Reception: ${visited.size} / ${nodes.length}`);

  // Find rooms which have NO entry node reachable
  const unreachableRooms: any[] = [];
  const partiallyReachableRooms: any[] = [];
  const fullyReachableRooms: any[] = [];

  for (const room of rooms) {
    const roomNodes = nodes.filter(n => n.roomId === room.id);
    if (roomNodes.length === 0) {
      console.log(`- Room "${room.name}" (${room.id}) has NO NODES at all!`);
      continue;
    }
    const reachableRoomNodes = roomNodes.filter(n => visited.has(n.id));
    if (reachableRoomNodes.length === 0) {
      unreachableRooms.push(room);
    } else if (reachableRoomNodes.length < roomNodes.length) {
      partiallyReachableRooms.push({ room, total: roomNodes.length, reachable: reachableRoomNodes.length });
    } else {
      fullyReachableRooms.push(room);
    }
  }

  console.log(`\n=== UNREACHABLE ROOMS (${unreachableRooms.length}) ===`);
  unreachableRooms.forEach(r => {
    console.log(`- ${r.name} (${r.id}) [Type: ${r.type}]`);
  });

  console.log(`\n=== PARTIALLY REACHABLE ROOMS (${partiallyReachableRooms.length}) ===`);
  partiallyReachableRooms.forEach(p => {
    console.log(`- ${p.room.name} (${p.room.id}): ${p.reachable}/${p.total} nodes reachable`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
