import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';
import { getFloorMap, searchRooms } from '../src/services/mapService';

const prisma = new PrismaClient();

async function testApi() {
  console.log('=== TEST 1: Prisma Buildings ===');
  const buildings = await prisma.building.findMany();
  console.log('Buildings:', buildings.map(b => ({ id: b.id, name: b.name, location: b.location })));

  console.log('\n=== TEST 2: Floors for Gurugram ===');
  const floors = await prisma.floor.findMany({ where: { buildingId: 'building-gurugram' } });
  console.log('Floors:', floors.map(f => ({ id: f.id, name: f.name, level: f.level })));

  console.log('\n=== TEST 3: getFloorMap for floor-gurugram-f3 ===');
  const mapData = await getFloorMap(prisma, 'floor-gurugram-f3');
  console.log('MapData summary:', {
    floorId: mapData?.floorId,
    gridCols: mapData?.gridCols,
    gridRows: mapData?.gridRows,
    roomsCount: mapData?.rooms.length,
    nodesCount: mapData?.nodes.length,
    edgesCount: mapData?.edges.length,
  });

  console.log('\n=== TEST 4: Search rooms "Reception" on Gurugram ===');
  const rec1Results = await searchRooms(prisma, 'Reception', 'floor-gurugram-f3');
  console.log('Reception search results:', rec1Results.map(r => ({ id: r.id, name: r.name, floorId: r.floor.id })));

  console.log('\n=== TEST 5: Search rooms "Design" on Gurugram ===');
  const dtrResults = await searchRooms(prisma, 'Design', 'floor-gurugram-f3');
  console.log('Design search results:', dtrResults.map(r => ({ id: r.id, name: r.name, floorId: r.floor.id })));

  console.log('\n=== TEST 6: getRoute Reception 1 -> Design Thinking Room ===');
  const rec1 = rec1Results.find(r => r.name === 'Reception 1');
  const dtr = dtrResults.find(r => r.name === 'Design Thinking Room');

  if (rec1 && dtr) {
    console.log('Found rec1:', rec1.id, 'and dtr:', dtr.id);
    const route = await getRoute(prisma, {
      fromRoomId: rec1.id,
      toRoomId: dtr.id,
    });
    console.log('Route response:', {
      found: route.found,
      fromRoomId: route.fromRoomId,
      toRoomId: route.toRoomId,
      totalDistanceM: route.totalDistanceM,
      pathNodeIdsLength: route.pathNodeIds.length,
      pathGridCellsLength: route.pathGridCells.length,
      stepsCount: route.steps.length,
      sampleStep: route.steps[0],
      pathGridCellsSample: route.pathGridCells.slice(0, 3)
    });
  }

  await prisma.$disconnect();
}

testApi().catch(console.error);
