import json

INPUT_FILE = "floor_data_clean.json"
OUTPUT_FILE = "floor_data_normalized.json"

# Load data
with open(INPUT_FILE, "r") as f:
    data = json.load(f)

bbox = data["boundingBox"]

min_x = bbox["minX"]
min_y = bbox["minY"]

# Normalize walls
normalized_walls = []

for wall in data["walls"]:
    normalized_points = []

    for point in wall["points"]:
        x, y = point

        normalized_x = round(x - min_x, 2)
        normalized_y = round(y - min_y, 2)

        normalized_points.append([
            normalized_x,
            normalized_y
        ])

    normalized_walls.append({
        "layer": wall["layer"],
        "points": normalized_points
    })

# Create normalized bounding box
normalized_bbox = {
    "width": round(bbox["maxX"] - bbox["minX"], 2),
    "height": round(bbox["maxY"] - bbox["minY"], 2)
}

# Final output
normalized_data = {
    "boundingBox": normalized_bbox,
    "walls": normalized_walls
}

# Save output
with open(OUTPUT_FILE, "w") as f:
    json.dump(normalized_data, f, indent=2)

print(f"Normalized data saved to: {OUTPUT_FILE}")