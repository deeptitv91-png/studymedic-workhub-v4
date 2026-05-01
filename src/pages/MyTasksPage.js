// src/pages/MyTasksPage.js
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { STAGE_LABELS, STAGE_COLORS, PRIORITY_COLORS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ICONS, ROLE_LABELS } from "../utils/constants";
import { getVisibleTasks } from "../utils/workflow";
import { format, isPast } from "date-fns";
import "./MyTasksPage.css";

export default function MyTasksPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAllTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const myTasks = getVisibleTasks(allTasks, currentUser);
  const active  = myTasks.filter((t) => t.stage !== "delivered");
  const done    = myTasks.filter((t) => t.stage === "delivered");
  const overdue = active.filter((t) => t.dueDate && isPast(t.dueDate.toDate?.() || new Date(t.dueDate)));
  const created = myTasks.filter((t) => t.createdBy === currentUser?.id);

  const tabs = [
    { key: "all",     label: "All",           tasks: myTasks },
    { key: "active",  label: "Active",         tasks: active },
    { key: "overdue", label: "Overdue",         tasks: overdue },
    { key: "created", label: "Raised by me",    tasks: created },
    { key: "done",    label: "Delivered",        tasks: done },
  ];

  const display = (tabs.find((t) => t.key === activeTab)?.tasks || [])
    .filter((t) => !search || t.title?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div className="my-tasks fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-subtitle">{currentUser?.name} · {ROLE_LABELS[currentUser?.role]}</p>
        </div>
      </div>

      <div className="mt-stats">
        {[["Active", active.length, "#fff"], ["Overdue", overdue.length, "#fff0f0"], ["Raised by me", created.length, "#fff"], ["Delivered", done.length, "#f0fdf4"]].map(([l, v, bg]) => (
          <div key={l} className="card mt-stat" style={{ background: bg }}>
            <div className="mt-stat-val">{v}</div>
            <div className="mt-stat-lbl">{l}</div>
          </div>
        ))}
      </div>

      <input className="input" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />

      <div className="mt-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={`mt-tab ${activeTab === tab.key ? "mt-tab--active" : ""}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label} <span className="mt-tab-count">{tab.tasks.length}</span>
          </button>
        ))}
      </div>

      {display.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">✓</div><div className="empty-state-text">Nothing here</div></div>
      ) : (
        <div className="mt-list">
          {display.map((task) => {
            const sc = STAGE_COLORS[task.stage] || { bg: "#f0f2f5", text: "#444" };
            const pc = PRIORITY_COLORS[task.priority] || { bg: "#f0f2f5", text: "#444" };
            const isOverdue = task.dueDate && task.stage !== "delivered" && isPast(task.dueDate.toDate?.() || new Date(task.dueDate));
            return (
              <div key={task.id} className={`mt-task card ${isOverdue ? "mt-task--overdue" : ""}`} onClick={() => navigate(`/tasks/${task.id}`)}>
                <div className="mt-task-left">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
                    <span className="badge" style={{ background: sc.bg, color: sc.text }}>{STAGE_LABELS[task.stage]}</span>
                    <span className="badge" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
                    <span className="badge" style={{ background: task.category === "retail" ? "#fff3e0" : "#e8f4fd", color: task.category === "retail" ? "#e65100" : "#0e6ba8" }}>{CATEGORY_LABELS[task.category]}</span>
                    <span className="badge" style={{ background: "#f3e5f5", color: "#6a1b9a" }}>{CREATIVE_TYPE_ICONS[task.creativeType]} {CREATIVE_TYPE_LABELS[task.creativeType]}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-900)" }}>{task.title}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  {task.dueDate && <div style={{ fontSize: 12, color: isOverdue ? "var(--red-700)" : "var(--gray-500)", fontWeight: isOverdue ? 600 : 400, fontFamily: "var(--mono)" }}>{format(task.dueDate.toDate?.() || new Date(task.dueDate), "MMM d")}</div>}
                  <span style={{ fontSize: 16, color: "var(--gray-300)" }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
