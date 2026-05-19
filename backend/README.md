# Indoor Navigation Backend
### Pinakiin Designs Office — Room-to-Room Navigation API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│          (Map Tab · Search Tab · QR Scanner Tab)            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express API  :3001                         │
│                                                              │
│  POST /api/v1/route          ← main route endpoint          │
│  GET  /api/v1/floors/:id/map ← floor plan + grid            │
│  GET  /api/v1/rooms/search   ← room search                  │
│  GET  /api/v1/rooms/qr/:code ← QR scanner lookup            │
└──────────┬────────────────────┬────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌─────────────────────────────────────┐
│  Routing Service │  │           Map Service                │
│                  │  │                                      │
│  A* Pathfinding  │  │  Floor/Room/Node data retrieval      │
│  Graph Builder   │  │  SVG/Grid serving                    │
│  Step Generator  │  │  Room search                        │
└──────┬───────────┘  └──────────────┬──────────────────────┘
       │                             │
       ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Prisma ORM)                   │
│                                                              │
│  buildings → floors → rooms                                  │
│  floors → nodes → edges (navigation graph)                   │
│  nav_sessions (route history)                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Pipeline

```
COORDINATED_LAYOUT.dwg
        │
        ▼  ODA File Converter (free, opendesign.com)
        │  Output: DXF R2000
        ▼
  parse_dxf.py  →  src/data/floor_data.json
        │           (walls, rooms, labels, bounding box)
        ▼
  importFloorData.ts  →  PostgreSQL
        │                (grid, nodes, edges)
        ▼
  seed.ts (rooms, named nodes, edges already seeded)
        │
        ▼
  npm run dev  →  API ready
```

---

## Project Structure

```
indoor-nav-backend/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.ts                # Express app + middleware
│   ├── types/
│   │   └── index.ts          # All shared TypeScript interfaces
│   ├── api/
│   │   └── routes/
│   │       └── index.ts      # All REST endpoints
│   ├── services/
│   │   ├── routingService.ts # Route computation + QR lookup
│   │   └── mapService.ts     # Floor/room data retrieval
│   └── engine/
│       ├── astar.ts          # A* pathfinding (grid + graph)
│       ├── graphBuilder.ts   # Adjacency list builder + cache
│       └── gridGenerator.ts  # DXF geometry → walkability grid
├── scripts/
│   ├── parse_dxf.py          # Python: DXF → floor_data.json
│   ├── importFloorData.ts    # TS: floor_data.json → PostgreSQL
│   └── seed.ts               # TS: seed rooms/nodes/edges
├── prisma/
│   └── schema.prisma         # DB schema (buildings/floors/rooms/nodes/edges)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Python 3.10+ (for DXF parsing only)

### 2. Install

```bash
cd indoor-nav-backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
```

### 4. Database setup

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Start dev server

```bash
npm run dev
# API running at http://localhost:3001/api/v1
```

### 6. Parse your DWG (when you can install ezdxf)

```bash
# Convert DWG → DXF R2000 using ODA File Converter first, then:
pip install ezdxf
python3 scripts/parse_dxf.py --input path/to/your.dxf --output src/data/floor_data.json
ts-node scripts/importFloorData.ts --floor floor-gf --file src/data/floor_data.json
```

---

## API Reference

### Compute a route
```
POST /api/v1/route
Content-Type: application/json

{
  "fromRoomId": "room-gf-entrance",
  "toRoomId":   "room-gf-boardroom",
  "options": { "accessibleOnly": false }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "found": true,
    "pathGridCells": [
      {"x": 25, "y": 42},
      {"x": 25, "y": 35},
      {"x": 11, "y": 14}
    ],
    "steps": [
      { "instruction": "Head north for 27m", "distanceM": 27, "gridCell": {"x":25,"y":42} },
      { "instruction": "Turn west, continue for 18m", "distanceM": 18, "gridCell": {"x":25,"y":35} },
      { "instruction": "Arrived at destination", "distanceM": 0, "gridCell": {"x":11,"y":14} }
    ],
    "totalDistanceM": 45,
    "estimatedSeconds": 32,
    "floorChanges": 0,
    "accessible": false
  }
}
```

### Get floor map
```
GET /api/v1/floors/floor-gf/map
```
Returns the walkability grid + all room positions. Frontend uses this to render the SVG map and overlay the path.

### Search rooms
```
GET /api/v1/rooms/search?q=boardroom
```

### QR code lookup
```
GET /api/v1/rooms/qr/LOC-GF-BOARDROOM
```
Used by the QR scanner tab. Returns the room so the frontend can set it as the route origin.

### Route via QR codes
```
GET /api/v1/route/qr?from=LOC-GF-ENTRANCE&to=LOC-GF-BOARDROOM
```

---

## Frontend Integration

In your React app, replace the hardcoded `LOCATIONS` and `BASE_GRID` constants with API calls:

```js
// On app load — fetch floor map
const { data: floorMap } = await fetch('/api/v1/floors/floor-gf/map').then(r => r.json());
// floorMap.grid      → pass to A* or render walls
// floorMap.rooms     → render room labels on SVG

// On "Find Route" click
const { data: route } = await fetch('/api/v1/route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fromRoomId, toRoomId })
}).then(r => r.json());
// route.pathGridCells → draw blue path on SVG
// route.steps         → show turn-by-turn directions

// On QR scan
const { data: room } = await fetch(`/api/v1/rooms/qr/${scannedCode}`).then(r => r.json());
// Set room.id as fromRoomId, navigate to Search tab
```

---

## QR Code Format

Place QR codes around the office. Each QR code encodes a URL:
```
https://your-domain.com/nav?qr=LOC-GF-BOARDROOM
```

The frontend intercepts the `?qr=` param, calls `/api/v1/rooms/qr/LOC-GF-BOARDROOM`,
and sets that room as the navigation start point.

QR codes seeded in DB:
| Room              | QR Code                  |
|-------------------|--------------------------|
| Main Entrance     | LOC-GF-ENTRANCE          |
| Reception         | LOC-GF-RECEPTION         |
| Boardroom         | LOC-GF-BOARDROOM         |
| PAX Meeting Room  | LOC-GF-PAX-MEETING       |
| Open Workspace    | LOC-GF-OPEN-WORKSPACE    |
| Pantry            | LOC-GF-PANTRY            |
| Restroom (Male)   | LOC-GF-WC-MALE           |
| Restroom (Female) | LOC-GF-WC-FEMALE         |
| Multipurpose Room | LOC-GF-MULTIPURPOSE      |
| Emergency Exit    | LOC-GF-EMERGENCY-EXIT    |

---

## MVP Roadmap

**Week 1 — Critical**
- [ ] DB setup + seed
- [ ] `POST /route` working end-to-end
- [ ] `GET /floors/:id/map` serving grid to frontend
- [ ] Frontend fetching route from API (replace hardcoded A*)

**Week 2 — Important**
- [ ] Run `parse_dxf.py` on real DXF → real grid in DB
- [ ] QR scan → room lookup → route
- [ ] Accessible route option (avoid stairs)

**Week 3 — Polish**
- [ ] Multi-floor routing (add First Floor nodes + staircase edges)
- [ ] Route caching (cache popular routes in memory)
- [ ] Admin endpoint to reload graph without restart
