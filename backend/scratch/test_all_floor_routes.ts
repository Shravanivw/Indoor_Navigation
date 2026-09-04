import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function testAllRoutes() {
  const floors = ['floor-hudson-f5', 'floor-ganges-f9', 'floor-jupiter-f1', 'floor-gravity-f1', 'floor-gurugram-f3'];
  
  for (const fid of floors) {
    const rooms = await prisma.room.findMany({ where: { floorId: fid } });
    if (rooms.length < 2) continue;
    const r1 = rooms[0];
    const r2 = rooms[1];
    try {
      const res = await getRoute(prisma, { fromRoomId: r1.id, toRoomId: r2.id });
      console.log(`\nFloor: ${fid}`);
      console.log(`  Route ${r1.name} -> ${r2.name}: found=${res.found}, dist=${res.totalDistanceM}m, steps=${res.steps.length}`);
      if (res.pathGridCells.length > 0) {
        console.log(`  Sample pathGridCell[0]:`, res.pathGridCells[0]);
        console.log(`  Sample pathGridCell[last]:`, res.pathGridCells[res.pathGridCells.length - 1]);
      }
    } catch (e: any) {
      console.log(`\nFloor: ${fid} ERROR:`, e.message);
    }
  }

  await prisma.$disconnect();
}

testAllRoutes().catch(console.error);
