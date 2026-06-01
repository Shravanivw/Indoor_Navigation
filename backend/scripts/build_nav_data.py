"""Build nav_floor_data.json from floor_data_clean.json.

- Normalises coords to start at (0, 0).
- Rasterises walls onto an 80x80 walkability grid (1=walkable, 0=blocked).
- Places rooms using their label position + embedded W x H (default 3500x3500 mm
  when missing). Room interiors are forced walkable.
- Writes the exact shape consumed downstream by generate_seed_from_nav.py /
  seed.ts (floorId, buildingName, level, gridCols, gridRows, scaleX, scaleY,
  realWidthM, realHeightM, grid, rooms, meta).
"""
from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path

GRID_COLS = 80
GRID_ROWS = 80
DEFAULT_ROOM_W_MM = 3500
DEFAULT_ROOM_H_MM = 3500

DEFAULTS = {
    "floorId": "floor-vwits-f5",
    "buildingName": "VWITS Pune",
    "level": 5,
    "qrPrefix": "LOC-F5",
}


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "room"


def rasterise_segment(grid, x0c, y0c, x1c, y1c, rows, cols):
    """Mark all grid cells the segment passes through as blocked (0), plus a
    1-cell 4-neighbourhood halo so the wall is at least 3 cells thick. This
    prevents A* from squeezing diagonally through sparse wall samples."""
    dx = x1c - x0c
    dy = y1c - y0c
    # Oversample 4 cells per unit so we never skip a cell along the segment.
    steps = max(1, int(math.ceil(max(abs(dx), abs(dy)) * 4)))
    for i in range(steps + 1):
        t = i / steps
        cx = int(round(x0c + dx * t))
        cy = int(round(y0c + dy * t))
        for ddx, ddy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + ddx, cy + ddy
            if 0 <= nx < cols and 0 <= ny < rows:
                grid[ny][nx] = 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="backend/src/data/floor_data_clean.json")
    ap.add_argument("--output", default="backend/src/data/nav_floor_data.json")
    ap.add_argument("--floor-id", default=DEFAULTS["floorId"])
    ap.add_argument("--building", default=DEFAULTS["buildingName"])
    ap.add_argument("--level", type=int, default=DEFAULTS["level"])
    ap.add_argument("--qr-prefix", default=DEFAULTS["qrPrefix"])
    ap.add_argument("--cols", type=int, default=GRID_COLS)
    ap.add_argument("--rows", type=int, default=GRID_ROWS)
    args = ap.parse_args()

    src = Path(args.input)
    dst = Path(args.output)
    data = json.loads(src.read_text(encoding="utf-8"))

    bbox = data["boundingBox"]
    min_x, min_y = bbox["minX"], bbox["minY"]
    width_mm = bbox["maxX"] - min_x
    height_mm = bbox["maxY"] - min_y
    real_w_m = round(width_mm / 1000.0, 3)
    real_h_m = round(height_mm / 1000.0, 3)

    cols, rows = args.cols, args.rows
    cell_w_mm = width_mm / cols
    cell_h_mm = height_mm / rows
    scale_x = round(real_w_m / cols, 4)
    scale_y = round(real_h_m / rows, 4)

    # Start fully walkable
    grid = [[1] * cols for _ in range(rows)]

    # Rasterise walls
    for wall in data.get("walls", []):
        pts = wall.get("points", [])
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            x0c = (x0 - min_x) / cell_w_mm
            y0c = (y0 - min_y) / cell_h_mm
            x1c = (x1 - min_x) / cell_w_mm
            y1c = (y1 - min_y) / cell_h_mm
            rasterise_segment(grid, x0c, y0c, x1c, y1c, rows, cols)

    # Place rooms
    out_rooms = []
    for r in data.get("rooms", []):
        name = r["name"]
        code = re.sub(r"[^A-Z0-9]+", "_", name.upper()).strip("_")
        w_mm = r.get("widthMm") or DEFAULT_ROOM_W_MM
        h_mm = r.get("heightMm") or DEFAULT_ROOM_H_MM

        lx_mm = r["x"] - min_x
        ly_mm = r["y"] - min_y

        gw = max(1, int(round(w_mm / cell_w_mm)))
        gh = max(1, int(round(h_mm / cell_h_mm)))
        gx = int(round(lx_mm / cell_w_mm - gw / 2))
        gy = int(round(ly_mm / cell_h_mm - gh / 2))

        gx = max(0, min(cols - gw, gx))
        gy = max(0, min(rows - gh, gy))

        # Block room interiors so routing paths cannot cut through other
        # rooms. The graph builder will pick an entry cell on the room's
        # boundary via a BFS for the nearest walkable cell.
        for yy in range(gy, gy + gh):
            for xx in range(gx, gx + gw):
                grid[yy][xx] = 0

        centre_x = round((gx + gw / 2) * scale_x, 2)
        centre_y = round((gy + gh / 2) * scale_y, 2)

        out_rooms.append({
            "id": f"room-f{args.level}-{slugify(name)}",
            "code": code,
            "name": name,
            "gridX": gx,
            "gridY": gy,
            "gridW": gw,
            "gridH": gh,
            "centreX": centre_x,
            "centreY": centre_y,
            "widthMm": int(w_mm),
            "heightMm": int(h_mm),
            "qrCode": f"{args.qr_prefix}-{code}",
        })

    # Dilate the blocked area by one cell. The DXF often lacks the inner
    # partition walls between adjacent rooms, leaving 1-cell "gaps" the A*
    # would happily squeeze through (the user perceives this as the path
    # going through walls). Dilating fills those gaps and forces routes
    # through the actual open corridor space.
    dilated = [row[:] for row in grid]
    for y in range(rows):
        for x in range(cols):
            if grid[y][x] == 0:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx] == 0:
                    dilated[y][x] = 0
                    break
    grid = dilated

    nav = {
        "floorId": args.floor_id,
        "buildingName": args.building,
        "level": args.level,
        "gridCols": cols,
        "gridRows": rows,
        "scaleX": scale_x,
        "scaleY": scale_y,
        "realWidthM": real_w_m,
        "realHeightM": real_h_m,
        "grid": grid,
        "rooms": out_rooms,
        "meta": {
            "source": str(src).replace("\\", "/"),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "wallCount": len(data.get("walls", [])),
            "roomCount": len(out_rooms),
        },
    }

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(nav, indent=2), encoding="utf-8")

    blocked = sum(1 for row in grid for c in row if c == 0)
    total = cols * rows
    print(f"Wrote {dst}")
    print(f"  grid: {cols}x{rows}  scale: {scale_x} x {scale_y} m/cell")
    print(f"  size: {real_w_m} x {real_h_m} m")
    print(f"  blocked cells: {blocked}/{total} ({100*blocked/total:.1f}%)")
    print(f"  rooms: {len(out_rooms)}")


if __name__ == "__main__":
    main()
