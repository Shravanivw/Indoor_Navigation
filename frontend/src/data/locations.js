export const locations = [
  { id: 1, name: "Conference Room A", type: "Meeting room", seats: 8, status: "Booked", floor: 5, color: "#5F5E5A" },
  { id: 2, name: "Conference Room B", type: "Meeting room", seats: 12, status: "Available", floor: 5, color: "#185FA5" },
  { id: 3, name: "Cafeteria", type: "Food", detail: "Open 8am–6pm", floor: 5, color: "#854F0B" },
  { id: 4, name: "IT Help Desk", type: "Support", detail: "Walk-in", floor: 5, color: "#534AB7" },
  { id: 5, name: "Restrooms (East)", type: "Amenity", detail: "Nearest · 40 m", floor: 5, color: "#5F5E5A" },
  { id: 6, name: "Emergency Exit A", type: "Exit", detail: "Stairwell · G to F4", floor: 5, color: "#A32D2D" },
  { id: 7, name: "Reception", type: "Visitor", detail: "Sign-in · Lobby", floor: 5, color: "#534AB7" },
  { id: 8, name: "Open Workspace", type: "Desk", detail: "24 hot desks", floor: 5, color: "#5F5E5A" },
  { id: 9, name: "Lift 2", type: "Lift", detail: "Ground to F4", floor: 5, color: "#185FA5" },
  { id: 10, name: "Storage Room", type: "Storage", detail: "Staff only", floor: 5, color: "#5F5E5A" },
  { id: 11, name: "Game Zone", type: "Amenity", detail: "Green Zone", floor: 5, color: "#5F5E5A" },

];

export const recentLocations = [
  { id: 2, name: "Conference Room B", sub: "Floor 5 · Used yesterday" },
  { id: 4, name: "IT Help Desk", sub: "Floor 5 · 2 days ago" },
  { id: 3, name: "Cafeteria", sub: "Floor 5 · 3 days ago" },
];

export const quickFind = [
  { label: "Meeting rooms", type: "Meeting room", color: "#E6F1FB", iconColor: "#185FA5", icon: "grid" },
  { label: "Cafeteria", type: "Food", color: "#EAF3DE", iconColor: "#3B6D11", icon: "coffee" },
  { label: "Restrooms", type: "Amenity", color: "#F1EFE8", iconColor: "#5F5E5A", icon: "home" },
  { label: "Emergency exit", type: "Exit", color: "#FCEBEB", iconColor: "#A32D2D", icon: "alert" },
];

export const routeSteps = [
  { step: 1, text: "Exit Lift A, turn left into corridor", dist: "~15 m" },
  { step: 2, text: "Follow corridor west, past open office", dist: "~60 m" },
  { step: 3, text: "Conference Room B on your right", dist: "Arrived" },
];