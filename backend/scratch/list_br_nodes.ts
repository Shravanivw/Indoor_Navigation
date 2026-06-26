import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('src/data/Hudson_5th.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('--- Nodes in x > 4400, y > 3100 ---');
for (const n of data.graph.nodes) {
  if (n.x > 4400 && n.y > 3100) {
    console.log(`Node: ${n.id} at (${n.x}, ${n.y}), Type: ${n.type}, Room: ${n.roomId}, DoorId: ${n.doorId}`);
  }
}
