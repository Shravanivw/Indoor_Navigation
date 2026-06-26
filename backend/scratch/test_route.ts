import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

async function run() {
  try {
    const route = await getRoute(prisma, {
      fromRoomId: 'room-gf-reception',
      toRoomId: 'room-gf-cafeteria',
    });
    console.log('Route Result:', JSON.stringify(route, null, 2));
  } catch (err) {
    console.error('Error finding route:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
