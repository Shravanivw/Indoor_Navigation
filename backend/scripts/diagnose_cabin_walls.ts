import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Replicate the exact logic from ModelShared.js findCorridorSegmentIndex
function findCorridorSegmentIndex(polygon: any[], grid: number[][]) {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  if (cols === 0) return -1;

  let centroidX = 0;
  let centroidY = 0;
  for (const p of polygon) {
    centroidX += p.x;
    centroidY += p.y;
  }
  centroidX /= polygon.length;
  centroidY /= polygon.length;

  let bestIndex = -1;
  let maxWalkableScore = -1;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Normal vector
    let nx = -dy;
    let ny = dx;
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len > 0) { nx /= len; ny /= len; }

    // Ensure normal points OUTWARD (away from polygon centroid)
    const t1x = mx + nx * 0.8;
    const t1y = my + ny * 0.8;
    const t2x = mx - nx * 0.8;
    const t2y = my - ny * 0.8;

    const dist1 = (t1x - centroidX) ** 2 + (t1y - centroidY) ** 2;
    const dist2 = (t2x - centroidX) ** 2 + (t2y - centroidY) ** 2;

    const outX = dist1 > dist2 ? t1x : t2x;
    const outY = dist1 > dist2 ? t1y : t2y;

    const cellX = Math.round(outX);
    const cellY = Math.round(outY);
    const gridY = rows - 1 - cellY;

    let score = 0;
    if (cellX >= 0 && cellX < cols && gridY >= 0 && gridY < rows) {
      if (grid[gridY][cellX] === 0) {
        score = 15; // Directly walkable corridor cell
      }
    }

    // Check adjacent neighbor cells to determine broad corridor clearance
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cx = cellX + ox;
        const cy = cellY + oy;
        const gy = rows - 1 - cy;
        if (cx >= 0 && cx < cols && gy >= 0 && gy < rows) {
          if (grid[gy][cx] === 0) score++;
        }
      }
    }

    if (score > maxWalkableScore) {
      maxWalkableScore = score;
      bestIndex = i;
    }
  }

  return { bestIndex, maxWalkableScore };
}

// Projection logic as done in projectHudsonLayoutRooms in mapService.ts
function projectHudsonCoordinate(x: number, y: number, gridCols: number, gridRows: number, bounds: any) {
  const spanX = Math.max(1, bounds.spanX);
  const spanY = Math.max(1, bounds.spanY);
  
  const projectedX = ((x - bounds.minX) / spanX) * gridCols;
  const projectedY = gridRows - (((y - bounds.minY) / spanY) * gridRows);
  
  return { x: projectedX, y: projectedY };
}

async function main() {
  const floors = [
    { id: 'floor-hudson-f5', name: 'Floor 5', clean: 'floor_hudson_clean.json', cabin: 'CTIO Head Cabin' },
    { id: 'floor-hudson-f6', name: 'Floor 6', clean: 'floor_hudson_6th_clean.json', cabin: 'CISO Office' },
    { id: 'floor-hudson-f7', name: 'Floor 7', clean: 'floor_hudson_7th_clean.json', cabin: 'Delivery Head Cabin' }
  ];

  for (const f of floors) {
    console.log(`\n--- Diagnosing ${f.name} (${f.id}) ---`);
    
    // Load grid and bounds
    const floor = await prisma.floor.findUnique({ where: { id: f.id } });
    if (!floor) { console.log('Floor not found'); continue; }

    const cleanPath = path.resolve(__dirname, '..', 'src', 'data', f.clean);
    const cleanData = JSON.parse(fs.readFileSync(cleanPath, 'utf-8'));
    
    const navPath = path.resolve(__dirname, '..', 'src', 'data', f.id === 'floor-hudson-f5' ? 'nav_hudson_f5.json' : (f.id === 'floor-hudson-f6' ? 'nav_hudson_f6.json' : 'nav_hudson_f7.json'));
    const navData = JSON.parse(fs.readFileSync(navPath, 'utf-8'));
    
    const grid = navData.grid;
    const gridCols = navData.gridCols;
    const gridRows = navData.gridRows;

    const layoutRooms = cleanData.rooms || [];
    const allPoints = layoutRooms.flatMap((room: any) => [...(room.polygon || []), ...(room.doors || [])]);
    const minX = Math.min(...allPoints.map((p: any) => p.x));
    const maxX = Math.max(...allPoints.map((p: any) => p.x));
    const minY = Math.min(...allPoints.map((p: any) => p.y));
    const maxY = Math.max(...allPoints.map((p: any) => p.y));
    const bounds = { minX, minY, spanX: maxX - minX, spanY: maxY - minY };

    const targetRoom = layoutRooms.find((r: any) => r.id === f.cabin);
    if (!targetRoom) {
      console.log(`Cabin "${f.cabin}" not found in layout`);
      continue;
    }

    // Project coordinates
    const projectedPolygon = targetRoom.polygon.map((p: any) => 
      projectHudsonCoordinate(p.x, p.y, gridCols, gridRows, bounds)
    );

    console.log(`Cabin Name: "${targetRoom.id}"`);
    console.log(`Projected Polygon (${projectedPolygon.length} vertices):`, projectedPolygon.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));

    const res = findCorridorSegmentIndex(projectedPolygon, grid);
    if (res === -1) {
      console.log('findCorridorSegmentIndex returned -1');
      continue;
    }
    const { bestIndex, maxWalkableScore } = res;
    console.log(`findCorridorSegmentIndex output:`);
    console.log(`  bestIndex: ${bestIndex}`);
    console.log(`  maxWalkableScore: ${maxWalkableScore}`);
    
    // Trace scores of each segment
    for (let i = 0; i < projectedPolygon.length; i++) {
      const p1 = projectedPolygon[i];
      const p2 = projectedPolygon[(i + 1) % projectedPolygon.length];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      let nx = -dy;
      let ny = dx;
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len > 0) { nx /= len; ny /= len; }
      
      // We check score
      let centroidX = 0;
      let centroidY = 0;
      for (const p of projectedPolygon) {
        centroidX += p.x;
        centroidY += p.y;
      }
      centroidX /= projectedPolygon.length;
      centroidY /= projectedPolygon.length;
      
      const t1x = mx + nx * 0.8;
      const t1y = my + ny * 0.8;
      const t2x = mx - nx * 0.8;
      const t2y = my - ny * 0.8;
      const dist1 = (t1x - centroidX) ** 2 + (t1y - centroidY) ** 2;
      const dist2 = (t2x - centroidX) ** 2 + (t2y - centroidY) ** 2;
      const outX = dist1 > dist2 ? t1x : t2x;
      const outY = dist1 > dist2 ? t1y : t2y;
      
      const cellX = Math.round(outX);
      const cellY = Math.round(outY);
      const gridY = gridRows - 1 - cellY;
      
      let directWalkable = false;
      if (cellX >= 0 && cellX < gridCols && gridY >= 0 && gridY < gridRows) {
        if (grid[gridY][cellX] === 0) directWalkable = true;
      }
      
      console.log(`  Segment ${i}: Midpoint (${mx.toFixed(1)}, ${my.toFixed(1)}) | Normal Outward: (${(outX - mx).toFixed(2)}, ${(outY - my).toFixed(2)}) | Evaluated cell: (${cellX}, ${cellY}) [gridY: ${gridY}] | Direct Walkable: ${directWalkable}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
