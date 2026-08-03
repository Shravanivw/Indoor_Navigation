// scripts/seed.ts - UPDATED to load all 61 Hudson rooms from Hudson_5th.json
/// <reference types="node" />

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { seedHudsonManualGraph } from './seedManualGraph';

const RoomType = { STORAGE:'STORAGE', SERVER_ROOM:'SERVER_ROOM', MEETING_ROOM:'MEETING_ROOM', OFFICE:'OFFICE', PANTRY:'PANTRY', OTHER:'OTHER', TOILET:'TOILET', RECEPTION:'RECEPTION', BOARDROOM:'BOARDROOM', OPEN_WORKSPACE:'OPEN_WORKSPACE' } as const;

const prisma = new PrismaClient();

export async function main() {
  console.log('Seeding database...');

  // ── Building: Ganges ──────────────────────────────────────────────────────
  const building = await prisma.building.upsert({
    where: { id: 'building-ganges' },
    create: {
      id:      'building-ganges',
      name:    'Ganges',
      location:'Pune',
      address: 'Update with your address',
    },
    update: { name: 'Ganges', location: 'Pune' },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDING 2: HUDSON (VWITS Pune — 5th Floor)
  // Load all 61 rooms from Hudson_5th.json
  // ═══════════════════════════════════════════════════════════════════════════

  const hudsonBuilding = await prisma.building.upsert({
    where: { id: 'building-hudson' },
    create: { id: 'building-hudson', name: 'Hudson', location: 'Pune', address: 'VWITS Pune' },
    update: { name: 'Hudson', location: 'Pune' },
  });

  // Load Hudson geometry and nav data
  const hudsonGeometryPath = path.resolve(__dirname, '..', 'src', 'data', 'Hudson_5th.json');
  const hudsonGeometryData = JSON.parse(fs.readFileSync(hudsonGeometryPath, 'utf-8'));
  const navPath = path.resolve(__dirname, '..', 'src', 'data', 'nav_hudson_f5.json');
  const navRaw  = JSON.parse(fs.readFileSync(navPath, 'utf-8'));

  const hudsonFloor = await prisma.floor.upsert({
    where: { buildingId_level: { buildingId: hudsonBuilding.id, level: '5' } },
    create: {
      id:         'floor-hudson-f5',
      buildingId: hudsonBuilding.id,
      level:      '5',
      name:       '5th Floor',
      gridCols:   navRaw.gridCols,
      gridRows:   navRaw.gridRows,
      scaleX:     navRaw.scaleX,
      scaleY:     navRaw.scaleY,
      widthM:     navRaw.realWidthM,
      heightM:    navRaw.realHeightM,
      gridData:   JSON.stringify(navRaw.grid),
    },
    update: {
      gridCols:   navRaw.gridCols,
      gridRows:   navRaw.gridRows,
      scaleX:     navRaw.scaleX,
      scaleY:     navRaw.scaleY,
      widthM:     navRaw.realWidthM,
      heightM:    navRaw.realHeightM,
      gridData:   JSON.stringify(navRaw.grid),
    },
  });

  // Compute global bounds from all Hudson geometry
  const hudsonRooms = hudsonGeometryData.rooms || [];
  const allPoints = hudsonRooms.flatMap((room: any) =>
    [...(room.polygon || []), ...(room.doors || [])]
  );
  const minX = Math.min(...allPoints.map((p: any) => p.x));
  const maxX = Math.max(...allPoints.map((p: any) => p.x));
  const minY = Math.min(...allPoints.map((p: any) => p.y));
  const maxY = Math.max(...allPoints.map((p: any) => p.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const GRID_COLS = navRaw.gridCols || 80;
  const GRID_ROWS = navRaw.gridRows || 80;

  // Infer room type from name
  const inferType = (name: string): string => {
    if (name.includes('BOARD') || name.includes('Board'))     return RoomType.BOARDROOM;
    if (name.includes('Reception'))                           return RoomType.RECEPTION;
    if (name.includes('Pantry'))                              return RoomType.PANTRY;
    if (name.includes('Discussion') || name.includes('Informal') || name.includes('Phone')) return RoomType.MEETING_ROOM;
    if (name.includes('Cabin'))                               return RoomType.OFFICE;
    if (name.includes('Store') || name.includes('Storage'))   return RoomType.STORAGE;
    if (name.includes('Shower') || name.includes('Changing')) return RoomType.TOILET;
    return RoomType.OTHER;
  };

  // Seed all Hudson rooms from Hudson_5th.json with computed centers
  for (const hudsonRoom of hudsonRooms) {
    if (!Array.isArray(hudsonRoom.polygon) || hudsonRoom.polygon.length < 3) continue;

    // Compute polygon center
    const xs = hudsonRoom.polygon.map((p: any) => p.x);
    const ys = hudsonRoom.polygon.map((p: any) => p.y);
    const polyMinX = Math.min(...xs);
    const polyMaxX = Math.max(...xs);
    const polyMinY = Math.min(...ys);
    const polyMaxY = Math.max(...ys);

    // Project to grid coordinates
    const left = ((polyMinX - minX) / spanX) * GRID_COLS;
    const right = ((polyMaxX - minX) / spanX) * GRID_COLS;
    const top = ((polyMinY - minY) / spanY) * GRID_ROWS;
    const bottom = ((polyMaxY - minY) / spanY) * GRID_ROWS;
    const projectedTop = GRID_ROWS - bottom;
    const projectedBottom = GRID_ROWS - top;
    const centreX = (left + right) / 2;
    const centreY = (projectedTop + projectedBottom) / 2;

    const roomCode = `HUDSON_${hudsonRoom.id.toUpperCase().replace(/\s+/g, '_')}`;
    const roomId = `room-h5-${hudsonRoom.id.toLowerCase().replace(/\s+/g, '_')}`;

    await prisma.room.upsert({
      where: { code: roomCode },
      create: {
        id:           roomId,
        floorId:      hudsonFloor.id,
        code:         roomCode,
        name:         hudsonRoom.id,
        type:         inferType(hudsonRoom.id),
        gridX:        Math.round(left),
        gridY:        Math.round(projectedBottom),
        gridW:        Math.max(2, Math.round(right - left)),
        gridH:        Math.max(2, Math.round(projectedBottom - projectedTop)),
        centreX:      centreX,
        centreY:      centreY,
        qrCode:       `LOC-H5-${roomCode.replace('HUDSON_', '')}`,
        isAccessible: true,
      },
      update: {
        name:    hudsonRoom.id,
        gridX:   Math.round(left),
        gridY:   Math.round(projectedBottom),
        gridW:   Math.max(2, Math.round(right - left)),
        gridH:   Math.max(2, Math.round(projectedBottom - projectedTop)),
        centreX: centreX,
        centreY: centreY,
      },
    });
  }

  // Seed the manual graph with room nodes connected to corridors
  await seedHudsonManualGraph(prisma);

  // ── Building: Jupiter (Bangalore) ─────────────────────────────────────────
  const jupiterBuilding = await prisma.building.upsert({
    where: { id: 'building-jupiter' },
    create: { id: 'building-jupiter', name: 'Jupiter', location: 'Bangalore', address: 'Bangalore Office - Prestige Tech Park' },
    update: { name: 'Jupiter', location: 'Bangalore' },
  });

  console.log('\n✓ Database seeded successfully');
  console.log(`  Ganges (${building.name}): Onboarded`);
  console.log(`  Hudson (${hudsonBuilding.name}): ${hudsonRooms.length} rooms; route graph from manualGraph.json with room connections`);
  console.log(`  Jupiter (${jupiterBuilding.name}): Onboarded from Jupiter.json`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
