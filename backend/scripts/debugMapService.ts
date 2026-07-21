import { PrismaClient } from '@prisma/client';
import { getFloorMap, getFloorGeometry } from '../src/services/mapService';

const prisma = new PrismaClient();

async function debugFloor(floorId: string) {
  console.log(`\n=================== DEBUG FLOOR: ${floorId} ===================`);
  try {
    const map = await getFloorMap(prisma, floorId);
    if (!map) {
      console.log(`Floor ${floorId} not found in database.`);
      return;
    }
    console.log(`Name:        ${map.name}`);
    console.log(`Level:       ${map.level}`);
    console.log(`Grid:        ${map.gridCols} x ${map.gridRows}`);
    console.log(`Scale X/Y:   ${map.scaleX} / ${map.scaleY}`);
    console.log(`Real Size:   ${map.realWidthM}m x ${map.realHeightM}m`);
    console.log(`Rooms count: ${map.rooms.length}`);
    console.log(`Nodes count: ${map.nodes.length}`);
    console.log(`Edges count: ${map.edges.length}`);
    
    if (map.rooms.length > 0) {
      const r = map.rooms[0];
      console.log(`First Room:  '${r.name}' (id=${r.id}, code=${r.code})`);
      console.log(`  gridX/Y/W/H: ${r.gridX}, ${r.gridY}, ${r.gridW}, ${r.gridH}`);
      console.log(`  centreX/Y:   ${r.centreX}, ${r.centreY}`);
      console.log(`  polygon present: ${!!r.polygon} (length=${r.polygon?.length})`);
      console.log(`  doors present:   ${!!r.doors} (length=${r.doors?.length})`);
      if (r.polygon && r.polygon.length > 0) {
        console.log(`  polygon example:`, r.polygon.slice(0, 3));
      }
    }
    
    const geom = await getFloorGeometry(prisma, floorId);
    if (geom) {
      console.log(`Geometry Bounding Box:`, geom.boundingBox);
      console.log(`Geometry Walls count: `, geom.walls.length);
    } else {
      console.log(`Geometry not found.`);
    }
  } catch (err: any) {
    console.error(`ERROR debugging floor ${floorId}:`, err);
  }
}

async function main() {
  await debugFloor('floor-hudson-f5');
  await debugFloor('floor-hudson-f6');
  await debugFloor('floor-hudson-f7');
  await debugFloor('floor-ganges-f9');
}

main().catch(console.error).finally(() => prisma.$disconnect());
