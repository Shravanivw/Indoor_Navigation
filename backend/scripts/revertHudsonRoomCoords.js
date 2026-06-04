const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const originals = [
  { id: 'room-h5-reception',           gridX: 34, gridY: 52, gridW: 4, gridH: 6 },
  { id: 'room-h5-cafeteria',           gridX: 34, gridY: 34, gridW: 1, gridH: 1 },
  { id: 'room-h5-it_bar',              gridX: 14, gridY: 29, gridW: 1, gridH: 1 },
  { id: 'room-h5-pki_room',            gridX:  2, gridY: 35, gridW: 3, gridH: 4 },
  { id: 'room-h5-recreational_room',   gridX: 73, gridY: 28, gridW: 1, gridH: 1 },
  { id: 'room-h5-laptop_repair_room',  gridX:  1, gridY: 25, gridW: 3, gridH: 4 },
  { id: 'room-h5-executive_dining_room',gridX: 9, gridY: 39, gridW: 1, gridH: 1 },
  { id: 'room-h5-fire_exit_1',         gridX: 48, gridY: 32, gridW: 1, gridH: 1 },
  { id: 'room-h5-training_room',       gridX: 45, gridY: 39, gridW: 1, gridH: 1 },
  { id: 'room-h5-medical_room',        gridX: 59, gridY: 52, gridW: 4, gridH: 4 },
  { id: 'room-h5-av_room',             gridX: 55, gridY: 53, gridW: 4, gridH: 6 },
  { id: 'room-h5-innovation_lab',      gridX: 59, gridY: 10, gridW: 1, gridH: 1 },
  { id: 'room-h5-fire_exit_2',         gridX: 64, gridY: 10, gridW: 1, gridH: 1 },
  { id: 'room-h5-board_room',          gridX: 27, gridY:  5, gridW: 1, gridH: 1 },
  { id: 'room-h5-aws_room',            gridX:  2, gridY: 16, gridW: 1, gridH: 1 },
  { id: 'room-h5-vending_machine',     gridX: 73, gridY: 36, gridW: 1, gridH: 1 },
];

(async () => {
  for (const r of originals) {
    await p.room.update({
      where: { id: r.id },
      data:  { gridX: r.gridX, gridY: r.gridY, gridW: r.gridW, gridH: r.gridH },
    });
    console.log(`  Reverted ${r.id}`);
  }
  console.log('\nDone.');
  await p.$disconnect();
})();
