import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const rooms = await prisma.room.findMany({
    where: { floorId: 'floor-hudson-f6' },
    select: { id: true, name: true }
  });

  console.log(`Loaded ${rooms.length} rooms on Hudson Floor 6.`);

  const start = rooms.find(r => r.name.toLowerCase().includes("rpa lab"));
  const destination = rooms.find(r => r.name.toLowerCase().includes("noc room"));

  if (!start || !destination) {
    console.error("Error: Could not find RPA Lab or NOC Room on Floor 6!");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n----------------------------------------`);
  console.log(`Testing Route on Floor 6: ${start.name} (${start.id}) -> ${destination.name} (${destination.id})`);
  
  try {
    const route = await getRoute(prisma, {
      fromRoomId: start.id,
      toRoomId: destination.id
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
