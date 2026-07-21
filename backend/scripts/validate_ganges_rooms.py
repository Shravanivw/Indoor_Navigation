import json
import os
import re
import math

def validate_rooms(cleaned_json_path, raw_json_path):
    print(f"Loading cleaned JSON: {cleaned_json_path}")
    print(f"Loading raw JSON: {raw_json_path}")
    
    if not os.path.exists(cleaned_json_path) or not os.path.exists(raw_json_path):
        print("Required files do not exist.")
        return
        
    with open(cleaned_json_path, 'r', encoding='utf-8') as f:
        cleaned_data = json.load(f)
        
    with open(raw_json_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    bbox = cleaned_data['boundingBox']
    min_x, min_y, max_x, max_y = bbox['minX'], bbox['minY'], bbox['maxX'], bbox['maxY']
    width_m, height_m = bbox['widthM'], bbox['heightM']
    
    walls = cleaned_data['walls']
    rooms = cleaned_data['rooms']
    
    print(f"Building Bounding Box: [{min_x}, {min_y}] to [{max_x}, {max_y}] (Size: {width_m:.2f}m x {height_m:.2f}m)")
    print(f"Total Walls: {len(walls)}")
    print(f"Total Cleaned Rooms: {len(rooms)}")
    
    valid_polygons_count = 0
    missing_geometry_count = 0
    duplicate_names = []
    seen_names = set()
    
    # 1. Check duplicate room names/codes
    for r in rooms:
        name = r['name']
        if name in seen_names:
            duplicate_names.append(name)
        seen_names.add(name)

    # 2. Check each room
    rooms_report = []
    for r in rooms:
        name = r['name']
        rx = r['x']
        ry = r['y']
        w_mm = r.get('widthMm')
        h_mm = r.get('heightMm')
        
        # Valid centroid check
        centroid_valid = (min_x <= rx <= max_x) and (min_y <= ry <= max_y)
        
        # Valid polygon check
        # Since these rooms are generated from labels, we construct their polygon representation
        # in meters from the width/height (or default to 4m x 4m if null)
        w_m = (w_mm / 1000.0) if w_mm else 4.0
        h_m = (h_mm / 1000.0) if h_mm else 4.0
        
        # Build 4 corners in meters around the centroid (rx, ry)
        # Note: coordinates in DXF are in units (usually mm).
        # Centroid rx, ry are in units (e.g. 234802.6).
        # We need to construct polygon in the same coordinate space!
        # If DXF is in mm, then rx and ry are in mm, so w_mm and h_mm are in the same units!
        # Let's check: rx, ry range is around 200,000 to 600,000, which matches mm (200m to 600m).
        # Yes, unit space is mm!
        w_units = w_mm if w_mm else 4000.0
        h_units = h_mm if h_mm else 4000.0
        
        poly = [
            [rx - w_units/2, ry - h_units/2],
            [rx + w_units/2, ry - h_units/2],
            [rx + w_units/2, ry + h_units/2],
            [rx - w_units/2, ry + h_units/2],
            [rx - w_units/2, ry - h_units/2]
        ]
        
        # Check if polygon lies inside building footprint
        poly_inside = True
        for px, py in poly:
            if not ((min_x <= px <= max_x) and (min_y <= py <= max_y)):
                poly_inside = False
                break
                
        # Check bounded by walls:
        # A room is bounded by walls if there are wall lines close to the room rectangle boundaries
        # Let's count how many walls are within 2.5 meters (2500 mm) of the centroid
        nearby_walls = 0
        for w in walls:
            pts = w['points']
            # Simple distance from centroid to wall segments
            for px, py in pts:
                dist = math.sqrt((px - rx)**2 + (py - ry)**2)
                if dist < 5000.0: # 5 meters
                    nearby_walls += 1
                    break
        
        # Check if there is an adjacent corridor (a walkable path nearby)
        # In our coordinate system, this is represented by not being completely surrounded by solid walls.
        # Since we have nearby walls, let's verify if there is space around it.
        has_corridor = nearby_walls > 0 # A simple metric: if it has nearby walls, it is part of the layout.
        
        is_geom_valid = centroid_valid and poly_inside
        if is_geom_valid:
            valid_polygons_count += 1
        else:
            missing_geometry_count += 1
            
        rooms_report.append({
            'name': name,
            'centroid': [rx, ry],
            'inside_footprint': centroid_valid and poly_inside,
            'bounded_by_walls': nearby_walls > 2,
            'nearby_walls_count': nearby_walls,
            'adjacent_corridor': has_corridor
        })

    # 3. Find orphan labels
    # An orphan label is any label in the raw json that looks like a room name (matches keywords)
    # but was discarded due to noise patterns or did not match the text layer.
    ROOM_KEYWORDS = {
        "cabin", "office", "room", "hall", "lobby", "reception", "toilet",
        "wc", "pantry", "store", "storage", "server", "board", "meet",
        "conf", "open", "work", "lounge", "passage", "corridor", "entry",
        "exit", "stair", "lift", "wash", "rest", "cafeteria", "dining",
        "library", "training", "discuss", "collab", "focus", "phone",
        "print", "copy", "manager", "director", "ceo", "finance", "admin",
        "security", "visitor", "waiting", "locker", "shower", "gym",
        "terrace", "balcony", "breakout", "odc", "repro", "thinking",
        "recreation", "sick", "battery", "hub", "novac", "kitchen",
        "compactor", "pot wash", "punching", "dry pantry", "it store",
        "team", "executive", "md cabin", "cfo", "m.d.", "c.f.o.", "glass cabin",
        "ups", "ahu", "nerd", "ciso", "large cabin"
    }
    
    NOISE_PATTERNS = [
        r"^\d",
        r"^[A-Z]{1,4}\d",
        r"^\d+\s*(mm|sqmm|kw|a,)",
        r"elevation",
        r"section",
        r"plan detail",
        r"flooring plan",
        r"rcp layout",
        r"ceiling plan",
        r"^\s*(spare|option|plan|section|legend|symbol|typical)\s*$",
        r"cable",
        r"conduit",
        r"busbar",
        r"panel",
        r"db\b",
        r"mcb|mccb|apfc",
        r"feeder",
        r"^loc[:\-]",
        r"electrical room",
        r"^ahu",
        r"^ups\b",
        r"^vav",
        r"xlpe|cu wire|pvc",
        r"drain|pump",
        r"outdoor",
        r"builder scope",
        r"^\d+\s*x\s*\d+",
        r"percent|sqmm|kva|kw\b",
        r"^(source|bank|spare|rack|seating|counter|drawer|ramp|shutter)$",
    ]
    
    raw_labels = raw_data.get('labels', [])
    clean_names_set = {r['name'].upper() for r in rooms}
    
    orphan_labels = []
    for label in raw_labels:
        txt = label.get('text', '').strip()
        # Clean mtext format
        txt_clean = re.sub(r'\\px[a-z][^;]*;', '', txt, flags=re.IGNORECASE)
        txt_clean = re.sub(r'\\f[^;]+;', '', txt_clean, flags=re.IGNORECASE)
        txt_clean = re.sub(r'\\[CHWQTOA]\d*[.x]*\d*;', '', txt_clean, flags=re.IGNORECASE)
        txt_clean = re.sub(r'\\P', ' ', txt_clean)
        txt_clean = re.sub(r'\\[a-zA-Z]', '', txt_clean)
        txt_clean = txt_clean.replace('{', '').replace('}', '')
        txt_clean = re.sub(r'\s+', ' ', txt_clean).strip()
        
        # Check if it looks like a room name
        txt_upper = txt_clean.upper()
        
        # Extract name without dimensions
        m = re.search(r'[P\s](\d{3,})\s*[Xx]\s*(\d{3,})\s*$', txt_clean)
        if m:
            base_name = txt_clean[:m.start()].strip()
        else:
            base_name = txt_clean
            
        base_upper = base_name.upper()
        
        if not base_name or len(base_name) < 3:
            continue
            
        # Matches room keywords
        is_room = any(kw in base_name.lower() for kw in ROOM_KEYWORDS)
        
        # Check if it matches noise
        is_noise = False
        for pattern in NOISE_PATTERNS:
            if re.search(pattern, base_name.lower()):
                is_noise = True
                break
                
        if is_room and not is_noise:
            # Check if this room exists in our clean rooms
            if base_upper not in clean_names_set:
                orphan_labels.append(txt_clean)

    # Remove duplicates from orphans
    orphan_labels = sorted(list(set(orphan_labels)))

    print("\n=== VALIDATION REPORT ===")
    print(f"Total cleaned rooms:       {len(rooms)}")
    print(f"Rooms with valid polygons: {valid_polygons_count}")
    print(f"Rooms with missing geometry: {missing_geometry_count}")
    print(f"Duplicate room names:      {len(duplicate_names)} ({duplicate_names})")
    print(f"Orphan labels found:       {len(orphan_labels)}")
    for ol in orphan_labels[:15]:
        print(f"  - {ol}")
    if len(orphan_labels) > 15:
        print(f"  ... and {len(orphan_labels) - 15} more")

if __name__ == "__main__":
    validate_rooms(
        "backend/src/data/Ganges_9th_Floor_Clean_Cleaned.json",
        "backend/src/data/Ganges_9th_Floor_Clean.json"
    )
