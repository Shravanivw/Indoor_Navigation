// src/api/routes.js
export async function getRoute(fromId, toId) {
  return fetch(`${API_BASE}/route`, {
    method: 'POST',
    body: JSON.stringify({ fromRoomId: fromId, toRoomId: toId })
  }).then(r => r.json())
}