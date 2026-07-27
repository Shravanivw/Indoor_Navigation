import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("UPDATE floors SET realWidthM = 72.025, realHeightM = 36.200, widthM = 72.025, heightM = 36.200, scaleX = 0.9003, scaleY = 0.4525 WHERE id = 'floor-jupiter-f1'");
  console.log('Successfully updated floor-jupiter-f1 dimensions in DB');
  await prisma.$disconnect();
}

main().catch(console.error);
