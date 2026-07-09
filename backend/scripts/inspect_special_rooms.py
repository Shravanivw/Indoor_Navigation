import json
import os

def inspect_special_rooms():
    files = {
        "Floor 6": r"C:\Users\UGKLKGF\Documents\Projects\Indoor_Navigation\backend\src\data\Hudson_6th_Floor.json",
        "Floor 7": r"C:\Users\UGKLKGF\Documents\Projects\Indoor_Navigation\backend\src\data\Hudson_7th.json"
    }

    # Re-implement getRoomTemplateType signature in Python for verification
    def get_template(name, type_str):
        name_lower = name.lower()
        type_upper = type_str.upper()
        
        if "lift lobby" in name_lower:
            return "LIFT_LOBBY"
        if type_upper == "CORRIDOR" or any(k in name_lower for k in ["corridor", "passage", "walkway", "hallway", "lobby area"]):
            return "CORRIDOR"
        if type_upper == "EXIT" or any(k in name_lower for k in ["stair", "exit", "escalator"]):
            return "STAIRCASE"
        if "lift" in name_lower or "elevator" in name_lower:
            return "LIFT"
        if any(k in name_lower for k in ["booth", "seating", "sitting", "sitting area"]):
            return "BOOTH"
        if type_upper == "RECEPTION" or any(k in name_lower for k in ["reception", "lobby", "entrance"]):
            return "RECEPTION"
        if type_upper == "PANTRY" or any(k in name_lower for k in ["cafeteria", "pantry", "food", "cafe", "dining"]):
            return "PANTRY"
        if type_upper == "TOILET" or any(k in name_lower for k in ["restroom", "toilet", "washroom", "shower"]):
            return "TOILET"
        if type_upper in ["SERVER_ROOM", "STORAGE"] or any(k in name_lower for k in ["server", "storage", "utility", "ahu", "ele", "bms", "janitor", "hub", "ups", "av room", "monitoring", "repair", "store", "battery"]):
            if "thinking" in name_lower:
                pass
            else:
                return "SERVER_ROOM"
        if type_upper in ["OPEN_WORKSPACE", "WORKSPACE"] or any(k in name_lower for k in ["workspace", "innovation", "hotdesk", "desk", "it bar", "support", "lab", "noc", "gui", "big data", "workstation"]):
            return "OPEN_WORKSPACE"
        if type_upper in ["MEETING_ROOM", "BOARDROOM"] or any(k in name_lower for k in ["meeting", "board", "cabin", "conference", "training", "pax", "nerd", "lean", "ciso", "office", "adaptive", "opensource"]):
            return "MEETING_ROOM"
        return "OTHER"

    for floor_name, path in files.items():
        print(f"\n=== Special Rooms in {floor_name} ===")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        rooms = data.get("rooms", [])
        for r in rooms:
            rid = r.get("id")
            rtype = r.get("type", "")
            tmpl = get_template(rid, rtype)
            # Filter to find lounges, collab areas, open spaces, or OTHER
            if tmpl == "OTHER" or any(k in rid.lower() for k in ["lounge", "collab", "discussion", "thinking", "hub", "pantry", "reception"]):
                print(f"  - Room '{rid}' (Type: '{rtype}') -> Template: {tmpl}")

if __name__ == "__main__":
    inspect_special_rooms()
