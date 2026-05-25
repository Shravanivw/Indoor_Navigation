import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function seed() {
  const raw = fs.readFileSync(
    path.join(__dirname, '../src/data/floor_data_clean.json'), 'utf-8'
  );
  const data = JSON.parse(raw);

  // 1. Create building
  const building = await prisma.building.upsert({
    where: { id: 'building-a' },
    update: {},
    create: { id: 'building-a', name: 'Building A' }
  });

  // 2. Create floor
  const floor = await prisma.floor.upsert({
    where: { id: 'floor-gf' },
    update: {},
    create: {
      id:         'floor-gf',
      buildingId: building.id,
      level:      'G',
      name:       'Ground Floor',
      scaleX:     1,
      scaleY:     1,
      gridRows:   100,
      gridCols:   100,
    }
  });

  // 3. Create rooms from JSON
  const bounds = data.boundingBox;
  const SVG_W = 520;
  const SVG_H = 380;

  for (const room of data.rooms) {
    // Normalize DWG coords → SVG coords
    const svgX = ((room.x - bounds.minX) / (bounds.maxX - bounds.minX)) * SVG_W;
    const svgY = SVG_H - ((room.y - bounds.minY) / (bounds.maxY - bounds.minY)) * SVG_H;

    const svgW = room.widthMm  ? (room.widthMm  / (bounds.maxX - bounds.minX)) * SVG_W : 40;
    const svgH = room.heightMm ? (room.heightMm / (bounds.maxY - bounds.minY)) * SVG_H : 30;

    await prisma.room.upsert({
      where: { id: `room-gf-${room.code.toLowerCase()}` },
      update: {},
      create: {
        id:          `room-gf-${room.code.toLowerCase()}`,
        floorId:     floor.id,
        code:        room.code,
        name:        room.name,
        type:        inferType(room.name),
        qrCode:      `QR-GF-${room.code}`,
        centreX:     svgX,
        centreY:     svgY,
        gridX:       Math.round(svgX),
        gridY:       Math.round(svgY),
        gridW:       Math.round(svgW),
        gridH:       Math.round(svgH),
        isAccessible: true,
      }
    });
  }

  console.log(`✅ Seeded ${data.rooms.length} rooms into floor-gf`);
  await prisma.$disconnect();
}

function inferType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('conference') || n.includes('meeting')) return 'MEETING_ROOM';
  if (n.includes('cafeteria') || n.includes('pantry') || n.includes('kitchen')) return 'PANTRY';
  if (n.includes('reception') || n.includes('waiting')) return 'RECEPTION';
  if (n.includes('exit') || n.includes('stair')) return 'EXIT';
  if (n.includes('lift') || n.includes('elevator')) return 'LIFT';
  if (n.includes('rest') || n.includes('toilet') || n.includes('wash')) return 'RESTROOM';
  if (n.includes('cabin')) return 'CABIN';
  if (n.includes('store') || n.includes('storage')) return 'STORAGE';
  return 'GENERAL';
}

seed().catch(console.error);