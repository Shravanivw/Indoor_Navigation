import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up Ganges Ground Floor (floor-gf)...');
  const FLOOR_ID = 'floor-gf';

  // 1. Delete nav sessions that reference rooms on floor-gf
  console.log('  Deleting dependent nav sessions...');
  await prisma.navSession.deleteMany({
    where: {
      OR: [
        { fromRoom: { floorId: FLOOR_ID } },
        { toRoom: { floorId: FLOOR_ID } },
      ],
    },
  });

  // 2. Delete edges connected to floor-gf nodes
  console.log('  Deleting dependent edges...');
  await prisma.edge.deleteMany({
    where: {
      OR: [
        { fromNode: { floorId: FLOOR_ID } },
        { toNode: { floorId: FLOOR_ID } },
      ],
    },
  });

  // 3. Delete nodes of floor-gf
  console.log('  Deleting dependent nodes...');
  await prisma.node.deleteMany({
    where: { floorId: FLOOR_ID },
  });

  // 4. Delete rooms of floor-gf
  console.log('  Deleting dependent rooms...');
  await prisma.room.deleteMany({
    where: { floorId: FLOOR_ID },
  });

  // 5. Delete the floor record
  console.log('  Deleting floor floor-gf...');
  await prisma.floor.deleteMany({
    where: { id: FLOOR_ID },
  });

  console.log('✓ Ganges Ground Floor cleanup completed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
