import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.node.findMany({
    where: {
      id: { in: [
        'editor-floor-hudson-f5-node-j145',
        'editor-floor-hudson-f5-node-j147',
        'editor-floor-hudson-f5-node-n24',
        'editor-floor-hudson-f5-node-n40'
      ] }
    }
  });
  console.log(JSON.stringify(nodes, null, 2));
}

main().finally(() => prisma.$disconnect());
