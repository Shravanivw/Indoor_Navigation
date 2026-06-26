import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';
import { getFloorMap } from '../src/services/mapService';

const prisma = new PrismaClient();

async function test() {
  try {
    const map = await getFloorMap(prisma, 'floor-hudson-f5');
    if (!map) return;

    const route = await getRoute(prisma, {
      fromRoomId: 'editor-floor-hudson-f5-room-board-room',
      toRoomId: 'editor-floor-hudson-f5-room-informal-room'
    });

    console.log("Checking path intersections with rooms...");
    route.pathGridCells.forEach((cell, idx) => {
      console.log(`Cell ${idx}: (${cell.x.toFixed(2)}, ${cell.y.toFixed(2)})`);
      map.rooms.forEach(room => {
        // Check if cell is inside room bounding box
        const minX = room.gridX;
        const maxX = room.gridX + room.gridW;
        const minY = room.gridY - room.gridH;
        const maxY = room.gridY;

        if (cell.x >= minX && cell.x <= maxX && cell.y >= minY && cell.y <= maxY) {
          console.log(`  -> INTERSECTS room: ${room.name} (${room.id})`);
        }
      });
    });

  } catch (err) {
    console.error("Error during test:", err);
  }
  process.exit(0);
}
test();
