import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nodeTypes = await prisma.node.groupBy({
    by: ['type'],
    _count: {
      id: true
    }
  });
  console.log("Node types in DB:", nodeTypes);

  const edgesCount = await prisma.edge.count();
  console.log("Total edges in DB:", edgesCount);

  const blockedEdges = await prisma.edge.findMany({
    where: {
      isAccessible: false
    }
  });
  console.log("Blocked edges in DB:", blockedEdges);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
