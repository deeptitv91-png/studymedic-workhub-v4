// src/pages/SuperAdminPage.js
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { ROLE_LABELS, STAGE_LABELS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS } from "../utils/constants";
import { format } from "date-fns";
import ReportsPage from "./ReportsPage";
import "./SuperAdminPage.css";

function getInitials(name) { if (!name) return "?"; return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2); }

export default function SuperAdminPage() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", username: "", password: "", role: "pm_executive" });
  const [adding, setAdding] = useState(false);
  const [editMId, setEditMId] = useState(null);
  const [editMData, setEditMData] = useState({});

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "members"), (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, "tasks"), orderBy("createdAt", "desc")), (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const membersMap = Object.fromEntries(members.map((m) => [m.id, m]));

  async function handleDeleteTask(t) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    await deleteDoc(doc(db, "tasks", t.id));
  }

  async function handleResetTask(t) {
    if (!window.confirm("Reset to Raised?")) return;
    await updateDoc(doc(db, "tasks", t.id), { stage: "raised", assignedTo: null, assignedBy: null });
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newMember.name.trim() || !newMember.username.trim() || !newMember.password.trim()) return;
    setAdding(true);
    const level = ["avp","assistant_manager","creative_head","performance_head"].includes(newMember.role) ? "level1"
      : ["content_lead","design_lead","video_lead"].includes(newMember.role) ? "level2" : "executive";
    await addDoc(collection(db, "members"), { ...newMember, username: newMember.username.toLowerCase(), level, active: true, createdAt: serverTimestamp() });
    setAdding(false);
    setShowAddMember(false);
    setNewMember({ name: "", username: "", password: "", role: "pm_executive" });
  }

  async function handleDeleteMember(m) {
    if (!window.confirm(`Remove ${m.name} permanently?`)) return;
    await deleteDoc(doc(db, "members", m.id));
  }

  async function handleSaveEdit(id) {
    const level = ["avp","assistant_manager","creative_head","performance_head"].includes(editMData.role) ? "level1"
      : ["content_lead","design_lead","video_lead"].includes(editMData.role) ? "level2" : "executive";
    await updateDoc(doc(db, "members", id), { ...editMData, level });
    setEditMId(null);
  }

  const filteredTasks = tasks.filter((t) => !search || t.title?.toLowerCase().includes(search.toLowerCase()));
  const filteredMembers = members.filter((m) => !search || m.name?.toLowerCase().includes(search.toLowerCase()));

  const roleOpts = (val, onChange) => (
    <select className="input" style={{ fontSize: 12, padding: "4px 8px", width: "auto" }} value={val} onChange={onChange}>
      {[["avp","AVP"],["assistant_manager","Asst. Manager"],["creative_head","Creative Head"],["performance_head","Performance Head"],["content_lead","Content Lead"],["design_lead","Design Lead"],["video_lead","Video Lead"],["designer","Designer"],["video_editor","Video Editor"],["content_writer","Content Writer"],["pm_executive","PM Executive"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="superadmin-page fade-in">
      <div className="sa-tabs">
        {[["overview","Overview"],["tasks","All Tasks"],["members","Members"],["reports","Reports"]].map(([k,l]) => (
          <button key={k} className={`sa-tab ${activeTab === k ? "sa-tab--active" : ""}`} onClick={() => { setActiveTab(k); setSearch(""); }}>
            {l} {k === "tasks" && <span className="sa-badge">{tasks.length}</span>}
            {k === "members" && <span className="sa-badge">{members.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          <div className="sa-kpis">
            {[["Total Tasks",tasks.length],["Delivered",tasks.filter(t=>t.stage==="delivered").length],["In Progress",tasks.filter(t=>!["delivered","raised"].includes(t.stage)).length],["Members",members.length],["Active Members",members.filter(m=>m.active!==false).length]].map(([l,v])=>(
              <div key={l} className="card sa-kpi"><div className="sa-kpi-val">{v}</div><div className="sa-kpi-lbl">{l}</div></div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Recent Tasks</h3>
              {tasks.slice(0,8).map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--gray-100)" }}>
                  <div style={{ fontSize: 13, color: "var(--gray-800)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{t.title}</div>
                  <span className="badge" style={{ background: "#f0f2f5", color: "#444", fontSize: 10 }}>{STAGE_LABELS[t.stage]}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Team</h3>
              {members.slice(0,10).map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--gray-100)" }}>
                  <div className="avatar" style={{ width: 26, height: 26, fontSize: 9 }}>{getInitials(m.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{ROLE_LABELS[m.role]}</div>
                  </div>
                  <span className="badge" style={{ background: m.active===false?"var(--gray-100)":"var(--green-50)", color: m.active===false?"var(--gray-500)":"var(--green-700)", fontSize: 10 }}>
                    {m.active===false?"Inactive":"Active"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div>
          <input className="input" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="sa-table">
              <thead><tr><th>Title</th><th>Category</th><th>Type</th><th>Stage</th><th>Assigned</th><th>Created by</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredTasks.length === 0 ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>No tasks</td></tr> :
                filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500, maxWidth: 220 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div></td>
                    <td><span className="badge" style={{ background: t.category==="retail"?"#fff3e0":"#e8f4fd", color: t.category==="retail"?"#e65100":"#0e6ba8" }}>{CATEGORY_LABELS[t.category]}</span></td>
                    <td style={{ fontSize: 12, color: "var(--gray-500)" }}>{CREATIVE_TYPE_LABELS[t.creativeType]}</td>
                    <td><span className="badge" style={{ background: "#f0f2f5", color: "#444", fontSize: 11 }}>{STAGE_LABELS[t.stage]}</span></td>
                    <td style={{ color: "var(--gray-500)", fontSize: 12 }}>{membersMap[t.assignedTo]?.name || "—"}</td>
                    <td style={{ color: "var(--gray-500)", fontSize: 12 }}>{membersMap[t.createdBy]?.name || "—"}</td>
                    <td style={{ color: "var(--gray-400)", fontSize: 11, fontFamily: "var(--mono)" }}>{t.createdAt && format(t.createdAt.toDate?.() || new Date(t.createdAt), "MMM d")}</td>
                    <td><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleResetTask(t)}>Reset</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input className="input" placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>+ Add Member</button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="sa-table">
              <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active===false?0.5:1 }}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td><code style={{ fontSize: 12, background: "var(--gray-100)", padding: "2px 7px", borderRadius: 4 }}>{m.username}</code></td>
                    <td>
                      {editMId===m.id
                        ? <input className="input" style={{ fontSize:12,padding:"4px 8px",width:120 }} value={editMData.password||""} onChange={(e)=>setEditMData({...editMData,password:e.target.value})} />
                        : <code style={{ fontSize:12,background:"var(--gray-100)",padding:"2px 7px",borderRadius:4 }}>{"•".repeat(Math.min(m.password?.length||6,8))}</code>}
                    </td>
                    <td>
                      {editMId===m.id
                        ? roleOpts(editMData.role||m.role,(e)=>setEditMData({...editMData,role:e.target.value}))
                        : <span className="badge" style={{ background:"var(--brand-light)",color:"var(--brand2)" }}>{ROLE_LABELS[m.role]}</span>}
                    </td>
                    <td><span className="badge" style={{ background:m.active===false?"var(--gray-100)":"var(--green-50)",color:m.active===false?"var(--gray-500)":"var(--green-700)" }}>{m.active===false?"Inactive":"Active"}</span></td>
                    <td><div style={{ display:"flex",gap:6 }}>
                      {editMId===m.id ? (
                        <><button className="btn btn-primary btn-sm" onClick={()=>handleSaveEdit(m.id)}>Save</button><button className="btn btn-secondary btn-sm" onClick={()=>setEditMId(null)}>Cancel</button></>
                      ) : <button className="btn btn-secondary btn-sm" onClick={()=>{setEditMId(m.id);setEditMData({name:m.name,username:m.username,password:m.password,role:m.role})}}>Edit</button>}
                      <button className="btn btn-secondary btn-sm" onClick={()=>updateDoc(doc(db,"members",m.id),{active:m.active===false?true:false})}>
                        {m.active===false?"Activate":"Deactivate"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDeleteMember(m)}>Remove</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "reports" && <ReportsPage />}

      {showAddMember && (
        <div className="modal-backdrop" onClick={(e)=>e.target===e.currentTarget&&setShowAddMember(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Add Member</h3><button className="btn btn-secondary btn-sm" onClick={()=>setShowAddMember(false)}>✕</button></div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="form-group"><label className="label">Full name *</label><input className="input" value={newMember.name} onChange={(e)=>setNewMember({...newMember,name:e.target.value})} placeholder="e.g. Priya Nair" required autoFocus /></div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                  <div className="form-group"><label className="label">Username *</label><input className="input" value={newMember.username} onChange={(e)=>setNewMember({...newMember,username:e.target.value})} placeholder="priya" required /></div>
                  <div className="form-group"><label className="label">Password *</label><input className="input" type="text" value={newMember.password} onChange={(e)=>setNewMember({...newMember,password:e.target.value})} placeholder="priya123" required /></div>
                </div>
                <div className="form-group"><label className="label">Role *</label>{roleOpts(newMember.role,(e)=>setNewMember({...newMember,role:e.target.value}))}</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAddMember(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>{adding?<span className="spinner"/>:"Add Member"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
