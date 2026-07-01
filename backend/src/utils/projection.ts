import * as path from 'path';
import * as fs from 'fs';

export interface ProjectionBounds {
  minX: number;
  minY: number;
  spanX: number;
  spanY: number;
}

export interface GridCell {
  x: number;
  y: number;
}

export interface LayoutRoom {
  id: string;
  polygon: { x: number; y: number }[];
  doors?: { id: string; x: number; y: number; width: number }[];
}

// Maps floorId -> Layout JSON filename in src/data
export const HUDSON_LAYOUT_FILES: Record<string, string> = {
  'floor-hudson-f5': 'Hudson_5th.json',
  'floor-hudson-f6': 'Hudson_6th_Floor.json',
};

const boundsCache = new Map<string, ProjectionBounds>();

/**
 * Loads the layout rooms definition from JSON file.
 */
export function loadHudsonLayoutRooms(layoutFile: string): LayoutRoom[] {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', layoutFile);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.rooms) ? parsed.rooms : [];
  } catch (err) {
    console.error(`Failed to load layout file ${layoutFile}:`, err);
    return [];
  }
}

/**
 * Calculates projection bounds dynamically based on layout rooms.
 */
export function getHudsonProjectionBounds(floorId: string): ProjectionBounds | null {
  if (boundsCache.has(floorId)) {
    return boundsCache.get(floorId)!;
  }

  const layoutFile = HUDSON_LAYOUT_FILES[floorId];
  if (!layoutFile) return null;

  const layoutRooms = loadHudsonLayoutRooms(layoutFile);
  if (layoutRooms.length === 0) return null;

  const allPoints = layoutRooms.flatMap((room) => [
    ...room.polygon,
    ...(room.doors ?? []),
  ]);

  if (allPoints.length === 0) return null;

  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const bounds: ProjectionBounds = { minX, minY, spanX, spanY };
  boundsCache.set(floorId, bounds);
  return bounds;
}

/**
 * Shared canonical projection helper.
 * Normalises raw coordinate to projected grid coordinate.
 */
export function projectHudsonCoordinate(
  rawX: number,
  rawY: number,
  cols: number,
  rows: number,
  bounds: ProjectionBounds
): GridCell {
  const normX = (rawX - bounds.minX) / bounds.spanX;
  const normY = (rawY - bounds.minY) / bounds.spanY;
  return {
    x: normX * cols,
    y: rows - (normY * rows), // flip Y axis to match frontend coordinate orientation
  };
}
