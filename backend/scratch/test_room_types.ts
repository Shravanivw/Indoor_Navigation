import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRoomTypes() {
  const rooms = await prisma.room.findMany({ where: { floorId: 'floor-gurugram-f3' } });
  console.log('Total rooms:', rooms.length);
  const types = Array.from(new Set(rooms.map(r => r.type)));
  console.log('Room types on floor-gurugram-f3:', types);

  const receptions = rooms.filter(r => r.name.toLowerCase().includes('reception') || r.type.toLowerCase().includes('reception'));
  console.log('Receptions found:', receptions.map(r => ({ id: r.id, name: r.name, type: r.type, code: r.code })));

  await prisma.$disconnect();
}

testRoomTypes().catch(console.error);
