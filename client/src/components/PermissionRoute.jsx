import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingState from "./LoadingState.jsx";

export default function PermissionRoute({ permission, children }) {
  const { isAuthenticated, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Checking session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!can(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
