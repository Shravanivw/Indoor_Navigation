import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('src/data/Hudson_5th.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('--- Rooms with 0 doors in Hudson_5th.json ---');
let count = 0;
for (const room of data.rooms) {
  if (!room.doors || room.doors.length === 0) {
    console.log(`Room: "${room.id}" (Type: ${room.type})`);
    count++;
  }
}
console.log('Total rooms with 0 doors:', count);
