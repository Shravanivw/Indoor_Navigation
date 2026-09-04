// scripts/importEditorFloorDefinition.ts
// Imports layout-editor's floorDefinition.json into the Indoor Navigation DB.
// Refactored to act as a CLI wrapper delegating to the unified layoutPublishService.
//
// Usage:
//   ts-node scripts/importEditorFloorDefinition.ts \
//     --file ../layout-editor/floorDefinition.json \
//     --building-id building-hudson \
//     --building-name Hudson \
//     --floor-id floor-hudson-f5 \
//     --level 5 \
//     --floor-name "5th Floor"

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  publishLayoutDefinition,
  EditorFloorDefinition,
  LayoutPublishStats,
} from '../src/services/layoutPublishService';

export type ImportOptions = {
  file: string;
  buildingId: string;
  buildingName: string;
  location?: string;
  floorId: string;
  level: string;
  floorName: string;
  qrPrefix?: string;
  replaceGraph?: boolean;
  realWidthM?: number | null;
  realHeightM?: number | null;
};

const prisma = new PrismaClient();

function getArg(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

export function readOptions(): ImportOptions {
  const file = getArg('--file');
  if (!file) {
    throw new Error('Missing --file path/to/floorDefinition.json');
  }

  const floorId = getArg('--floor-id', 'floor-hudson-f5')!;
  const level = getArg('--level', '5')!;

  return {
    file,
    buildingId: getArg('--building-id', 'building-hudson')!,
    buildingName: getArg('--building-name', 'Hudson')!,
    location: getArg('--location'),
    floorId,
    level,
    floorName: getArg('--floor-name', `${level}th Floor`)!,
    qrPrefix: getArg('--qr-prefix', `LOC-${level}`)!,
    replaceGraph: !hasFlag('--keep-existing-graph'),
    realWidthM: parseFloat(getArg('--real-width-m', '0') ?? '0') || null,
    realHeightM: parseFloat(getArg('--real-height-m', '0') ?? '0') || null,
  };
}

export async function runImport(options: ImportOptions): Promise<LayoutPublishStats> {
  const absoluteFile = path.resolve(options.file);
  if (!fs.existsSync(absoluteFile)) {
    throw new Error(`Floor definition file not found: ${absoluteFile}`);
  }

  const fileContent = fs.readFileSync(absoluteFile, 'utf-8');
  const definition: EditorFloorDefinition = JSON.parse(fileContent);

  console.log(`Importing ${absoluteFile} via layoutPublishService`);

  const stats = await publishLayoutDefinition(prisma, {
    building: {
      id: options.buildingId,
      name: options.buildingName,
      location: options.location,
    },
    floor: {
      id: options.floorId,
      name: options.floorName,
      level: options.level,
      realWidthM: options.realWidthM,
      realHeightM: options.realHeightM,
    },
    definition,
    options: {
      qrPrefix: options.qrPrefix,
      replaceGraph: options.replaceGraph,
      location: options.location,
    },
  });

  console.log('\nImport complete.');
  console.log(`  Building: ${stats.buildingId}`);
  console.log(`  Floor:    ${stats.floorId}`);
  console.log(`  Rooms:    ${stats.roomsImported}`);
  console.log(`  Nodes:    ${stats.graphNodesImported} graph nodes + ${stats.syntheticDoorNodes} synthetic doors`);
  console.log(`  Edges:    ${stats.graphEdgesImported} graph edges`);

  return stats;
}

if (require.main === module) {
  runImport(readOptions())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
