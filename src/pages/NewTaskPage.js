// src/pages/NewTaskPage.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { PRIORITIES, STAGES } from "../utils/constants";
import "./NewTaskPage.css";

export default function NewTaskPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", category: "retail",
    creativeType: "flyer", priority: PRIORITIES.MEDIUM, dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    setLoading(true); setError("");
    try {
      const ref = await addDoc(collection(db, "tasks"), {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        creativeType: form.creativeType,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        stage: STAGES.RAISED,
        createdBy: currentUser.id,
        assignedTo: null,
        assignedBy: null,
        contentBody: "",
        attachments: [],
        comments: [],
        history: [{
          action: "created",
          by: currentUser.id,
          byName: currentUser.name,
          stage: STAGES.RAISED,
          timestamp: new Date(),
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate(`/tasks/${ref.id}`);
    } catch (err) {
      setError("Failed to create task. Please try again.");
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="new-task-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Raise Work Request</h1>
          <p className="page-subtitle">Create a new creative task — it will be routed to the Creative Head</p>
        </div>
      </div>

      <div className="card new-task-form-card">
        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: "var(--red-700)", background: "var(--red-50)", padding: "10px 14px", borderRadius: 7, marginBottom: 16, fontSize: 13 }}>{error}</div>}

          <div className="form-group">
            <label className="label">Task title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Retail Ramadan campaign flyer" required autoFocus />
          </div>

          <div className="form-group">
            <label className="label">Brief / Description</label>
            <textarea className="input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the requirement, references, brand guidelines, target audience..." style={{ resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="retail">🏪 Retail</option>
                <option value="corporate">🏢 Corporate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Creative type *</label>
              <select className="input" value={form.creativeType} onChange={(e) => setForm({ ...form, creativeType: e.target.value })}>
                <option value="flyer">🖼️ Flyer</option>
                <option value="motion_graphics">🎬 Motion Graphics</option>
                <option value="real_video">🎥 Real Video</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Due date</label>
              <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          <div style={{ background: "#fffbea", border: "1px solid #fef08a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#713f12", marginBottom: 20 }}>
            <strong>Auto-routing:</strong> Once submitted, this task will appear in the Creative Head's queue. They will allocate to Content, and the workflow will auto-route based on creative type after each approval.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : "Submit Request"}
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate("/")}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
