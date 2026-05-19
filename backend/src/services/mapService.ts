// src/services/mapService.ts
// Handles all map/floor/room data retrieval.

import { PrismaClient } from '@prisma/client';
import type { FloorMapData, RoomMapData } from '../types';

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

  return {
    floorId: floor.id,
    level: floor.level,
    name: floor.name,
    gridRows: floor.gridRows ?? 50,
    gridCols: floor.gridCols ?? 50,
    grid: (floor.gridData as number[][]) ?? [],
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
            { name:  { contains: query, mode: 'insensitive' } },
            { code:  { contains: query, mode: 'insensitive' } },
            { qrCode:{ contains: query, mode: 'insensitive' } },
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
