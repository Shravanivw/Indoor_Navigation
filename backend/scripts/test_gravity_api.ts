import { PrismaClient } from '@prisma/client';
import { getFloorMap, getAllFloors } from '../src/services/mapService';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function testGravity() {
  console.log('--- Testing Gravity API ---\n');

  const buildings = await prisma.building.findMany();
  console.log('All Buildings in DB:');
  buildings.forEach(b => console.log(`  - ${b.name} (${b.id}) @ ${b.location}`));

  const floors = await getAllFloors(prisma, 'building-gravity');
  console.log('\nFloors for building-gravity:');
  floors.forEach(f => console.log(`  - ${f.name} (ID: ${f.id}, Level: ${f.level}, Rooms: ${f._count.rooms})`));

  const mapData = await getFloorMap(prisma, 'floor-gravity-f1');
  console.log('\nGravity Floor Map Details:');
  console.log(`  - Level: ${mapData?.level}`);
  console.log(`  - Rooms count: ${mapData?.rooms.length}`);
  console.log(`  - Nodes count: ${mapData?.nodes.length}`);
  console.log(`  - Edges count: ${mapData?.edges.length}`);
  if (mapData?.rooms && mapData.rooms.length > 0) {
    console.log(`  - Sample Room 1: ${mapData.rooms[0].name} (${mapData.rooms[0].code}), Polygons: ${mapData.rooms[0].polygon?.length}`);
    console.log(`  - Sample Room 2: ${mapData.rooms[1].name} (${mapData.rooms[1].code}), Polygons: ${mapData.rooms[1].polygon?.length}`);
  }

  // Test A* route between two rooms in Gravity
  if (mapData?.rooms && mapData.rooms.length >= 2) {
    const roomA = mapData.rooms[0];
    const roomB = mapData.rooms[1];
    console.log(`\nTesting A* Route Calculation from "${roomA.name}" to "${roomB.name}"...`);
    const route = await getRoute(prisma, {
      fromRoomId: roomA.id,
      toRoomId: roomB.id,
    });
    console.log(`  - Route found: ${route.found}`);
    console.log(`  - Distance: ${route.totalDistanceM}m`);
    console.log(`  - Path nodes count: ${route.pathNodeIds.length}`);
    console.log(`  - Steps count: ${route.steps.length}`);
  }

  await prisma.$disconnect();
}

testGravity().catch(console.error);
