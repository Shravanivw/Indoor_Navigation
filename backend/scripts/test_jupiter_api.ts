import { PrismaClient } from '@prisma/client';
import { getFloorMap, getFloorGeometry, getAllFloors } from '../src/services/mapService';

const prisma = new PrismaClient();

async function testApi() {
  console.log('Testing mapService for Jupiter...\n');

  const buildings = await prisma.building.findMany({ select: { id: true, name: true } });
  console.log('Registered Buildings in DB:');
  buildings.forEach(b => console.log(`  - ${b.name} (${b.id})`));

  const floors = await getAllFloors(prisma, 'building-jupiter');
  console.log('\nFloors for building-jupiter:');
  floors.forEach(f => console.log(`  - ${f.name} (Level: ${f.level}, ID: ${f.id}, Rooms: ${f._count.rooms})`));

  const mapData = await getFloorMap(prisma, 'floor-jupiter-f1');
  console.log('\nMap Data for floor-jupiter-f1:');
  console.log(`  - Level: ${mapData?.level}`);
  console.log(`  - Grid: ${mapData?.gridCols} x ${mapData?.gridRows}`);
  console.log(`  - Rooms count: ${mapData?.rooms.length}`);
  console.log(`  - Nodes count: ${mapData?.nodes.length}`);
  console.log(`  - Edges count: ${mapData?.edges.length}`);
  console.log(`  - Sample Room 1: ${mapData?.rooms[0]?.name} at (${mapData?.rooms[0]?.gridX}, ${mapData?.rooms[0]?.gridY}), Polygon points: ${mapData?.rooms[0]?.polygon?.length ?? 0}`);

  const geomData = await getFloorGeometry(prisma, 'floor-jupiter-f1');
  console.log('\nGeometry Data for floor-jupiter-f1:');
  console.log(`  - Bounding Box: ${JSON.stringify(geomData?.boundingBox)}`);
  console.log(`  - Walls count: ${geomData?.walls.length}`);

  await prisma.$disconnect();
}

testApi().catch(console.error);
