"""Generate a wall-respecting navigation graph for a floor.

Approach:
 1. Read nav JSON (walkability grid + rooms).
 2. For each room, locate a walkable entry cell at/near its centre.
 3. Run grid A* between every pair of rooms.
 4. Simplify each path: keep only direction-change cells ("corners").
 5. Emit unique cells as nodes; consecutive corners as edges.
 6. Write the graph back into the same nav JSON under `.graph`.

Usage:
  python build_nav_graph.py --input backend/src/data/nav_hudson_f5.json
"""
from __future__ import annotations

import argparse
import heapq
import json
import math
from pathlib import Path

# 4-direction movement only — 8-direction can squeeze diagonally through
# sparse wall rasterisations even with the corner check.
DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def in_bounds(x: int, y: int, cols: int, rows: int) -> bool:
    return 0 <= x < cols and 0 <= y < rows


def walkable(grid, x: int, y: int) -> bool:
    return grid[y][x] == 1


def nearest_walkable(grid, cols: int, rows: int, x: int, y: int) -> tuple[int, int] | None:
    """BFS outward to find the closest walkable cell."""
    if in_bounds(x, y, cols, rows) and walkable(grid, x, y):
        return (x, y)
    from collections import deque
    seen = {(x, y)}
    q = deque([(x, y)])
    while q:
        cx, cy = q.popleft()
        for dx, dy in DIRS:
            nx, ny = cx + dx, cy + dy
            if not in_bounds(nx, ny, cols, rows) or (nx, ny) in seen:
                continue
            seen.add((nx, ny))
            if walkable(grid, nx, ny):
                return (nx, ny)
            q.append((nx, ny))
    return None


def astar(grid, cols: int, rows: int, sx_m: float, sy_m: float,
         start: tuple[int, int], goal: tuple[int, int]):
    if start == goal:
        return [start]
    gx, gy = goal
    open_heap: list[tuple[float, int, tuple[int,int]]] = []
    heapq.heappush(open_heap, (0.0, 0, start))
    came_from: dict[tuple[int,int], tuple[int,int]] = {}
    g_score = {start: 0.0}
    counter = 1
    while open_heap:
        _, _, current = heapq.heappop(open_heap)
        if current == goal:
            path = [current]
            while path[-1] in came_from:
                path.append(came_from[path[-1]])
            path.reverse()
            return path
        cx, cy = current
        for dx, dy in DIRS:
            nx, ny = cx + dx, cy + dy
            if not in_bounds(nx, ny, cols, rows) or not walkable(grid, nx, ny):
                continue
            # Cost in real metres so non-square cells don't bias the path.
            step = sx_m if dx else sy_m
            tentative = g_score[current] + step
            neighbour = (nx, ny)
            if tentative < g_score.get(neighbour, float('inf')):
                came_from[neighbour] = current
                g_score[neighbour] = tentative
                h = math.hypot((nx - gx) * sx_m, (ny - gy) * sy_m)
                counter += 1
                heapq.heappush(open_heap, (tentative + h, counter, neighbour))
    return None


def line_of_sight(grid, cols: int, rows: int,
                  a: tuple[int, int], b: tuple[int, int]) -> bool:
    """Bresenham — all cells on the line from a to b must be walkable."""
    x0, y0 = a
    x1, y1 = b
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        if not in_bounds(x, y, cols, rows) or not walkable(grid, x, y):
            return False
        if x == x1 and y == y1:
            return True
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def smooth(grid, cols: int, rows: int,
           path: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Keep only the cells where the path changes direction (corners).

    LOS smoothing was tried but produced long diagonals that visually cut
    across rooms — Bresenham samples discrete cells along the line, but a
    straight line drawn between two distant waypoints in continuous space
    can pass through walls that the discrete check misses. Corner-keeping
    guarantees every segment is axis-aligned along an actual corridor
    cell sequence the grid A* approved."""
    if len(path) < 3:
        return list(path)
    out = [path[0]]
    for i in range(1, len(path) - 1):
        px, py = path[i - 1]
        cx, cy = path[i]
        nx, ny = path[i + 1]
        # Direction vectors before and after this cell.
        d1 = (cx - px, cy - py)
        d2 = (nx - cx, ny - cy)
        if d1 != d2:
            out.append(path[i])
    out.append(path[-1])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--node-prefix", default="node-auto")
    args = ap.parse_args()

    path = Path(args.input)
    nav = json.loads(path.read_text(encoding="utf-8"))

    grid = nav["grid"]
    cols = nav["gridCols"]
    rows = nav["gridRows"]
    sx_m = nav["scaleX"]
    sy_m = nav["scaleY"]

    # Find a walkable entry cell per room (at the centre of its rectangle).
    room_cells: dict[str, tuple[int, int]] = {}
    for r in nav["rooms"]:
        cx = r["gridX"] + r["gridW"] // 2
        cy = r["gridY"] + r["gridH"] // 2
        cell = nearest_walkable(grid, cols, rows, cx, cy)
        if cell is not None:
            room_cells[r["code"]] = cell

    if len(room_cells) < 2:
        print("Not enough rooms with walkable entry cells.")
        return

    # All-pairs grid A* + simplification.
    # Unique cell -> node id. Edges between consecutive simplified cells.
    cell_to_id: dict[tuple[int, int], str] = {}
    edges: dict[tuple[str, str], float] = {}

    def cell_id(c: tuple[int, int]) -> str:
        if c not in cell_to_id:
            cell_to_id[c] = f"{args.node_prefix}-{c[0]}-{c[1]}"
        return cell_to_id[c]

    # Register room-entry cells first so they get stable ids.
    room_entry_node: dict[str, str] = {}
    for code, c in room_cells.items():
        room_entry_node[code] = cell_id(c)

    codes = list(room_cells.keys())
    skipped = 0
    for i in range(len(codes)):
        for j in range(i + 1, len(codes)):
            a, b = room_cells[codes[i]], room_cells[codes[j]]
            raw = astar(grid, cols, rows, sx_m, sy_m, a, b)
            if raw is None:
                skipped += 1
                continue
            simp = smooth(grid, cols, rows, raw)
            for k in range(len(simp) - 1):
                u, v = simp[k], simp[k + 1]
                uid, vid = cell_id(u), cell_id(v)
                w = math.hypot((v[0] - u[0]) * sx_m, (v[1] - u[1]) * sy_m)
                key = (uid, vid) if uid < vid else (vid, uid)
                if key not in edges or edges[key] > w:
                    edges[key] = round(w, 2)

    nodes_out = []
    for cell, nid in cell_to_id.items():
        x, y = cell
        nodes_out.append({
            "id": nid,
            "gridX": x,
            "gridY": y,
            "realX": round(x * sx_m, 2),
            "realY": round(y * sy_m, 2),
            "type": "WAYPOINT",
        })

    edges_out = [{"from": a, "to": b, "weight": w} for (a, b), w in edges.items()]

    nav["graph"] = {
        "roomEntryNodes": room_entry_node,   # code -> nodeId
        "nodes": nodes_out,
        "edges": edges_out,
    }
    path.write_text(json.dumps(nav, indent=2), encoding="utf-8")

    print(f"Wrote graph into {path}")
    print(f"  rooms with entries: {len(room_entry_node)}/{len(nav['rooms'])}")
    print(f"  nodes:  {len(nodes_out)}")
    print(f"  edges:  {len(edges_out)}")
    print(f"  pairs skipped (no path): {skipped}")


if __name__ == "__main__":
    main()
