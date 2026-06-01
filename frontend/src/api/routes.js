// src/api/routes.js

// API_BASE is read from VITE_API_BASE at build/dev time so we can swap
// between localhost and a Cloudflare-tunnel URL without editing source.
// Set it in frontend/.env (or .env.local) e.g.
//   VITE_API_BASE=https://api-xyz.trycloudflare.com/api/v1
const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api/v1";

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