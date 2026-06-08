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
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
