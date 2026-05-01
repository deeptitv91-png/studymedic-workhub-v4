// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import AdminLayout from "./components/layout/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NewTaskPage from "./pages/NewTaskPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import MyTasksPage from "./pages/MyTasksPage";
import AdminPage from "./pages/AdminPage";
import ReportsPage from "./pages/ReportsPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import "./styles/global.css";

function AppRoutes() {
  const { currentUser } = useAuth();

  if (!currentUser) return <LoginPage />;

  // Super Admin
  if (currentUser.isSuperAdmin) {
    return (
      <AdminLayout isSuperAdmin={true}>
        <Routes>
          <Route path="/superadmin" element={<SuperAdminPage />} />
          <Route path="*" element={<Navigate to="/superadmin" />} />
        </Routes>
      </AdminLayout>
    );
  }

  // Admin
  if (currentUser.isAdmin) {
    return (
      <AdminLayout isSuperAdmin={false}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </AdminLayout>
    );
  }

  // Regular member
  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<DashboardPage />} />
        <Route path="/new-task"      element={<NewTaskPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/my-tasks"      element={<MyTasksPage />} />
        <Route path="*"              element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
