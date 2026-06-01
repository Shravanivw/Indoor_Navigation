// src/services/mapService.ts
// Handles all map/floor/room data retrieval.

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import type { FloorMapData, RoomMapData } from '../types';

type FloorGeometryData = {
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthM?: number;
    heightM?: number;
  };
  walls: Array<{
    layer?: string;
    points: Array<[number, number]>;
  }>;
};

// Maps floorId → the JSON basename in src/data for that floor's geometry/grid.
// Add new floors here as they are seeded.
const FLOOR_DATA_MAP: Record<string, { clean: string; nav: string }> = {
  'floor-gf':         { clean: 'floor_ganges_clean.json', nav: 'nav_ganges_g.json' },
  'floor-hudson-f5':  { clean: 'floor_hudson_clean.json', nav: 'nav_hudson_f5.json' },
};

function dataPath(name: string): string {
  return path.join(process.cwd(), 'src', 'data', name);
}

function parseGridData(raw: unknown): number[][] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as number[][];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[][]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function loadFallbackGrid(floorId: string): number[][] {
  const entry = FLOOR_DATA_MAP[floorId];
  if (!entry) return [];
  const filePath = dataPath(entry.nav);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.grid) ? (parsed.grid as number[][]) : [];
  } catch {
    return [];
  }
}

function loadJsonCandidates<T>(relativePaths: string[]): T | null {
  for (const rel of relativePaths) {
    const filePath = path.join(process.cwd(), rel);
    if (!fs.existsSync(filePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      // Ignore parse errors and continue.
    }
  }
  return null;
}

export async function getFloorGeometry(prisma: PrismaClient, floorId: string): Promise<FloorGeometryData | null> {
  // Resolve the floor's geometry JSON via the per-floor map. Fall back to the
  // generic filename for backwards compatibility.
  const entry = FLOOR_DATA_MAP[floorId];
  const candidates = entry
    ? [entry.clean]
    : ['floor_data_clean.json', 'floor_data.json'];

  const parsed = loadJsonCandidates<FloorGeometryData>(
    candidates.map(n => path.join('src', 'data', n))
  );

  if (!parsed?.boundingBox || !Array.isArray(parsed?.walls)) {
    return null;
  }

  return {
    boundingBox: parsed.boundingBox,
    walls: parsed.walls,
  };
}

export async function getFloorMap(
  prisma: PrismaClient,
  floorId: string
): Promise<FloorMapData | null> {
  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    include: {
      rooms: true,
      building: { select: { id: true, name: true } },
    },
  });

  if (!floor) return null;

  const floorInfo = {
    id: floor.id,
    name: floor.name,
    level: floor.level,
    buildingId: floor.buildingId,
    building: floor.building,
  };

  const rooms: RoomMapData[] = floor.rooms.map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    gridX: r.gridX,
    gridY: r.gridY,
    gridW: r.gridW,
    gridH: r.gridH,
    centreX: r.centreX,
    centreY: r.centreY,
    qrCode: r.qrCode,
    capacity: r.capacity,
    isAccessible: r.isAccessible,
    floor: floorInfo,
  }));

  const parsedGrid = parseGridData(floor.gridData);
  const grid = parsedGrid.length > 0 ? parsedGrid : loadFallbackGrid(floor.id);

  return {
    floorId: floor.id,
    level: floor.level,
    name: floor.name,
    gridRows: floor.gridRows ?? grid.length ?? 50,
    gridCols: floor.gridCols ?? grid[0]?.length ?? 50,
    grid,
    scaleX: floor.scaleX ?? 1,
    scaleY: floor.scaleY ?? 1,
    rooms,
  };
}

export async function getAllFloors(prisma: PrismaClient, buildingId: string) {
  return prisma.floor.findMany({
    where: { buildingId },
    orderBy: { level: 'asc' },
    select: {
      id: true, level: true, name: true,
      gridRows: true, gridCols: true,
      _count: { select: { rooms: true } },
    },
  });
}

export async function searchRooms(
  prisma: PrismaClient,
  query: string,
  floorId?: string
) {
  return prisma.room.findMany({
    where: {
      AND: [
        floorId ? { floorId } : {},
        {
          OR: [
            { name:  { contains: query } },
            { code:  { contains: query } },
            { qrCode:{ contains: query } },
          ],
        },
      ],
    },
    select: {
      id: true, code: true, name: true, type: true,
      gridX: true, gridY: true, centreX: true, centreY: true,
      qrCode: true, capacity: true, isAccessible: true,
      floor: { select: { id: true, name: true, level: true, buildingId: true } },
    },
    take: 20,
  });
}

export async function getRoomById(prisma: PrismaClient, id: string) {
  return prisma.room.findUnique({
    where: { id },
    include: { floor: { select: { id: true, name: true, level: true, buildingId: true } } },
  });
}
