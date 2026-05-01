// src/pages/DashboardPage.js
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { STAGE_LABELS, STAGE_COLORS, PRIORITY_COLORS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ICONS, ROLE_LABELS, LEVEL_1 } from "../utils/constants";
import { getVisibleTasks, getActions } from "../utils/workflow";
import { format, isPast } from "date-fns";
import "./DashboardPage.css";

function TaskCard({ task, members, onClick }) {
  const sc = STAGE_COLORS[task.stage] || { bg: "#f0f2f5", text: "#444" };
  const pc = PRIORITY_COLORS[task.priority] || { bg: "#f0f2f5", text: "#444" };
  const isOverdue = task.dueDate && task.stage !== "delivered" && isPast(task.dueDate.toDate?.() || new Date(task.dueDate));
  const membersMap = Object.fromEntries((members || []).map((m) => [m.id, m]));
  const assignee = membersMap[task.assignedTo];

  return (
    <div className={`task-card card ${isOverdue ? "task-card--overdue" : ""}`} onClick={() => onClick(task.id)}>
      <div className="task-card-badges">
        <span className="badge" style={{ background: sc.bg, color: sc.text }}>{STAGE_LABELS[task.stage]}</span>
        <span className="badge" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
      </div>
      <div className="task-card-title">{task.title}</div>
      <div className="task-card-meta">
        <span className="task-cat" style={{ background: task.category === "retail" ? "#fff3e0" : "#e8f4fd", color: task.category === "retail" ? "#e65100" : "#0e6ba8" }}>
          {CATEGORY_LABELS[task.category]}
        </span>
        <span className="task-type">{CREATIVE_TYPE_ICONS[task.creativeType]} {CREATIVE_TYPE_LABELS[task.creativeType]}</span>
      </div>
      <div className="task-card-footer">
        <span style={{ fontSize: 11, color: "var(--gray-400)" }}>
          {assignee ? `→ ${assignee.name}` : "Unassigned"}
        </span>
        {task.dueDate && (
          <span style={{ fontSize: 11, color: isOverdue ? "var(--red-700)" : "var(--gray-400)", fontFamily: "var(--mono)", fontWeight: isOverdue ? 600 : 400 }}>
            {format(task.dueDate.toDate?.() || new Date(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}

const STATUS_GROUPS = [
  { key: "action", label: "Needs Your Action", filter: (tasks, uid, role) => tasks.filter((t) => {
    if (t.stage === "raised" && LEVEL_1.includes(role)) return true;
    if (t.assignedTo === uid && ["content_allocated","design_allocated","video_allocated"].includes(t.stage)) return true;
    if (["content_review","design_review","video_review","final_review"].includes(t.stage)) {
      if (role === "content_lead" && t.stage === "content_review") return true;
      if (role === "design_lead" && t.stage === "design_review") return true;
      if (role === "video_lead" && t.stage === "video_review") return true;
      if (LEVEL_1.includes(role) && t.stage === "final_review") return true;
    }
    return false;
  })},
  { key: "inprogress", label: "In Progress", filter: (tasks, uid) => tasks.filter((t) => t.assignedTo === uid && ["content_in_progress","content_rework","design_in_progress","design_rework","video_in_progress","video_rework","final_rework"].includes(t.stage)) },
  { key: "raised", label: "Raised by Me", filter: (tasks, uid) => tasks.filter((t) => t.createdBy === uid && !["delivered"].includes(t.stage)) },
  { key: "delivered", label: "Delivered", filter: (tasks, uid) => tasks.filter((t) => (t.createdBy === uid) && t.stage === "delivered") },
];

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAllTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "members"), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const myTasks = getVisibleTasks(allTasks, currentUser);
  const uid = currentUser?.id;
  const role = currentUser?.role;

  const needsAction = STATUS_GROUPS[0].filter(myTasks, uid, role);
  const inProgress = STATUS_GROUPS[1].filter(myTasks, uid, role);
  const raised = STATUS_GROUPS[2].filter(myTasks, uid, role);
  const delivered = STATUS_GROUPS[3].filter(myTasks, uid, role);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Welcome, {currentUser?.name} · {ROLE_LABELS[currentUser?.role]}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        {[
          { label: "Needs Action", value: needsAction.length, bg: needsAction.length > 0 ? "#fffbea" : "#fff" },
          { label: "In Progress", value: inProgress.length, bg: "#f0f0ff" },
          { label: "Raised by Me", value: raised.length, bg: "#fff" },
          { label: "Delivered", value: delivered.length, bg: "#f0fdf4" },
        ].map((s) => (
          <div key={s.label} className="stat-card card" style={{ background: s.bg }}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Task groups */}
      {myTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✓</div>
          <div className="empty-state-text">No tasks assigned to you yet</div>
        </div>
      ) : (
        <div className="task-groups">
          {STATUS_GROUPS.map((group) => {
            const groupTasks = group.filter(myTasks, uid, role);
            if (!groupTasks.length) return null;
            return (
              <div key={group.key} className="task-group">
                <div className="task-group-header">
                  <h3 className="task-group-title">{group.label}</h3>
                  <span className="task-group-count">{groupTasks.length}</span>
                </div>
                <div className="task-group-cards">
                  {groupTasks.map((t) => (
                    <TaskCard key={t.id} task={t} members={members} onClick={(id) => navigate(`/tasks/${id}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
