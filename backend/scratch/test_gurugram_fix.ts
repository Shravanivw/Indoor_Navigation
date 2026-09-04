import { PrismaClient } from '@prisma/client';
import { projectHudsonCoordinate } from '../src/utils/projection';

const prisma = new PrismaClient();

async function testGurugramCoords() {
  console.log('=== GURUGRAM ROOMS & NODES IN DB ===');
  const rooms = await prisma.room.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  const nodes = await prisma.node.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  const floor = await prisma.floor.findUnique({ where: { id: 'floor-gurugram-f3' } });

  console.log('Floor DB gridCols:', floor?.gridCols, 'gridRows:', floor?.gridRows);

  const rec1 = rooms.find(r => r.name === 'Reception 1');
  const dtr = rooms.find(r => r.name === 'Design Thinking Room');

  console.log('Reception 1 room DB coords:', { gridX: rec1?.gridX, gridY: rec1?.gridY, centreX: rec1?.centreX, centreY: rec1?.centreY });
  console.log('Design Thinking Room DB coords:', { gridX: dtr?.gridX, gridY: dtr?.gridY, centreX: dtr?.centreX, centreY: dtr?.centreY });

  const rec1Node = nodes.find(n => n.id === 'editor-floor-gurugram-f3-node-d52');
  const dtrNode = nodes.find(n => n.id === 'editor-floor-gurugram-f3-node-d122');

  console.log('Reception 1 Node d52 DB coords:', { gridX: rec1Node?.gridX, gridY: rec1Node?.gridY });
  console.log('Design Thinking Room Node d122 DB coords:', { gridX: dtrNode?.gridX, gridY: dtrNode?.gridY });

  // Compare distances:
  // In native pixel grid space:
  const nativeDistX = (dtrNode!.gridX - rec1Node!.gridX) * (floor?.scaleX ?? 1);
  const nativeDistY = (dtrNode!.gridY - rec1Node!.gridY) * (floor?.scaleY ?? 1);
  const nativeDistM = Math.hypot(nativeDistX, nativeDistY);
  console.log(`Native distance in metres: ${nativeDistM.toFixed(2)}m`);

  await prisma.$disconnect();
}

testGurugramCoords().catch(console.error);
