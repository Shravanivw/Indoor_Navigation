import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function main() {
  const result = await getRoute(prisma, {
    fromRoomId: 'editor-floor-hudson-f5-room-reception',
    toRoomId: 'editor-floor-hudson-f5-room-ahu-room'
  });
  console.log('Path Nodes:', result.pathNodeIds);
  console.log('Path Grid Cells:', result.pathGridCells);
  console.log('Steps:', result.steps);
}

main().finally(() => prisma.$disconnect());
