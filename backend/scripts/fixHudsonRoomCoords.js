// Fixes Hudson 5th floor room grid coordinates to match the navigation node
// pixel positions (converted to grid space). This aligns room labels in the
// 3D view with the actual navigation path.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const FLOOR_PX_W = 800;
const FLOOR_PX_H = 500;
const GRID_COLS  = 80;
const GRID_ROWS  = 80;

// Convert pixel coord to grid coord
const toGrid = (px, py) => ({
  gx: Math.round(px / FLOOR_PX_W * GRID_COLS),
  gy: Math.round(py / FLOOR_PX_H * GRID_ROWS),
});

(async () => {
  // Get all Hudson nodes that have a roomId (these have pixel coords as gridX/gridY)
  const nodes = await p.node.findMany({
    where: { floorId: 'floor-hudson-f5', roomId: { not: null } },
    select: { id: true, roomId: true, label: true, gridX: true, gridY: true },
  });

  console.log(`Updating ${nodes.length} rooms based on node pixel positions...\n`);

  for (const node of nodes) {
    const { gx, gy } = toGrid(node.gridX, node.gridY);

    // Fetch current room to preserve gridW/gridH if they look reasonable
    const room = await p.room.findUnique({
      where: { id: node.roomId },
      select: { gridX: true, gridY: true, gridW: true, gridH: true, name: true },
    });
    if (!room) continue;

    // Keep existing dimensions if they're a real room size, otherwise use defaults
    const gridW = room.gridW >= 3 ? room.gridW : 8;
    const gridH = room.gridH >= 3 ? room.gridH : 6;
    // Centre the room on the node position
    const newX  = Math.max(0, gx - Math.floor(gridW / 2));
    const newY  = Math.max(0, gy - Math.floor(gridH / 2));

    await p.room.update({
      where: { id: node.roomId },
      data:  { gridX: newX, gridY: newY, gridW, gridH },
    });

    console.log(
      `  ${room.name.padEnd(28)}  (${room.gridX},${room.gridY}) → (${newX},${newY})  size ${gridW}x${gridH}`
    );
  }

  console.log('\nDone.');
  await p.$disconnect();
})();
