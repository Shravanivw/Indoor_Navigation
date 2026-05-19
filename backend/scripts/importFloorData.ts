// scripts/importFloorData.ts
// Run AFTER parse_dxf.py to load real floor geometry into the database.
// This replaces the placeholder grid in seed.ts with actual parsed data.
//
// Usage: ts-node scripts/importFloorData.ts --floor floor-gf --file src/data/floor_data.json

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { generateGrid, detectJunctions } from '../src/engine/gridGenerator';
import type { ParsedFloorplan } from '../src/types';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const floorId = args[args.indexOf('--floor') + 1] ?? 'floor-gf';
  const filePath = args[args.indexOf('--file') + 1] ?? 'src/data/floor_data.json';

  console.log(`Loading ${filePath}...`);
  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const floorplan: ParsedFloorplan = JSON.parse(raw);

  console.log(`Generating walkability grid...`);
  const generated = generateGrid(floorplan, 50, 50);

  console.log(`Grid: ${generated.cols}×${generated.rows}, cell size: ${generated.cellSizeM.toFixed(2)}m`);

  // Detect corridor junctions and create nodes
  const junctions = detectJunctions(generated.grid);
  console.log(`Detected ${junctions.length} potential corridor junctions`);

  // Update floor with real grid data
  await prisma.floor.update({
    where: { id: floorId },
    data: {
      gridCols: generated.cols,
      gridRows: generated.rows,
      gridData: generated.grid as any,
      scaleX: generated.cellSizeM,
      scaleY: generated.cellSizeM,
      widthM:  floorplan.boundingBox.widthM,
      heightM: floorplan.boundingBox.heightM,
    },
  });

  console.log(`✓ Floor ${floorId} updated with real grid data`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the junction nodes — delete irrelevant ones`);
  console.log(`  2. Manually assign roomId to nodes near room entries`);
  console.log(`  3. Run 'npm run dev' and test the /api/v1/route endpoint`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
