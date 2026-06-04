const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.room.update({
    where: { id: 'room-h5-cafeteria' },
    data:  { type: 'PANTRY' },
  });
  console.log('Done — Cafeteria type updated to PANTRY');
  await p.$disconnect();
})();
