import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const fromRoomId = 'editor-floor-hudson-f6-room-reception';
  const toRoomId = 'editor-floor-hudson-f6-room-10-pax-byod-room';

  console.log("=== TRACING BYOD ROUTE ===");
  const fromRoom = await prisma.room.findUnique({ where: { id: fromRoomId } });
  const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });

  console.log("From Room:", fromRoom ? `${fromRoom.name} (${fromRoom.id})` : "NOT FOUND");
  console.log("To Room:", toRoom ? `${toRoom.name} (${toRoom.id})` : "NOT FOUND");

  if (!fromRoom || !toRoom) return;

  const nodes = await prisma.node.findMany({ where: { floorId: 'floor-hudson-f6' } });
  const fromNodes = nodes.filter(n => n.roomId === fromRoomId);
  const toNodes = nodes.filter(n => n.roomId === toRoomId);

  console.log("From Room Nodes:", fromNodes.map(n => n.id));
  console.log("To Room Nodes:", toNodes.map(n => n.id));

  // Run routing service lookup
  const route = await getRoute(prisma, { fromRoomId, toRoomId });
  console.log("\nRouting Service Result:");
  console.log(`* found: ${route.found}`);
  console.log(`* pathNodeIds:`, route.pathNodeIds);

  await prisma.$disconnect();
}

run().catch(console.error);
