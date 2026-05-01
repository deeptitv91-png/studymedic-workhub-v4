// src/components/layout/Layout.js
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS, CAN_RAISE } from "../../utils/constants";
import "./Layout.css";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Layout({ children }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const canRaise = CAN_RAISE.includes(currentUser?.role);

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">SM</div>
          <div>
            <span className="brand-name">Work Hub</span>
            <span className="brand-sub">StudyMEDIC</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`} onClick={() => setSidebarOpen(false)}>
            <span className="nav-icon">⊞</span> My Dashboard
          </NavLink>
          {canRaise && (
            <NavLink to="/new-task" className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">＋</span> Raise Request
            </NavLink>
          )}
          <NavLink to="/my-tasks" className={({ isActive }) => `nav-item${isActive ? " nav-item--active" : ""}`} onClick={() => setSidebarOpen(false)}>
            <span className="nav-icon">◉</span> My Tasks
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="avatar">{getInitials(currentUser?.name)}</div>
            <div className="user-info">
              <div className="user-name truncate">{currentUser?.name}</div>
              <div className="user-role">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
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
            <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 11 }}>SM</div>
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
