"use strict";
// scripts/importFloorData.ts
// Run AFTER parse_dxf.py to load real floor geometry into the database.
// This replaces the placeholder grid in seed.ts with actual parsed data.
//
// Usage: ts-node scripts/importFloorData.ts --floor floor-gf --file src/data/floor_data.json
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gridGenerator_1 = require("../src/engine/gridGenerator");
const prisma = new client_1.PrismaClient();
async function main() {
    const args = process.argv.slice(2);
    const floorId = args[args.indexOf('--floor') + 1] ?? 'floor-gf';
    const filePath = args[args.indexOf('--file') + 1] ?? 'src/data/floor_data.json';
    console.log(`Loading ${filePath}...`);
    const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
    const floorplan = JSON.parse(raw);
    console.log(`Generating walkability grid...`);
    const generated = (0, gridGenerator_1.generateGrid)(floorplan, 50, 50);
    console.log(`Grid: ${generated.cols}×${generated.rows}, cell size: ${generated.cellSizeM.toFixed(2)}m`);
    // Detect corridor junctions and create nodes
    const junctions = (0, gridGenerator_1.detectJunctions)(generated.grid);
    console.log(`Detected ${junctions.length} potential corridor junctions`);
    // Update floor with real grid data
    await prisma.floor.update({
        where: { id: floorId },
        data: {
            gridCols: generated.cols,
            gridRows: generated.rows,
            gridData: JSON.stringify(generated.grid),
            scaleX: generated.cellSizeM,
            scaleY: generated.cellSizeM,
            widthM: floorplan.boundingBox.widthM,
            heightM: floorplan.boundingBox.heightM,
        },
    });
    console.log(`✓ Floor ${floorId} updated with real grid data`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review the junction nodes — delete irrelevant ones`);
    console.log(`  2. Manually assign roomId to nodes near room entries`);
    console.log(`  3. Run 'npm run dev' and test the /api/v1/route endpoint`);
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=importFloorData.js.map