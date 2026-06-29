import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const rooms = await prisma.room.findMany({
    select: {
      floorId: true,
      type: true,
      name: true,
    }
  });

  const floors = await prisma.floor.findMany();

  console.log("Rooms by floor:");
  for (const floor of floors) {
    const floorRooms = rooms.filter(r => r.floorId === floor.id);
    console.log(`Floor ${floor.name} (${floor.id}, Level ${floor.level}):`);
    const counts: Record<string, number> = {};
    for (const r of floorRooms) {
      counts[r.type] = (counts[r.type] || 0) + 1;
    }
    console.log("  Counts by type:", counts);
    console.log("  Sample rooms:", floorRooms.slice(0, 10).map(r => `${r.name} (${r.type})`));
  }

  await prisma.$disconnect();
}

run().catch(console.error);
