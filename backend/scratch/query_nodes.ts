import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    where: { floorId: 'floor-hudson-f5' }
  });
  console.log('--- ALL ROOMS ON HUDSON F5 ---');
  for (const r of rooms) {
    const nodesCount = await prisma.node.count({ where: { roomId: r.id } });
    console.log(`Room: "${r.name}" (ID: ${r.id}), Nodes linked: ${nodesCount}`);
    if (nodesCount > 0) {
      const nodes = await prisma.node.findMany({ where: { roomId: r.id } });
      console.log(`  Nodes:`, nodes.map(n => ({ id: n.id, label: n.label, type: n.type, gridX: n.gridX, gridY: n.gridY })));
    }
  }
}

main().finally(() => prisma.$disconnect());
