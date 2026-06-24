// src/services/mapService.ts
// Handles all map/floor/room data retrieval.

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import type { FloorMapData, RoomMapData, GraphNode} from '../types';

type LayoutPoint = { x: number; y: number };
type LayoutDoor = LayoutPoint & { id: string; width?: number };
type LayoutRoom = {
  id: string;
  type?: string;
  polygon: LayoutPoint[];
  doors?: LayoutDoor[];
};

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

type NavFloorData = {
  gridCols?: number;
  gridRows?: number;
  scaleX?: number;
  scaleY?: number;
  realWidthM?: number;
  realHeightM?: number;
  grid?: number[][];
};

// Maps floorId → the JSON basename in src/data for that floor's geometry/grid.
// Add new floors here as they are seeded.
const FLOOR_DATA_MAP: Record<string, { clean: string; nav?: string }> = {
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
  if (!entry || !entry.nav) return [];
  const filePath = dataPath(entry.nav);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.grid) ? (parsed.grid as number[][]) : [];
  } catch {
    return [];
  }
}

function loadNavFloorData(floorId: string): NavFloorData | null {
  const entry = FLOOR_DATA_MAP[floorId];
  if (!entry?.nav) return null;
  const filePath = dataPath(entry.nav);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as NavFloorData;
  } catch {
    return null;
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

function normaliseRoomName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function loadHudsonLayoutRooms(): LayoutRoom[] {
  const parsed = loadJsonCandidates<{ rooms?: LayoutRoom[] }>([
    path.join('src', 'data', 'Hudson_5th.json'),
  ]);
  return Array.isArray(parsed?.rooms) ? parsed.rooms : [];
}

function projectHudsonLayoutRooms(
  rooms: RoomMapData[],
  gridCols: number,
  gridRows: number,
): RoomMapData[] {
  const layoutRooms = loadHudsonLayoutRooms();
  if (layoutRooms.length === 0) return rooms;

  const allPoints = layoutRooms.flatMap((room) => [
    ...room.polygon,
    ...(room.doors ?? []),
  ]);
  if (allPoints.length === 0) return rooms;

  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const roomByName = new Map(
    layoutRooms.map((room) => [normaliseRoomName(room.id), room])
  );

  return rooms.flatMap((room) => {
    const layout = roomByName.get(normaliseRoomName(room.name));
    if (!layout || !Array.isArray(layout.polygon) || layout.polygon.length < 3) {
      // Hudson map should be driven by Hudson_5th.json only.
      return [];
    }

    const xs = layout.polygon.map((point) => point.x);
    const ys = layout.polygon.map((point) => point.y);
    const left = ((Math.min(...xs) - minX) / spanX) * gridCols;
    const right = ((Math.max(...xs) - minX) / spanX) * gridCols;
    const top = ((Math.min(...ys) - minY) / spanY) * gridRows;
    const bottom = ((Math.max(...ys) - minY) / spanY) * gridRows;
    const projectedTop = gridRows - bottom;
    const projectedBottom = gridRows - top;

    const projectedRoom: RoomMapData = {
      ...room,
      gridX: Math.round(left),
      gridY: Math.round(projectedBottom),
      gridW: Math.max(2, Math.round(right - left)),
      gridH: Math.max(2, Math.round(projectedBottom - projectedTop)),
      centreX: (left + right) / 2,
      centreY: (projectedTop + projectedBottom) / 2,
      polygon: layout.polygon.map((point) => ({
        x: ((point.x - minX) / spanX) * gridCols,
        y: gridRows - (((point.y - minY) / spanY) * gridRows),
      })),
      doors: (layout.doors ?? []).map((door) => ({
        id: door.id,
        width: door.width,
        x: ((door.x - minX) / spanX) * gridCols,
        y: gridRows - (((door.y - minY) / spanY) * gridRows),
      })),
      layoutSource: 'Hudson_5th.json',
    };
    return [projectedRoom];
  });
}

function projectHudsonLayoutNodes(
  nodes:any[],
  gridCols: number,
  gridRows: number,
): any[] {

  const layoutRooms = loadHudsonLayoutRooms();
  if (layoutRooms.length === 0) return nodes;

  const allPoints = layoutRooms.flatMap((room) => [
    ...room.polygon,
    ...(room.doors ?? []),
  ]);

  if (allPoints.length === 0) return nodes;

  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  return nodes.map(node => ({
    ...node,

    gridX: ((node.gridX - minX) / spanX) * gridCols,

    gridY:
      gridRows -
      (((node.gridY - minY) / spanY) * gridRows),

    realX: ((node.realX - minX) / spanX) * gridCols,

    realY:
      gridRows -
      (((node.realY - minY) / spanY) * gridRows),
  }));
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

  let nodes = await prisma.node.findMany({
    where: {
      floorId: floor.id,
    },
  });

  const edges = await prisma.edge.findMany({
    where: {
      OR: [
        { fromNode: { floorId: floor.id } },
        { toNode: { floorId: floor.id } },
      ],
    },
  });

  let rooms: RoomMapData[] = floor.rooms.map(r => ({
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
  const navFloorData = loadNavFloorData(floor.id);
  const grid = parsedGrid.length > 0
    ? parsedGrid
    : navFloorData?.grid ?? loadFallbackGrid(floor.id);
  const gridRows = navFloorData?.gridRows ?? floor.gridRows ?? grid.length ?? 50;
  const gridCols = navFloorData?.gridCols ?? floor.gridCols ?? grid[0]?.length ?? 50;

  if (floor.id === 'floor-hudson-f5') {
    rooms = projectHudsonLayoutRooms(
      rooms,
      gridCols,
      gridRows
    );

    nodes = projectHudsonLayoutNodes(
      nodes,
      gridCols,
      gridRows
    );
}

  return {
  floorId: floor.id,
  level: floor.level,
  name: floor.name,
  gridRows,
  gridCols,
  grid,
  scaleX: navFloorData?.scaleX ?? floor.scaleX ?? 1,
  scaleY: navFloorData?.scaleY ?? floor.scaleY ?? 1,
  rooms,
  nodes,
  edges,
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
  floorId?: string,
  type?: string,
) {
  const typeFilter = type ? type.split(',').map(t => t.trim()).filter(Boolean) : [];

  return prisma.room.findMany({
    where: {
      AND: [
        floorId ? { floorId } : {},
        typeFilter.length ? { type: { in: typeFilter } } : {},
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