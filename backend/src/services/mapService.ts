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

function loadFallbackGrid(): number[][] {
  const candidates = [
    path.join(process.cwd(), 'src', 'data', 'nav_floor_data.json'),
    path.join(process.cwd(), 'data', 'nav_floor_data.json'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed?.grid)) {
        return parsed.grid as number[][];
      }
    } catch {
      // Ignore parse errors and continue to next candidate.
    }
  }

  return [];
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

export async function getFloorGeometry(_prisma: PrismaClient, _floorId: string): Promise<FloorGeometryData | null> {
  const parsed = loadJsonCandidates<FloorGeometryData>([
    path.join('src', 'data', 'floor_data_clean.json'),
    path.join('src', 'data', 'floor_data.json'),
  ]);

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
    include: { rooms: true },
  });

  if (!floor) return null;

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
  }));

  const parsedGrid = parseGridData(floor.gridData);
  const grid = parsedGrid.length > 0 ? parsedGrid : loadFallbackGrid();

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
      floor: { select: { id: true, name: true, level: true } },
    },
    take: 20,
  });
}

export async function getRoomById(prisma: PrismaClient, id: string) {
  return prisma.room.findUnique({
    where: { id },
    include: { floor: { select: { id: true, name: true, level: true } } },
  });
}
