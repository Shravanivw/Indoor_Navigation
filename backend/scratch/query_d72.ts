import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const node = await prisma.node.findUnique({
    where: { id: 'editor-floor-hudson-f5-node-d72' }
  });
  console.log('Node d72:', node);
}

main().finally(() => prisma.$disconnect());
