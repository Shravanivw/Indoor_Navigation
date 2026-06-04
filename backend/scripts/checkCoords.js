const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rooms = await p.room.findMany({
    where: { floorId: 'floor-hudson-f5' },
    select: { id: true, name: true, gridX: true, gridY: true, gridW: true, gridH: true },
    orderBy: { name: 'asc' },
  });
  const nodes = await p.node.findMany({
    where: { floorId: 'floor-hudson-f5' },
    select: { id: true, label: true, gridX: true, gridY: true, roomId: true },
    orderBy: { label: 'asc' },
  });
  console.log('\n=== ROOMS (grid coords 0-80) ===');
  rooms.forEach(r => console.log(`  ${r.name.padEnd(30)} gridX=${r.gridX} gridY=${r.gridY} w=${r.gridW} h=${r.gridH}`));
  console.log('\n=== NODES (pixel coords 0-800) ===');
  nodes.forEach(n => console.log(`  ${(n.label||n.id).padEnd(20)} gridX=${n.gridX} gridY=${n.gridY} roomId=${n.roomId||'-'}`));
  await p.$disconnect();
})();
