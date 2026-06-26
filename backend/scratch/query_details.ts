import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    where: {
      floorId: 'floor-hudson-f5',
      name: { in: ['Reception', 'AHU Room', 'AHU Room 3', 'DishWash Area', 'Balcony 1'] }
    }
  });
  console.log(JSON.stringify(rooms, null, 2));
}

main().finally(() => prisma.$disconnect());
