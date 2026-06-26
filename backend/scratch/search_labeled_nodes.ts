import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.node.findMany({
    where: {
      floorId: 'floor-hudson-f5',
      OR: [
        { label: { contains: 'AHU' } },
        { label: { contains: 'Balcony' } },
        { label: { contains: 'Dish' } }
      ]
    }
  });
  console.log('Matching Nodes:', JSON.stringify(nodes, null, 2));
}

main().finally(() => prisma.$disconnect());
