import { getHudsonProjectionBounds } from '../src/utils/projection';
import { loadHudsonLayoutRooms } from '../src/utils/projection';

function testBounds() {
  const rooms = loadHudsonLayoutRooms('Gurugram_3rd.json');
  console.log('Total rooms loaded from Gurugram_3rd.json:', rooms.length);
  const bounds = getHudsonProjectionBounds('floor-gurugram-f3');
  console.log('Gurugram projection bounds:', bounds);
}

testBounds();
