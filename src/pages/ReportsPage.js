// src/pages/ReportsPage.js
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { STAGE_LABELS, ROLE_LABELS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS } from "../utils/constants";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import "./ReportsPage.css";

const PIE_COLORS = ["#0e6ba8","#00c2cb","#f59e0b","#10b981","#ef4444","#8b5cf6"];

function getRange(period, custom) {
  const now = new Date();
  if (period === "daily") return { start: startOfDay(now), end: endOfDay(now), label: format(now, "MMMM d, yyyy") };
  if (period === "weekly") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: `Week of ${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")}` };
  if (period === "monthly") return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy") };
  if (period === "custom" && custom.start && custom.end) return { start: startOfDay(new Date(custom.start)), end: endOfDay(new Date(custom.end)), label: `${custom.start} to ${custom.end}` };
  return { start: startOfDay(now), end: endOfDay(now), label: format(now, "MMMM d, yyyy") };
}

export default function ReportsPage() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "tasks"), (s) => { setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const unsub2 = onSnapshot(collection(db, "members"), (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, []);

  const membersMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const range = getRange(period, custom);

  const inRange = (task) => {
    const d = task.createdAt?.toDate?.() || (task.createdAt ? new Date(task.createdAt) : null);
    if (!d) return false;
    return isWithinInterval(d, { start: range.start, end: range.end });
  };

  const rangedTasks = tasks.filter(inRange);
  const allDelivered = tasks.filter((t) => t.stage === "delivered");
  const rangedDelivered = rangedTasks.filter((t) => t.stage === "delivered");
  const rangedPending = rangedTasks.filter((t) => t.stage !== "delivered");
  const overdue = rangedTasks.filter((t) => t.dueDate && t.stage !== "delivered" && new Date(t.dueDate.toDate?.() || t.dueDate) < new Date());

  // Per member performance
  const memberStats = members.map((m) => {
    const assigned = rangedTasks.filter((t) => t.assignedTo === m.id);
    const delivered = assigned.filter((t) => t.stage === "delivered");
    const created = rangedTasks.filter((t) => t.createdBy === m.id);
    return { ...m, assigned: assigned.length, delivered: delivered.length, created: created.length };
  }).filter((m) => m.assigned > 0 || m.created > 0).sort((a, b) => b.delivered - a.delivered);

  // Stage distribution
  const stageCounts = {};
  rangedTasks.forEach((t) => { stageCounts[t.stage] = (stageCounts[t.stage] || 0) + 1; });
  const stageData = Object.entries(stageCounts).map(([stage, count]) => ({ name: STAGE_LABELS[stage] || stage, value: count }));

  // Category distribution
  const catCounts = {};
  rangedTasks.forEach((t) => { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });
  const catData = Object.entries(catCounts).map(([cat, count]) => ({ name: CATEGORY_LABELS[cat] || cat, value: count }));

  // Creative type distribution
  const typeCounts = {};
  rangedTasks.forEach((t) => { typeCounts[t.creativeType] = (typeCounts[t.creativeType] || 0) + 1; });
  const typeData = Object.entries(typeCounts).map(([type, count]) => ({ name: CREATIVE_TYPE_LABELS[type] || type, value: count }));

  // Member bar chart
  const memberBarData = memberStats.slice(0, 10).map((m) => ({ name: m.name?.split(" ")[0], assigned: m.assigned, delivered: m.delivered }));

  async function handleExportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("StudyMEDIC Work Hub — Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${range.label}`, 14, 32);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 39);

    doc.setFontSize(14);
    doc.text("Summary", 14, 52);
    autoTable(doc, {
      startY: 56,
      head: [["Metric", "Value"]],
      body: [
        ["Total tasks (in period)", rangedTasks.length],
        ["Delivered", rangedDelivered.length],
        ["Pending", rangedPending.length],
        ["Overdue", overdue.length],
        ["Total delivered (all time)", allDelivered.length],
      ],
      theme: "striped",
    });

    doc.setFontSize(14);
    doc.text("Member Performance", 14, doc.lastAutoTable.finalY + 14);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [["Name", "Role", "Assigned", "Delivered", "Raised"]],
      body: memberStats.map((m) => [m.name, ROLE_LABELS[m.role] || m.role, m.assigned, m.delivered, m.created]),
      theme: "striped",
    });

    doc.setFontSize(14);
    doc.text("All Tasks", 14, doc.lastAutoTable.finalY + 14);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [["Title", "Category", "Type", "Stage", "Assigned To", "Created By"]],
      body: rangedTasks.map((t) => [
        t.title?.slice(0, 40),
        CATEGORY_LABELS[t.category] || t.category,
        CREATIVE_TYPE_LABELS[t.creativeType] || t.creativeType,
        STAGE_LABELS[t.stage] || t.stage,
        membersMap[t.assignedTo]?.name || "—",
        membersMap[t.createdBy]?.name || "—",
      ]),
      theme: "striped",
    });

    doc.save(`studymedic-workhub-report-${range.label.replace(/[^a-z0-9]/gi, "-")}.pdf`);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div className="reports-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">{range.label}</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportPDF}>⬇ Export PDF</button>
      </div>

      {/* Period selector */}
      <div className="report-period card">
        {["daily","weekly","monthly","custom"].map((p) => (
          <button key={p} className={`period-btn ${period === p ? "period-btn--active" : ""}`} onClick={() => setPeriod(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        {period === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 16 }}>
            <input className="input" type="date" style={{ width: 150 }} value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
            <span style={{ color: "var(--gray-400)" }}>to</span>
            <input className="input" type="date" style={{ width: 150 }} value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="report-kpis">
        {[
          { label: "Total Tasks", value: rangedTasks.length, bg: "#fff" },
          { label: "Delivered", value: rangedDelivered.length, bg: "#f0fdf4" },
          { label: "Pending", value: rangedPending.length, bg: "#f0f0ff" },
          { label: "Overdue", value: overdue.length, bg: overdue.length > 0 ? "#fff0f0" : "#fff" },
          { label: "All-time Delivered", value: allDelivered.length, bg: "#fff" },
        ].map((k) => (
          <div key={k.label} className="card kpi-card" style={{ background: k.bg }}>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="report-charts">
        {/* Member performance bar */}
        {memberBarData.length > 0 && (
          <div className="card chart-card chart-wide">
            <h3 className="chart-title">Member Performance</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={memberBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" fill="#0e6ba8" name="Assigned" radius={[3,3,0,0]} />
                <Bar dataKey="delivered" fill="#00c2cb" name="Delivered" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stage distribution */}
        {stageData.length > 0 && (
          <div className="card chart-card">
            <h3 className="chart-title">By Stage</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}`}>
                  {stageData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category distribution */}
        {catData.length > 0 && (
          <div className="card chart-card">
            <h3 className="chart-title">Retail vs Corporate</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {catData.map((_, i) => <Cell key={i} fill={i === 0 ? "#f59e0b" : "#0e6ba8"} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Member table */}
      {memberStats.length > 0 && (
        <div className="card" style={{ overflow: "hidden", marginTop: 20 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gray-100)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Member Performance Details</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Assigned</th><th>Delivered</th><th>Raised</th><th>Completion %</th></tr>
              </thead>
              <tbody>
                {memberStats.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td><span className="badge" style={{ background: "var(--brand-light)", color: "var(--brand2)" }}>{ROLE_LABELS[m.role]}</span></td>
                    <td>{m.assigned}</td>
                    <td>{m.delivered}</td>
                    <td>{m.created}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, background: "var(--gray-100)", borderRadius: 4, height: 7, overflow: "hidden" }}>
                          <div style={{ width: `${m.assigned ? Math.round(m.delivered / m.assigned * 100) : 0}%`, background: "var(--brand2)", height: "100%", borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--gray-500)", width: 35 }}>
                          {m.assigned ? Math.round(m.delivered / m.assigned * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
