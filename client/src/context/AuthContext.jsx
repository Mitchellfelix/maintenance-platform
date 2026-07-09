import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getStoredToken, setStoredToken, getErrorMessage } from "../api/client.js";
import { getRoleLabel, hasPermission } from "../lib/permissions.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await api.get("/api/auth/me");
      setUser(response.data);
      return response.data;
    } catch {
      setStoredToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const response = await api.post("/api/auth/login", { email, password });
    setStoredToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const response = await api.post("/api/auth/register", payload);
    if (response.data.pendingApproval) {
      return response.data;
    }
    setStoredToken(response.data.token);
    setUser(response.data.user);
    return response.data;
  }, []);

  const can = useCallback(
    (permission) => hasPermission(user?.role, permission),
    [user?.role],
  );

  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
      getErrorMessage,
      can,
      roleLabel,
    }),
    [user, loading, login, register, logout, refreshUser, can, roleLabel],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
