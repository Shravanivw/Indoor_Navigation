import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { runImport } from './importEditorFloorDefinition';

const prisma = new PrismaClient();

async function seedAll() {
  console.log('====================================================');
  console.log('STARTING MASTER DATABASE SETUP & SEEDING');
  console.log('====================================================\n');

  const dataDir = path.join(__dirname, '..', 'src', 'data');

  const editorImports = [
    {
      file: path.join(dataDir, 'Hudson_5th.json'),
      buildingId: 'building-hudson',
      buildingName: 'Hudson',
      location: 'Pune',
      floorId: 'floor-hudson-f5',
      level: '5',
      floorName: '5th Floor',
      qrPrefix: 'LOC-F5',
    },
    {
      file: path.join(dataDir, 'Hudson_6th_Floor.json'),
      buildingId: 'building-hudson',
      buildingName: 'Hudson',
      location: 'Pune',
      floorId: 'floor-hudson-f6',
      level: '6',
      floorName: '6th Floor',
      qrPrefix: 'LOC-F6',
    },
    {
      file: path.join(dataDir, 'Hudson_7th.json'),
      buildingId: 'building-hudson',
      buildingName: 'Hudson',
      location: 'Pune',
      floorId: 'floor-hudson-f7',
      level: '7',
      floorName: '7th Floor',
      qrPrefix: 'LOC-F7',
    },
    {
      file: path.join(dataDir, 'Ganges_9th.json'),
      buildingId: 'building-ganges',
      buildingName: 'Ganges',
      location: 'Pune',
      floorId: 'floor-ganges-f9',
      level: '9',
      floorName: '9th Floor',
      qrPrefix: 'LOC-F9',
    },
    {
      file: path.join(dataDir, 'Jupiter.json'),
      buildingId: 'building-jupiter',
      buildingName: 'Jupiter',
      location: 'Bangalore',
      floorId: 'floor-jupiter-f1',
      level: '1',
      floorName: '1st Floor',
      qrPrefix: 'LOC-F1',
    },
    {
      file: path.join(dataDir, 'Gravity.json'),
      buildingId: 'building-gravity',
      buildingName: 'Gravity',
      location: 'Bangalore',
      floorId: 'floor-gravity-f1',
      level: '1',
      floorName: '1st Floor',
      qrPrefix: 'LOC-GRAV-F1',
    },
    {
      file: path.join(dataDir, 'Gurugram_3rd.json'),
      buildingId: 'building-gurugram',
      buildingName: 'Gurugram',
      location: 'Gurugram',
      floorId: 'floor-gurugram-f3',
      level: '3',
      floorName: '3rd Floor',
      qrPrefix: 'LOC-GG-F3',
    },
  ];

  console.log('Importing All Floor Definitions across Pune, Bangalore & Gurugram...\n');
  for (const item of editorImports) {
    console.log(`\nImporting ${item.buildingName} - ${item.floorName} (${path.basename(item.file)})...`);
    await runImport({
      file: item.file,
      buildingId: item.buildingId,
      buildingName: item.buildingName,
      location: item.location,
      floorId: item.floorId,
      level: item.level,
      floorName: item.floorName,
      qrPrefix: item.qrPrefix,
    });
  }

  // Calibrate physical dimensions for Jupiter 1st Floor, Gravity 1st Floor & Gurugram 3rd Floor
  console.log('\nCalibrating physical dimensions for Jupiter 1st Floor, Gravity 1st Floor & Gurugram 3rd Floor...');
  await prisma.$executeRawUnsafe(
    "UPDATE floors SET realWidthM = 72.025, realHeightM = 36.200, widthM = 72.025, heightM = 36.200, scaleX = 0.9003, scaleY = 0.4525 WHERE id = 'floor-jupiter-f1'"
  );
  await prisma.$executeRawUnsafe(
    "UPDATE floors SET realWidthM = 60.030, realHeightM = 32.870, widthM = 60.030, heightM = 32.870, scaleX = 0.7504, scaleY = 0.4109 WHERE id = 'floor-gravity-f1'"
  );
  await prisma.$executeRawUnsafe(
    "UPDATE floors SET realWidthM = 72.576, realHeightM = 43.758, widthM = 72.576, heightM = 43.758, scaleX = 0.9072, scaleY = 0.5470 WHERE id = 'floor-gurugram-f3'"
  );

  console.log('\n====================================================');
  console.log('MASTER DATABASE SETUP & SEEDING COMPLETED SUCCESSFULLY');
  console.log('====================================================');

  await prisma.$disconnect();
}

seedAll().catch((err) => {
  console.error('Error during master seed:', err);
  process.exit(1);
});
