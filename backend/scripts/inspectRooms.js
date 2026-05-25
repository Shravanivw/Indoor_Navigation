const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rooms = await p.room.findMany({
    select: { id: true, name: true, type: true, gridX: true, gridY: true, gridW: true, gridH: true, centreX: true, centreY: true, floorId: true },
    orderBy: { name: 'asc' },
  });
  const floors = await p.floor.findMany({
    select: { id: true, level: true, name: true, gridCols: true, gridRows: true, scaleX: true, scaleY: true, widthM: true, heightM: true },
  });
  const types = await p.room.groupBy({ by: ['type'], _count: true });
  console.log('FLOORS:', JSON.stringify(floors, null, 2));
  console.log('TYPES:', JSON.stringify(types, null, 2));
  console.log('ROOMS (first 8):', JSON.stringify(rooms.slice(0, 8), null, 2));
  console.log('Room coord ranges:',
    {
      gridX: [Math.min(...rooms.map(r => r.gridX)), Math.max(...rooms.map(r => r.gridX))],
      gridY: [Math.min(...rooms.map(r => r.gridY)), Math.max(...rooms.map(r => r.gridY))],
      centreX: [Math.min(...rooms.map(r => r.centreX)), Math.max(...rooms.map(r => r.centreX))],
      centreY: [Math.min(...rooms.map(r => r.centreY)), Math.max(...rooms.map(r => r.centreY))],
    });
  await p.$disconnect();
})();
