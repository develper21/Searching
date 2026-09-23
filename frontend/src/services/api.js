import axios from "axios";

/**
 * Backend base URL — deployment ke liye env-driven:
 *  - dev       : frontend/.env.local        -> VITE_API_URL=http://localhost:5000
 *  - production: frontend/.env.production   -> VITE_API_URL=https://<backend>.onrender.com
 *    (Vite production build ke time ye value JS mein inline kar deta hai)
 */
const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn("[api] VITE_API_URL set nahi hai — fallback: http://localhost:5000");
}

// ---------- tasks CRUD ----------
export const getTasks = () => axios.get(`${API}/tasks`);
export const addTask = (task) => axios.post(`${API}/tasks`, task);
export const updateTask = (id, task) => axios.put(`${API}/tasks/${id}`, task);
export const deleteTask = (id) => axios.delete(`${API}/tasks/${id}`);

// ---------- search engine ----------
// Google-style: ranked results with a server-side search pipeline.
export const searchTasks = (q, status = "") =>
  axios.get(`${API}/api/search`, { params: { q, status } });

// Autocomplete suggestions for the dropdown while typing.
export const getSuggestions = (q) =>
  axios.get(`${API}/api/suggest`, { params: { q } });

// Tell the backend the user picked a result (feeds trending).
export const recordSearchClick = (q) =>
  axios.post(`${API}/api/search/click`, { q });

export const getTrending = () => axios.get(`${API}/api/trending`);
export const getRecents = () => axios.get(`${API}/api/recents`);
export const clearRecents = () => axios.post(`${API}/api/recents/clear`);
