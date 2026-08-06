import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';

async function test() {
  const prisma = new PrismaClient();
  const rawNode = await prisma.node.findFirst({ where: { floorId: 'floor-hudson-f5' } });
  console.log('Raw DB Node:', { id: rawNode?.id, gridX: rawNode?.gridX, gridY: rawNode?.gridY, realX: rawNode?.realX, realY: rawNode?.realY });

  const map = await getFloorMap(prisma, 'floor-hudson-f5');
  const mapNode = map?.nodes.find(n => n.id === rawNode?.id);
  console.log('Map API Node:', { id: mapNode?.id, gridX: mapNode?.gridX, gridY: mapNode?.gridY, realX: mapNode?.realX, realY: mapNode?.realY });

  await prisma.$disconnect();
}

test();
