import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('src/data/Hudson_5th.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const room = data.rooms.find((r: any) => r.id === 'AHU Room 3');
console.log('AHU Room 3:', room);

// Compute centroid
const xs = room.polygon.map((p: any) => p.x);
const ys = room.polygon.map((p: any) => p.y);
const cx = xs.reduce((sum: number, x: number) => sum + x, 0) / xs.length;
const cy = ys.reduce((sum: number, y: number) => sum + y, 0) / ys.length;
console.log(`Centroid: (${cx.toFixed(2)}, ${cy.toFixed(2)})`);

const nearbyNodes = data.graph.nodes.filter((n: any) => {
  const d = Math.hypot(n.x - cx, n.y - cy);
  return d <= 300;
});

console.log('\n--- Nodes within 300px of AHU Room 3 Centroid ---');
for (const n of nearbyNodes) {
  const d = Math.hypot(n.x - cx, n.y - cy);
  console.log(`Node: ${n.id} at (${n.x}, ${n.y}), Distance: ${d.toFixed(2)} px, Type: ${n.type}, Room: ${n.roomId}`);
}
