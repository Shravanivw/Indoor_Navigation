// src/api/routes.js

const API_BASE = "http://localhost:3001/api/v1";  // ✅ ADD THIS

export async function getRoute(fromId, toId) {
  return fetch(`${API_BASE}/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fromRoomId: fromId,
      toRoomId: toId
    })
  }).then(res => res.json());
}


// ✅ ADD SEARCH API (you NEED this for your UI)
export async function searchRooms(query) {
  return fetch(`${API_BASE}/rooms/search?q=${query}`)
    .then(res => res.json());
}
``