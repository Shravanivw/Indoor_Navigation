const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const nodesTotal = await p.node.count();
  const nodesAllZero = await p.node.count({
    where: { gridX: 0, gridY: 0, realX: 0, realY: 0 },
  });
  const nodesGridZero = await p.node.count({ where: { gridX: 0, gridY: 0 } });
  const nodesRealZero = await p.node.count({ where: { realX: 0, realY: 0 } });

  const sessionsTotal = await p.navSession.count();
  const sessionsFromEmpty = await p.navSession.count({
    where: { OR: [{ fromRoomId: '' }, { fromRoomId: '0' }] },
  });
  const sessionsToEmpty = await p.navSession.count({
    where: { OR: [{ toRoomId: '' }, { toRoomId: '0' }] },
  });

  console.log('=== Nodes ===');
  console.log('Total nodes              :', nodesTotal);
  console.log('All coords = 0 (grid+real):', nodesAllZero);
  console.log('gridX=0 AND gridY=0      :', nodesGridZero);
  console.log('realX=0 AND realY=0      :', nodesRealZero);

  console.log('\n=== NavSessions ===');
  console.log('Total sessions           :', sessionsTotal);
  console.log('fromRoomId empty/"0"     :', sessionsFromEmpty);
  console.log('toRoomId empty/"0"       :', sessionsToEmpty);

  const sampleNodes = await p.node.findMany({
    take: 5,
    select: { id: true, gridX: true, gridY: true, realX: true, realY: true, type: true, label: true },
  });
  console.log('\nSample nodes:', JSON.stringify(sampleNodes, null, 2));

  const sampleSessions = await p.navSession.findMany({
    take: 5,
    select: { id: true, fromRoomId: true, toRoomId: true, distance: true, duration: true },
  });
  console.log('\nSample sessions:', JSON.stringify(sampleSessions, null, 2));

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
