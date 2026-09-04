import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function inspectFloors() {
  const floors = await prisma.floor.findMany({ include: { building: true } });
  console.log('=== FLOORS IN DB ===');
  for (const f of floors) {
    console.log({
      id: f.id,
      name: f.name,
      building: f.building.name,
      gridCols: f.gridCols,
      gridRows: f.gridRows,
      widthM: f.widthM,
      heightM: f.heightM,
      scaleX: f.scaleX,
      scaleY: f.scaleY,
    });
  }

  console.log('\n=== SAMPLE ROOMS COORDS COMPARISON ===');
  for (const fid of ['floor-hudson-f5', 'floor-ganges-f9', 'floor-jupiter-f1', 'floor-gurugram-f3']) {
    const room = await prisma.room.findFirst({ where: { floorId: fid } });
    const node = await prisma.node.findFirst({ where: { floorId: fid } });
    console.log(`Floor ${fid}:`);
    console.log('  Room sample:', room ? { code: room.code, gridX: room.gridX, gridY: room.gridY, centreX: room.centreX, centreY: room.centreY } : 'NONE');
    console.log('  Node sample:', node ? { id: node.id, gridX: node.gridX, gridY: node.gridY, realX: node.realX, realY: node.realY } : 'NONE');
  }

  await prisma.$disconnect();
}

inspectFloors().catch(console.error);
