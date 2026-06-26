import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('src/data/Hudson_5th.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const target = data.rooms.find((r: any) => r.id === 'Balcony 1');

function getBounds(poly: any[]) {
  const xs = poly.map(p => p.x);
  const ys = poly.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

const targetBounds = getBounds(target.polygon);
console.log('Balcony 1 Bounds:', targetBounds);

console.log('\n--- Nearby Rooms ---');
for (const r of data.rooms) {
  if (r.id === 'Balcony 1') continue;
  const b = getBounds(r.polygon);
  const dx = Math.max(0, targetBounds.minX - b.maxX, b.minX - targetBounds.maxX);
  const dy = Math.max(0, targetBounds.minY - b.maxY, b.minY - targetBounds.maxY);
  const dist = Math.hypot(dx, dy);
  if (dist <= 800) {
    console.log(`Room: "${r.id}" at bounds [${b.minX}..${b.maxX}, ${b.minY}..${b.maxY}], Distance: ${dist.toFixed(2)} px`);
  }
}
