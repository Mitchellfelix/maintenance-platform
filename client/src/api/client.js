import axios from "axios";

const TOKEN_KEY = "mp_token";

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

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    // Clear any transient session token from the short-lived experiment.
    sessionStorage.removeItem(TOKEN_KEY);
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
