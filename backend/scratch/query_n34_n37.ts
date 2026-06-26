import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.node.findMany({
    where: {
      id: { in: [
        'editor-floor-hudson-f5-node-n34',
        'editor-floor-hudson-f5-node-n37'
      ] }
    }
  });
  console.log(JSON.stringify(nodes, null, 2));
}

main().finally(() => prisma.$disconnect());
