import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const floorId = 'floor-hudson-f6';
  const rooms = await prisma.room.findMany({
    where: { floorId },
    orderBy: { name: 'asc' }
  });

  console.log(`--- Hudson 6th Floor Rooms (${rooms.length}) ---`);
  rooms.forEach(r => {
    console.log(`Name: "${r.name}", Type: "${r.type}", Capacity: ${r.capacity}`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
