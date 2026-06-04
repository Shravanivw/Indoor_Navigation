const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const nodes = await p.node.findMany({ select: { id: true, roomId: true, label: true, floorId: true } });
  const rooms = await p.room.findMany({ select: { id: true, name: true, floorId: true } });
  const nodeRoomIds = new Set(nodes.map(n => n.roomId).filter(Boolean));
  const noNode = rooms.filter(r => !nodeRoomIds.has(r.id));
  console.log('Total rooms:', rooms.length);
  console.log('Rooms WITH nav nodes:', nodeRoomIds.size);
  console.log('Rooms WITHOUT nav nodes (' + noNode.length + '):');
  noNode.forEach(r => console.log(' -', r.name, '(' + r.floorId + ')'));
  await p.$disconnect();
})();
