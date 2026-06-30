import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const rooms = await prisma.room.findMany({
    where: { floorId: 'floor-hudson-f5' },
    select: { id: true, name: true }
  });

  console.log(`Loaded ${rooms.length} rooms on Hudson Floor 5.`);

  const reception = rooms.find(r => r.name.toLowerCase().includes("reception"));
  const cafeteria = rooms.find(r => r.name.toLowerCase().includes("cafeteria"));
  const trainingRoom = rooms.find(r => r.name.toLowerCase().includes("training room"));
  const arvrLab = rooms.find(r => r.name.toLowerCase().includes("ar/vr lab"));
  const femaleShower = rooms.find(r => r.name.toLowerCase().includes("female shower"));
  const balcony1 = rooms.find(r => r.name.toLowerCase().includes("balcony 1"));

  const targets = {
    "Cafeteria": cafeteria,
    "Training Room": trainingRoom,
    "AR/VR Lab": arvrLab,
    "Female Shower": femaleShower,
    "Balcony 1": balcony1
  };

  if (!reception) {
    console.error("Error: Could not find Reception on Floor 5!");
    await prisma.$disconnect();
    return;
  }

  for (const [name, target] of Object.entries(targets)) {
    if (!target) {
      console.error(`Error: Could not find ${name} on Floor 5!`);
      continue;
    }

    console.log(`\n----------------------------------------`);
    console.log(`Testing Route: Reception (${reception.id}) -> ${name} (${target.id})`);
    
    try {
      const route = await getRoute(prisma, {
        fromRoomId: reception.id,
        toRoomId: target.id
      });
      console.log(`Result: Route found = ${route.found}`);
      console.log(`Total Distance: ${route.totalDistanceM} m`);
      console.log(`Path Grid Cells: ${route.pathGridCells.length}`);
      console.log(`First Cell:`, route.pathGridCells[0]);
      console.log(`Last Cell:`, route.pathGridCells[route.pathGridCells.length - 1]);
      if (!route.found) {
        console.error(`REGRESSION ERROR: Failed to route to ${name}!`);
      }
    } catch (err) {
      console.error(`Error calculating route to ${name}:`, err);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
