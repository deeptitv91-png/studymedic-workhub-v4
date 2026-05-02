// src/components/layout/AdminLayout.js
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./AdminLayout.css";

export default function AdminLayout({ children, isSuperAdmin }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`} style={{ background: isSuperAdmin ? "#1a1a2e" : "#1a3a5c" }}>
        <div className="sidebar-brand">
          <div className="brand-mark" style={{ background: isSuperAdmin ? "#e94560" : "var(--accent)" }}>SM</div>
          <div>
            <span className="brand-name">Work Hub</span>
            <span className="brand-sub">{isSuperAdmin ? "Super Admin" : "Admin"}</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Admin Panel</div>
          {isSuperAdmin ? (
            <NavLink to="/superadmin" className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
              <span className="nav-icon">⊞</span> Dashboard
            </NavLink>
          ) : (
            <>
              <NavLink to="/admin" end className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
                <span className="nav-icon">👥</span> User Management
              </NavLink>
              <NavLink to="/admin/reports" className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
                <span className="nav-icon">◫</span> Reports
              </NavLink>
              <NavLink to="/admin/admission" className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`}>
                <span className="nav-icon">🎯</span> Admission Analysis
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="avatar" style={{ background: isSuperAdmin ? "#e94560" : "var(--brand-light)", color: isSuperAdmin ? "#fff" : "var(--brand2)" }}>
              {isSuperAdmin ? "SA" : "AD"}
            </div>
            <div className="user-info">
              <div className="user-name">{isSuperAdmin ? "Super Admin" : "Admin"}</div>
              <div className="user-role">{isSuperAdmin ? "Full access" : "User management"}</div>
            </div>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>⌄</span>
          </div>
          {menuOpen && (
            <div className="user-menu">
              <button className="user-menu-item user-menu-item--danger" onClick={() => { logout(); navigate("/"); }}>Sign out</button>
            </div>
          )}
        </div>
      </aside>
      <div className="main-wrap">
        <div className="mobile-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 11, background: isSuperAdmin ? "#e94560" : "var(--brand)" }}>SM</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--brand)" }}>Work Hub</span>
          </div>
          <div style={{ width: 36 }} />
        </div>
        <main className="main">
          <div className="main-inner fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
