import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("UPDATE buildings SET location = 'Pune' WHERE id IN ('building-hudson', 'building-ganges')");
  await prisma.$executeRawUnsafe("UPDATE buildings SET location = 'Bangalore' WHERE id = 'building-jupiter'");
  const buildings = await prisma.$queryRawUnsafe("SELECT id, name, location FROM buildings");
  console.log('Updated Buildings in DB:');
  console.log(buildings);
  await prisma.$disconnect();
}

main().catch(console.error);
