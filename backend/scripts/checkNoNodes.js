const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const nodes = await p.node.findMany({ select: { roomId: true } });
  const nodeRoomIds = new Set(nodes.map(n => n.roomId).filter(Boolean));
  const noNode = await p.room.findMany({
    where: { floorId: 'floor-hudson-f5' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  noNode.forEach(r => {
    const has = nodeRoomIds.has(r.id);
    console.log((has ? '  OK' : '  NO'), r.id, '-', r.name);
  });
  await p.$disconnect();
})();
