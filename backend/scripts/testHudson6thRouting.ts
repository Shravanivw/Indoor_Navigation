import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const rooms = await prisma.room.findMany({
    where: { floorId: 'floor-hudson-f6' },
    select: { id: true, name: true }
  });

  console.log(`Loaded ${rooms.length} rooms on Hudson Floor 6.`);

  const reception = rooms.find(r => r.name.toLowerCase().includes("reception"));
  const cafeteria = rooms.find(r => r.name.toLowerCase().includes("cafeteria"));

  if (!reception || !cafeteria) {
    console.error("Error: Could not find Reception or Cafeteria on Floor 6!");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n----------------------------------------`);
  console.log(`Testing Route on Floor 6: Reception (${reception.id}) -> Cafeteria (${cafeteria.id})`);
  
  try {
    const route = await getRoute(prisma, {
      fromRoomId: reception.id,
      toRoomId: cafeteria.id
    });
    console.log(`Result: Route found = ${route.found}`);
    console.log(`Total Distance: ${route.totalDistanceM} m`);
    console.log(`Path Grid Cells: ${route.pathGridCells.length}`);
    console.log(`First Cell:`, route.pathGridCells[0]);
    console.log(`Last Cell:`, route.pathGridCells[route.pathGridCells.length - 1]);
    if (!route.found) {
      console.error(`REGRESSION ERROR: Failed to route on Floor 6!`);
    }
  } catch (err) {
    console.error(`Error calculating route on Floor 6:`, err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
