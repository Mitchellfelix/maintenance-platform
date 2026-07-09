import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import AssetDetailPage from "./pages/AssetDetailPage.jsx";
import AssetsPage from "./pages/AssetsPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SiteDetailPage from "./pages/SiteDetailPage.jsx";
import SitesPage from "./pages/SitesPage.jsx";
import WorkOrderDetailPage from "./pages/WorkOrderDetailPage.jsx";
import WorkOrdersPage from "./pages/WorkOrdersPage.jsx";
import PermissionRoute from "./components/PermissionRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UsersAdminPage from "./pages/UsersAdminPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import AccessRequestPage from "./pages/AccessRequestPage.jsx";
import AccessRequestsAdminPage from "./pages/AccessRequestsAdminPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import InventoryPartDetailPage from "./pages/InventoryPartDetailPage.jsx";
import SopsPage from "./pages/SopsPage.jsx";
import SopDetailPage from "./pages/SopDetailPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/sites/:id" element={<SiteDetailPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/workorders" element={<WorkOrdersPage />} />
            <Route path="/workorders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/:id" element={<InventoryPartDetailPage />} />
            <Route path="/sops" element={<SopsPage />} />
            <Route path="/sops/:id" element={<SopDetailPage />} />
            <Route
              path="/access/request"
              element={
                <ProtectedRoute>
                  <AccessRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PermissionRoute permission="users:read">
                  <UsersAdminPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <PermissionRoute permission="audit:read">
                  <AuditLogPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/access-requests"
              element={
                <PermissionRoute permission="access-requests:read">
                  <AccessRequestsAdminPage />
                </PermissionRoute>
              }
            />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
