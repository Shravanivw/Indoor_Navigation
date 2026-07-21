import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const floors = await prisma.floor.findMany({
    include: {
      _count: {
        select: { rooms: true }
      }
    }
  });
  console.log("Floors in DB:");
  for (const f of floors) {
    console.log(`Floor level="${f.level}", id="${f.id}", name="${f.name}", roomCount=${f._count.rooms}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
