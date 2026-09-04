import { PrismaClient } from '@prisma/client';
import { getFloorMap } from '../src/services/mapService';

const prisma = new PrismaClient();

async function testWalk3DClassification() {
  const testFloors = [
    { id: 'floor-hudson-f5', expectedHudson: true, expectedEditor: false },
    { id: 'floor-hudson-f6', expectedHudson: true, expectedEditor: false },
    { id: 'floor-hudson-f7', expectedHudson: true, expectedEditor: false },
    { id: 'floor-ganges-f9', expectedHudson: false, expectedEditor: true },
    { id: 'floor-jupiter-f1', expectedHudson: false, expectedEditor: true },
    { id: 'floor-gravity-f1', expectedHudson: false, expectedEditor: true },
    { id: 'floor-gurugram-f3', expectedHudson: false, expectedEditor: true },
  ];

  console.log('=== TESTING WALK3D FLOOR CLASSIFICATION LOGIC ===\n');

  for (const item of testFloors) {
    const floorMap = await getFloorMap(prisma, item.id);
    if (!floorMap) {
      console.error(`Floor map not found for ${item.id}`);
      continue;
    }

    const fid = floorMap.floorId || (floorMap as any).id || '';
    const bId = (floorMap as any).buildingId || '';

    const isHudsonFloor = 
      String(bId).toLowerCase().includes("hudson") ||
      String(fid).toLowerCase().includes("hudson");

    const isEditorLayoutFloor = 
      !isHudsonFloor && (
        String(floorMap.level) === "9" || 
        String(floorMap.level) === "1" || 
        String(floorMap.level) === "3" || 
        String(fid).toLowerCase().includes("jupiter") || 
        String(fid).toLowerCase().includes("ganges") ||
        String(fid).toLowerCase().includes("gravity") ||
        String(fid).toLowerCase().includes("gurugram") ||
        String(bId).toLowerCase().includes("jupiter") ||
        String(bId).toLowerCase().includes("ganges") ||
        String(bId).toLowerCase().includes("gravity") ||
        String(bId).toLowerCase().includes("gurugram")
      );

    const isFloor6Or7 = String(floorMap.level) === "6" || String(floorMap.level) === "7" || String(floorMap.level) === "9" || isEditorLayoutFloor;

    const passHudson = isHudsonFloor === item.expectedHudson;
    const passEditor = isEditorLayoutFloor === item.expectedEditor;

    console.log(`Floor: ${item.id} (Level ${floorMap.level}, FloorId: ${fid})`);
    console.log(`  isHudsonFloor:       ${isHudsonFloor} (Expected: ${item.expectedHudson}) -> ${passHudson ? 'PASS' : 'FAIL'}`);
    console.log(`  isEditorLayoutFloor: ${isEditorLayoutFloor} (Expected: ${item.expectedEditor}) -> ${passEditor ? 'PASS' : 'FAIL'}`);
    console.log(`  isFloor6Or7:         ${isFloor6Or7}`);
    console.log(`  Rooms count:         ${floorMap.rooms.length}`);
    console.log(`  Sample room polygon: ${Array.isArray(floorMap.rooms[0]?.polygon) ? `${floorMap.rooms[0].polygon.length} pts` : 'NONE'}\n`);
  }

  await prisma.$disconnect();
}

testWalk3DClassification().catch(console.error);
