import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';
  const rooms = await prisma.room.findMany({ where: { floorId } });

  console.log("=== ROOM LOOKUPS ON FLOOR 6 ===");
  const findRoom = (query: string) => {
    const matched = rooms.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
    console.log(`Query "${query}":`, matched.map(r => `${r.name} (${r.id})`));
    return matched[0];
  };

  const reception = findRoom("reception");
  const cafeteria = findRoom("cafeteria");
  const meeting = findRoom("meeting") || findRoom("conference") || findRoom("pax");
  const pantry = findRoom("pantry");
  const lift = findRoom("lift");

  console.log("\n=== EXECUTING TEST ROUTES ===");
  const testRoute = async (fromRoom: any, toRoom: any, label: string) => {
    if (!fromRoom || !toRoom) {
      console.log(`\n[${label}] Skipped - room missing.`);
      return;
    }
    console.log(`\n[${label}]: ${fromRoom.name} -> ${toRoom.name}`);
    try {
      const route = await getRoute(prisma, {
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id
      });
      console.log(`* Source Node:`, route.pathNodeIds ? route.pathNodeIds[0] : "N/A");
      console.log(`* Destination Node:`, route.pathNodeIds ? route.pathNodeIds[route.pathNodeIds.length - 1] : "N/A");
      console.log(`* Graph Node Count:`, route.pathNodeIds?.length ?? 0);
      console.log(`* Total Distance: ${route.totalDistanceM} m`);
      console.log(`* Route Found: ${route.found}`);
    } catch (err: any) {
      console.error(`* Route failed:`, err.message);
    }
  };

  await testRoute(reception, cafeteria, "Reception -> Cafeteria");
  await testRoute(reception, meeting, "Reception -> Meeting Room");
  await testRoute(reception, pantry, "Reception -> Pantry");
  await testRoute(reception, lift, "Reception -> Lift");

  await prisma.$disconnect();
}

run().catch(console.error);
