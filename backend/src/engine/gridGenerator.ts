// src/engine/gridGenerator.ts
// Converts parsed DXF geometry into a 2D walkability grid for A* pathfinding.
// Also generates navigation nodes at room entries and corridor junctions.

import type { WalkabilityGrid, ParsedFloorplan, GridCell } from '../types';

export interface GeneratedGrid {
  grid: WalkabilityGrid;
  rows: number;
  cols: number;
  cellSizeM: number;      // metres per cell
  originX: number;        // real-world X of grid[0][0]
  originY: number;        // real-world Y of grid[0][0]
}

/**
 * Convert parsed floor plan into a walkability grid.
 *
 * @param floorplan - Output from parse_dxf.py
 * @param targetCols - Desired grid width (default 50)
 * @param targetRows - Desired grid height (default 50)
 */
export function generateGrid(
  floorplan: ParsedFloorplan,
  targetCols = 50,
  targetRows = 50
): GeneratedGrid {
  const { boundingBox } = floorplan;
  const { minX, minY, maxX, maxY } = boundingBox;

  const cellW = (maxX - minX) / targetCols;
  const cellH = (maxY - minY) / targetRows;
  const cellSizeM = Math.min(cellW, cellH) / 1000; // convert mm to m

  // Initialize all cells as walkable (0)
  const grid: WalkabilityGrid = Array.from({ length: targetRows }, () =>
    new Array(targetCols).fill(0)
  );

  // Real-world coordinate → grid cell
  const toGrid = (x: number, y: number): GridCell => ({
    x: Math.floor(((x - minX) / (maxX - minX)) * targetCols),
    y: Math.floor(((y - minY) / (maxY - minY)) * targetRows),
  });

  // Rasterize wall lines into the grid
  for (const wall of floorplan.walls) {
    const pts = wall.points;
    for (let i = 0; i < pts.length - 1; i++) {
      rasterizeLine(
        grid,
        toGrid(pts[i][0], pts[i][1]),
        toGrid(pts[i + 1][0], pts[i + 1][1]),
        targetCols,
        targetRows
      );
    }
  }

  return {
    grid,
    rows: targetRows,
    cols: targetCols,
    cellSizeM,
    originX: minX,
    originY: minY,
  };
}

/**
 * Bresenham's line algorithm — mark all cells a line passes through as walls (1).
 */
function rasterizeLine(
  grid: WalkabilityGrid,
  start: GridCell,
  end: GridCell,
  maxCols: number,
  maxRows: number
): void {
  let { x: x0, y: y0 } = start;
  const { x: x1, y: y1 } = end;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 >= 0 && x0 < maxCols && y0 >= 0 && y0 < maxRows) {
      grid[y0][x0] = 1;
      // Thicken walls slightly so they block properly
      if (x0 + 1 < maxCols) grid[y0][x0 + 1] = 1;
      if (y0 + 1 < maxRows) grid[y0 + 1][x0] = 1;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
}

/**
 * Convert a grid cell back to a real-world coordinate (centre of cell).
 */
export function gridToReal(
  cell: GridCell,
  generatedGrid: GeneratedGrid,
  boundingBox: ParsedFloorplan['boundingBox']
): { x: number; y: number } {
  const { cols, rows } = generatedGrid;
  const { minX, minY, maxX, maxY } = boundingBox;

  return {
    x: minX + ((cell.x + 0.5) / cols) * (maxX - minX),
    y: minY + ((cell.y + 0.5) / rows) * (maxY - minY),
  };
}

/**
 * Auto-detect corridor junctions — cells surrounded by walkable cells
 * with 3+ walkable neighbours in different directions.
 * These become navigation graph nodes.
 */
export function detectJunctions(grid: WalkabilityGrid): GridCell[] {
  const junctions: GridCell[] = [];
  const rows = grid.length;
  const cols = grid[0].length;

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === 1) continue; // wall

      const n = grid[y - 1][x] === 0 ? 1 : 0;
      const s = grid[y + 1][x] === 0 ? 1 : 0;
      const e = grid[y][x + 1] === 0 ? 1 : 0;
      const w = grid[y][x - 1] === 0 ? 1 : 0;
      const walkableNeighbours = n + s + e + w;

      // A junction has 3+ walkable neighbours (T or + intersection)
      if (walkableNeighbours >= 3) {
        junctions.push({ x, y });
      }
    }
  }

  return junctions;
}
