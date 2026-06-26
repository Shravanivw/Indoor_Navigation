import { PrismaClient } from '@prisma/client';
import { getRoute } from '../src/services/routingService';

const prisma = new PrismaClient();

const routesToValidate = [
  { name: 'Reception -> AHU Room', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-ahu-room' },
  { name: 'Reception -> AHU Room 3', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-ahu-room-3' },
  { name: 'Reception -> DishWash Area', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-dishwash-area' },
  { name: 'Reception -> Balcony 1', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-balcony-1' },
  { name: 'Reception -> Female Shower', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-female-shower' },
  { name: 'Reception -> AR/VR Lab', from: 'editor-floor-hudson-f5-room-reception', to: 'editor-floor-hudson-f5-room-ar-vr-lab' }
];

async function main() {
  try {
    for (const routeCfg of routesToValidate) {
      console.log(`\n======================================================`);
      console.log(`VALIDATE: ${routeCfg.name}`);
      console.log(`======================================================`);
      const result = await getRoute(prisma, {
        fromRoomId: routeCfg.from,
        toRoomId: routeCfg.to
      });

      if (result.found) {
        console.log(`- Chosen source node      : ${result.pathNodeIds[0]}`);
        console.log(`- Chosen destination node : ${result.pathNodeIds[result.pathNodeIds.length - 1]}`);
        console.log(`- Total distance          : ${result.totalDistanceM} m`);
        console.log(`- Number of nodes traversed: ${result.pathNodeIds.length}`);
        
        console.log(`- Turn steps:`);
        result.steps.forEach((step, idx) => {
          console.log(`  ${idx + 1}. ${step.instruction} (dist: ${step.distanceM} m)`);
        });
      } else {
        console.log(`- Route FAILED to find path.`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
