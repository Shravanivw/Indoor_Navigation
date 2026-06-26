import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('src/data/Hudson_5th.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const targetNode = data.graph.nodes.find((n: any) => n.id === 'N44');
console.log('Target Node N44:', targetNode);

const nearbyNodes = data.graph.nodes.filter((n: any) => {
  const d = Math.hypot(n.x - targetNode.x, n.y - targetNode.y);
  return d <= 350 && n.id !== 'N44';
});

console.log('\n--- Nodes within 350px of N44 ---');
for (const n of nearbyNodes) {
  const d = Math.hypot(n.x - targetNode.x, n.y - targetNode.y);
  console.log(`Node: ${n.id} at (${n.x}, ${n.y}), Distance: ${d.toFixed(2)} px, Type: ${n.type}, Room: ${n.roomId}`);
}
