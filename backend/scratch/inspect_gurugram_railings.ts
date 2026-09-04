import fs from 'fs';
import path from 'path';

async function auditGurugramRailings() {
  console.log("=================================================");
  console.log("   GURUGRAM 3RD FLOOR CAD & RAILINGS DIAGNOSIS   ");
  console.log("=================================================\n");

  const cadPath = path.join(__dirname, '../src/data/Gurugram_3rd.json');
  if (!fs.existsSync(cadPath)) {
    console.error("Gurugram_3rd.json not found!");
    return;
  }

  const cadData = JSON.parse(fs.readFileSync(cadPath, 'utf8'));

  console.log("Bounding Box:", JSON.stringify(cadData.boundingBox));

  // Inspect wall layers & types
  const layerStats: Record<string, number> = {};
  for (const wall of (cadData.walls || [])) {
    const l = wall.layer || 'default';
    layerStats[l] = (layerStats[l] || 0) + 1;
  }
  console.log("Wall Layer Segment Counts:", JSON.stringify(layerStats, null, 2));

  // Inspect rooms & polygons
  console.log(`\nTotal Rooms Defined: ${cadData.rooms?.length || 0}`);
  for (const r of (cadData.rooms || [])) {
    if (r.type === 'CORRIDOR' || r.name?.toLowerCase().includes('corridor') || r.name?.toLowerCase().includes('reception') || r.name?.toLowerCase().includes('hub')) {
      console.log(`  Corridor/Hub Room: "${r.name}" (${r.id}), Type: ${r.type}`);
      if (r.polygon) console.log(`    Poly Pts (${r.polygon.length}):`, JSON.stringify(r.polygon));
      if (r.doors) console.log(`    Doors (${r.doors.length}):`, JSON.stringify(r.doors));
    }
  }

  // Inspect navigation graph nodes & edges
  const navPath = path.join(__dirname, '../src/data/nav_gurugram_f3.json');
  if (fs.existsSync(navPath)) {
    const navData = JSON.parse(fs.readFileSync(navPath, 'utf8'));
    console.log(`\nNav Graph: ${navData.nodes?.length} nodes, ${navData.edges?.length} edges`);

    // Check nodes in the corridor connecting the two wings
    const middleNodes = (navData.nodes || []).filter((n: any) => n.gridX >= 30 && n.gridX <= 50);
    console.log(`Middle corridor connecting nodes (30 <= gridX <= 50): ${middleNodes.length}`);
    for (const n of middleNodes.slice(0, 10)) {
      console.log(`  Node ${n.id}: grid(${n.gridX}, ${n.gridY}), real(${n.realX?.toFixed(1)}, ${n.realY?.toFixed(1)}), room:${n.roomId}`);
    }
  }
}

auditGurugramRailings().catch(console.error);
