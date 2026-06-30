import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const rooms = await prisma.room.findMany({
    select: { id: true, name: true, floorId: true }
  });

  console.log(`Total rooms in DB: ${rooms.length}`);
  const reception = rooms.find(r => r.id === "room-gf-reception");
  const boardRoom = rooms.find(r => r.id === "room-gf-md-cabin");

  if (!reception || !boardRoom) {
    console.log("Could not find Reception or Board Room!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Routing from: ${reception.name} (${reception.id}) on floor ${reception.floorId}`);
  console.log(`Routing to: ${boardRoom.name} (${boardRoom.id}) on floor ${boardRoom.floorId}`);

  try {
    const route = await getRoute(prisma, {
      fromRoomId: reception.id,
      toRoomId: boardRoom.id
    });
    console.log("Route search finished. Found:", route.found);
    console.log("Steps:", route.steps.length);
    console.log("Path Nodes:", route.pathNodeIds);
    console.log("Path Grid Cells:", route.pathGridCells);
  } catch (err) {
    console.error("Error during routing:", err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
