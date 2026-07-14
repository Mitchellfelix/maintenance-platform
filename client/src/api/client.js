import axios from "axios";

const TOKEN_KEY = "mp_token";

// One-time cleanup: older builds kept the JWT in localStorage across launches.
try {
  localStorage.removeItem(TOKEN_KEY);
} catch {
  // ignore
}

export const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Session-only auth: closing the app/tab clears the token (no stay-signed-in). */
export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    // Drop any legacy persisted sessions from earlier builds.
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage quota / private-mode failures.
  }
}

export function getErrorMessage(error, fallback = "Something went wrong") {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}
