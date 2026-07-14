import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- querying rooms ---");
  const rooms = await prisma.room.findMany();
  for (const r of rooms) {
    const n = r.name.toLowerCase();
    const c = r.code.toLowerCase();
    const id = r.id.toLowerCase();
    if (
      n.includes("gate") || n.includes("barrier") || n.includes("punch") || n.includes("entrance") || n.includes("security") || n.includes("speed") ||
      c.includes("gate") || c.includes("barrier") || c.includes("punch") || c.includes("entrance") || c.includes("security") || c.includes("speed") ||
      id.includes("gate") || id.includes("barrier") || id.includes("punch") || id.includes("entrance") || id.includes("security") || id.includes("speed")
    ) {
      console.log(`Room: id="${r.id}", name="${r.name}", type="${r.type}", code="${r.code}"`);
    }
  }
  console.log("--- done ---");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
