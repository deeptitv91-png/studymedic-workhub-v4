// src/pages/AdminPage.js
import React, { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { ROLE_LABELS } from "../utils/constants";
import "./AdminPage.css";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const LEVEL_GROUPS = [
  { key: "level1", label: "Level 1 — Leads", roles: ["avp","assistant_manager","creative_head","performance_head"] },
  { key: "level2", label: "Level 2 — Leads", roles: ["content_lead","design_lead","video_lead"] },
  { key: "executive", label: "Executives", roles: ["designer","video_editor","content_writer","pm_executive"] },
];

export default function AdminPage() {
  const [members, setMembers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [search, setSearch] = useState("");
  const [newMember, setNewMember] = useState({ name: "", username: "", password: "", role: "pm_executive" });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "members"), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filtered = members.filter((m) =>
    !search ||
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.username?.toLowerCase().includes(search.toLowerCase()) ||
    ROLE_LABELS[m.role]?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!newMember.name.trim() || !newMember.username.trim() || !newMember.password.trim()) {
      return setError("Name, username and password are required.");
    }
    // Check username uniqueness
    const exists = members.find((m) => m.username === newMember.username.toLowerCase().trim());
    if (exists) return setError("Username already taken. Choose another.");

    setAdding(true);
    const level = ["avp","assistant_manager","creative_head","performance_head"].includes(newMember.role) ? "level1"
      : ["content_lead","design_lead","video_lead"].includes(newMember.role) ? "level2" : "executive";

    await addDoc(collection(db, "members"), {
      name: newMember.name.trim(),
      username: newMember.username.toLowerCase().trim(),
      password: newMember.password,
      role: newMember.role,
      level,
      active: true,
      createdAt: serverTimestamp(),
    });
    setAdding(false);
    setShowAdd(false);
    setNewMember({ name: "", username: "", password: "", role: "pm_executive" });
  }

  async function handleSaveEdit(id) {
    setSaving(true);
    const level = ["avp","assistant_manager","creative_head","performance_head"].includes(editData.role) ? "level1"
      : ["content_lead","design_lead","video_lead"].includes(editData.role) ? "level2" : "executive";
    await updateDoc(doc(db, "members", id), { ...editData, level });
    setSaving(false);
    setEditId(null);
  }

  async function handleToggle(m) {
    await updateDoc(doc(db, "members", m.id), { active: m.active === false ? true : false });
  }

  async function handleDelete(m) {
    if (!window.confirm(`Remove ${m.name} permanently? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "members", m.id));
  }

  const roleSelector = (value, onChange) => (
    <select className="input" style={{ fontSize: 12, padding: "5px 8px", width: "auto" }} value={value} onChange={onChange}>
      <optgroup label="Level 1 — Leads">
        <option value="avp">AVP</option>
        <option value="assistant_manager">Assistant Manager</option>
        <option value="creative_head">Creative Head</option>
        <option value="performance_head">Performance Head</option>
      </optgroup>
      <optgroup label="Level 2 — Leads">
        <option value="content_lead">Content Lead</option>
        <option value="design_lead">Design Lead</option>
        <option value="video_lead">Video Production Lead</option>
      </optgroup>
      <optgroup label="Executives">
        <option value="designer">Designer</option>
        <option value="video_editor">Video Editor / Motion Graphics</option>
        <option value="content_writer">Content Writer</option>
        <option value="pm_executive">PM Executive</option>
      </optgroup>
    </select>
  );

  return (
    <div className="admin-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{members.length} members · manage logins and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Member</button>
      </div>

      <input className="input" placeholder="Search by name, username or role..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360, marginBottom: 24 }} />

      {LEVEL_GROUPS.map((group) => {
        const groupMembers = filtered.filter((m) => group.roles.includes(m.role));
        if (!groupMembers.length) return null;
        return (
          <div key={group.key} className="card admin-section">
            <div className="admin-section-header">
              <h3 className="admin-section-title">{group.label}</h3>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{groupMembers.length} members</span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Username</th><th>Password</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {groupMembers.map((m) => (
                    <tr key={m.id} style={{ opacity: m.active === false ? 0.5 : 1 }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitials(m.name)}</div>
                          {editId === m.id
                            ? <input className="input" style={{ fontSize: 13, padding: "4px 8px", width: 140 }} value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                            : <span style={{ fontWeight: 500 }}>{m.name}</span>}
                        </div>
                      </td>
                      <td>
                        {editId === m.id
                          ? <input className="input" style={{ fontSize: 13, padding: "4px 8px", width: 120 }} value={editData.username || ""} onChange={(e) => setEditData({ ...editData, username: e.target.value })} />
                          : <code style={{ fontSize: 12, background: "var(--gray-100)", padding: "2px 7px", borderRadius: 4 }}>{m.username}</code>}
                      </td>
                      <td>
                        {editId === m.id
                          ? <input className="input" type="text" style={{ fontSize: 13, padding: "4px 8px", width: 120 }} value={editData.password || ""} onChange={(e) => setEditData({ ...editData, password: e.target.value })} />
                          : <code style={{ fontSize: 12, background: "var(--gray-100)", padding: "2px 7px", borderRadius: 4 }}>{"•".repeat(Math.min(m.password?.length || 6, 8))}</code>}
                      </td>
                      <td>
                        {editId === m.id
                          ? roleSelector(editData.role || m.role, (e) => setEditData({ ...editData, role: e.target.value }))
                          : <span className="badge" style={{ background: "var(--brand-light)", color: "var(--brand2)" }}>{ROLE_LABELS[m.role]}</span>}
                      </td>
                      <td>
                        <span className="badge" style={{ background: m.active === false ? "var(--gray-100)" : "var(--green-50)", color: m.active === false ? "var(--gray-500)" : "var(--green-700)" }}>
                          {m.active === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {editId === m.id ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(m.id)} disabled={saving}>{saving ? <span className="spinner" /> : "Save"}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                            </>
                          ) : (
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditId(m.id); setEditData({ name: m.name, username: m.username, password: m.password, role: m.role }); }}>Edit</button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(m)}>
                            {m.active === false ? "Activate" : "Deactivate"}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Add member modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Add New Member</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                {error && <div style={{ color: "var(--red-700)", background: "var(--red-50)", padding: "8px 12px", borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}
                <div className="form-group">
                  <label className="label">Full name *</label>
                  <input className="input" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} placeholder="e.g. Priya Nair" required autoFocus />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Username *</label>
                    <input className="input" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} placeholder="e.g. priya" required />
                    <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>Lowercase, no spaces</div>
                  </div>
                  <div className="form-group">
                    <label className="label">Password *</label>
                    <input className="input" type="text" value={newMember.password} onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} placeholder="e.g. priya123" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Role *</label>
                  {roleSelector(newMember.role, (e) => setNewMember({ ...newMember, role: e.target.value }))}
                </div>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#1d4ed8" }}>
                  The member will log in using their username and password. Share credentials securely.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? <span className="spinner" /> : "Add Member"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
