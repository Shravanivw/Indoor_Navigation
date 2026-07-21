import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const navPath = path.resolve(__dirname, '..', 'src', 'data', 'nav_ganges_f9.json');
  if (!fs.existsSync(navPath)) {
    throw new Error(`nav file not found: ${navPath}`);
  }
  const navRaw = JSON.parse(fs.readFileSync(navPath, 'utf-8'));
  console.log(`Updating database floor floor-ganges-f9 with grid from nav_ganges_f9.json...`);
  await prisma.floor.update({
    where: { id: 'floor-ganges-f9' },
    data: {
      gridCols:   navRaw.gridCols,
      gridRows:   navRaw.gridRows,
      scaleX:     navRaw.scaleX,
      scaleY:     navRaw.scaleY,
      widthM:     navRaw.realWidthM,
      heightM:    navRaw.realHeightM,
      gridData:   JSON.stringify(navRaw.grid),
    },
  });
  console.log('✓ Database Floor record updated successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
