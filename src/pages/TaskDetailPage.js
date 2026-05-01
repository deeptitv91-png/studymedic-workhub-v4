// src/pages/TaskDetailPage.js
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { STAGE_LABELS, STAGE_COLORS, PRIORITY_COLORS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ICONS, ROLE_LABELS } from "../utils/constants";
import { getActions, getNextStageOnApprove, getNextStageOnReject, getNextStageOnSubmit, getNextStageOnStart, getNextStageOnAllocate, getAssignableRoles } from "../utils/workflow";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import "./TaskDetailPage.css";

function getInitials(n) { if (!n) return "?"; return n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2); }

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [contentText, setContentText] = useState("");
  const [savingContent, setSavingContent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const membersMap = Object.fromEntries(members.map((m) => [m.id, m]));

  useEffect(() => {
    return onSnapshot(doc(db, "tasks", taskId), (snap) => {
      if (snap.exists()) {
        const d = { id: snap.id, ...snap.data() };
        setTask(d);
        setContentText(d.contentBody || "");
      }
      setLoading(false);
    });
  }, [taskId]);

  useEffect(() => {
    return onSnapshot(collection(db, "members"), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  async function patch(updates, historyEntry) {
    setBusy(true);
    await updateDoc(doc(db, "tasks", taskId), {
      ...updates,
      history: arrayUnion({ ...historyEntry, by: currentUser?.id, byName: currentUser?.name, timestamp: new Date() }),
      updatedAt: serverTimestamp(),
    });
    setBusy(false);
  }

  async function handleSaveContent() {
    setSavingContent(true);
    await updateDoc(doc(db, "tasks", taskId), { contentBody: contentText, updatedAt: serverTimestamp() });
    setSavingContent(false);
  }

  async function handleStart() {
    const next = getNextStageOnStart(task);
    if (!next) return;
    await patch({ stage: next }, { action: "started_work", stage: next, prevStage: task.stage });
  }

  async function handleSubmit() {
    const next = getNextStageOnSubmit(task);
    if (!next) return;
    // Save content before submitting
    if (contentText) await updateDoc(doc(db, "tasks", taskId), { contentBody: contentText });
    await patch({ stage: next }, { action: "submitted_for_review", stage: next, prevStage: task.stage });
  }

  async function handleApprove() {
    const next = getNextStageOnApprove(task);
    if (!next) return;
    // Clear assignedTo when moving to next stage so previous assignee stops seeing it
    const clearAssignee = ["content_review","design_review","video_review"].includes(task.stage);
    await patch(
      { stage: next, ...(clearAssignee ? { assignedTo: null, assignedBy: null } : {}) },
      { action: "approved", stage: next, prevStage: task.stage }
    );
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    const next = getNextStageOnReject(task);
    setBusy(true);
    await updateDoc(doc(db, "tasks", taskId), {
      stage: next,
      comments: arrayUnion({ id: uuidv4(), text: `🔁 Rework needed: ${rejectReason}`, by: currentUser?.id, byName: currentUser?.name, timestamp: new Date(), isRejection: true }),
      history: arrayUnion({ action: "rejected", reason: rejectReason, stage: next, prevStage: task.stage, by: currentUser?.id, byName: currentUser?.name, timestamp: new Date() }),
      updatedAt: serverTimestamp(),
    });
    setBusy(false);
    setShowReject(false);
    setRejectReason("");
  }

  async function handleAllocate() {
    if (!selectedAssignee) return;
    const next = getNextStageOnAllocate(task);
    await patch(
      { stage: next, assignedTo: selectedAssignee, assignedBy: currentUser?.id },
      { action: "allocated", assignedTo: selectedAssignee, assigneeName: membersMap[selectedAssignee]?.name, stage: next, prevStage: task.stage }
    );
    setShowAllocate(false);
    setSelectedAssignee("");
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    await updateDoc(doc(db, "tasks", taskId), {
      comments: arrayUnion({ id: uuidv4(), text: comment.trim(), by: currentUser?.id, byName: currentUser?.name, timestamp: new Date() }),
      updatedAt: serverTimestamp(),
    });
    setComment("");
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = ref(storage, `tasks/${taskId}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, "tasks", taskId), {
        attachments: arrayUnion({ id: uuidv4(), name: file.name, url, size: file.size, uploadedBy: currentUser?.id, uploadedByName: currentUser?.name, uploadedAt: new Date() }),
        updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
    setUploading(false);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!task) return <div style={{ padding: 40 }}>Task not found.</div>;

  const actions = getActions(task, currentUser);
  const assignableRoles = getAssignableRoles(task, currentUser);
  const assignableMembers = members.filter((m) => assignableRoles.includes(m.role));
  const creator = membersMap[task.createdBy];
  const assignee = membersMap[task.assignedTo];
  const sc = STAGE_COLORS[task.stage] || { bg: "#f0f2f5", text: "#444" };
  const pc = PRIORITY_COLORS[task.priority] || { bg: "#f0f2f5", text: "#444" };
  const isOverdue = task.dueDate && task.stage !== "delivered" && new Date(task.dueDate.toDate?.() || task.dueDate) < new Date();
  const isAssignee = task.assignedTo === currentUser?.id;
  const showContentEditor = isAssignee && ["content_in_progress","content_rework"].includes(task.stage);
  const showContentView = task.contentBody && ["content_review","design_allocated","design_in_progress","design_review","video_allocated","video_in_progress","video_review","final_review","final_rework","delivered"].includes(task.stage);

  return (
    <div className="task-detail fade-in">
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 18 }} onClick={() => navigate(-1)}>← Back</button>
      <div className="td-grid">
        <div>
          {/* Main card */}
          <div className="card td-main">
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="badge" style={{ background: sc.bg, color: sc.text }}>{STAGE_LABELS[task.stage]}</span>
              <span className="badge" style={{ background: pc.bg, color: pc.text }}>{task.priority} priority</span>
              <span className="badge" style={{ background: task.category === "retail" ? "#fff3e0" : "#e8f4fd", color: task.category === "retail" ? "#e65100" : "#0e6ba8" }}>{CATEGORY_LABELS[task.category]}</span>
              <span className="badge" style={{ background: "#f3e5f5", color: "#6a1b9a" }}>{CREATIVE_TYPE_ICONS[task.creativeType]} {CREATIVE_TYPE_LABELS[task.creativeType]}</span>
            </div>
            <h1 className="td-title">{task.title}</h1>
            {task.description && <p className="td-desc">{task.description}</p>}

            <div className="td-actions">
              <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Actions</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {actions.canAllocate && assignableMembers.length > 0 && (
                  <button className="btn btn-primary" onClick={() => setShowAllocate(true)} disabled={busy}>Allocate Task</button>
                )}
                {actions.canStart && (
                  <button className="btn btn-primary" onClick={handleStart} disabled={busy}>Start Working</button>
                )}
                {actions.canSubmit && (
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={busy}>Submit for Review</button>
                )}
                {actions.canApprove && (
                  <button className="btn btn-success" onClick={handleApprove} disabled={busy}>✓ Approve</button>
                )}
                {actions.canReject && (
                  <button className="btn btn-danger" onClick={() => setShowReject(true)} disabled={busy}>↩ Request Rework</button>
                )}
                {!actions.canAllocate && !actions.canStart && !actions.canSubmit && !actions.canApprove && !actions.canReject && (
                  <span style={{ fontSize: 12, color: "var(--gray-400)" }}>No actions available at this stage.</span>
                )}
              </div>
            </div>
          </div>

          {/* Content editor — only for assignee in content stage */}
          {showContentEditor && (
            <div className="card td-section">
              <div className="td-section-header">
                <h3 className="td-section-title">✍ Write Content</h3>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveContent} disabled={savingContent}>
                  {savingContent ? <span className="spinner" /> : "Save Draft"}
                </button>
              </div>
              <textarea
                className="input"
                rows={12}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Write your content here — headlines, body copy, captions, hashtags..."
                style={{ resize: "vertical", fontSize: 14, lineHeight: 1.8 }}
              />
              <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 6 }}>
                Save your draft, then click "Submit for Review" above when ready.
              </div>
            </div>
          )}

          {/* Content view — for approvers and next stage people */}
          {showContentView && task.contentBody && (
            <div className="card td-section">
              <h3 className="td-section-title" style={{ marginBottom: 12 }}>📝 Written Content</h3>
              <div style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)", borderRadius: 8, padding: "16px 18px", fontSize: 14, lineHeight: 1.8, color: "var(--gray-800)", whiteSpace: "pre-wrap" }}>
                {task.contentBody}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="card td-section">
            <div className="td-section-header">
              <h3 className="td-section-title">Attachments</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <span className="spinner" /> : "+ Upload"}
              </button>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
            </div>
            {!task.attachments?.length
              ? <div style={{ fontSize: 12, color: "var(--gray-400)" }}>No attachments yet</div>
              : task.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="td-attachment">
                  <span>📎</span><span style={{ flex: 1 }}>{a.name}</span>
                  <span style={{ fontSize: 11, color: "var(--gray-400)" }}>{a.uploadedByName}</span>
                </a>
              ))}
          </div>

          {/* Comments */}
          <div className="card td-section">
            <h3 className="td-section-title" style={{ marginBottom: 12 }}>Comments</h3>
            <div className="td-comments">
              {!task.comments?.length
                ? <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 8 }}>No comments yet</div>
                : [...task.comments].sort((a, b) => new Date(a.timestamp?.toDate?.() || a.timestamp) - new Date(b.timestamp?.toDate?.() || b.timestamp)).map((c) => (
                  <div key={c.id} className={`td-comment ${c.isRejection ? "td-comment--rework" : ""}`}>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitials(c.byName)}</div>
                    <div className="td-comment-body">
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.byName}</span>
                        <span style={{ fontSize: 11, color: "var(--gray-400)" }}>{c.timestamp && format(c.timestamp.toDate?.() || new Date(c.timestamp), "MMM d, h:mm a")}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray-700)", lineHeight: 1.6 }}>{c.text}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="td-comment-input">
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitials(currentUser?.name)}</div>
              <input className="input" placeholder="Add a comment..." value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment()} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={handleAddComment} disabled={!comment.trim()}>Send</button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          <div className="card td-section">
            <h3 className="td-section-title" style={{ marginBottom: 14 }}>Task Details</h3>
            {[
              ["Created by", creator?.name || "—"],
              ["Assigned to", assignee?.name || "—"],
              ["Role", assignee ? ROLE_LABELS[assignee.role] : "—"],
              ["Category", CATEGORY_LABELS[task.category]],
              ["Creative type", `${CREATIVE_TYPE_ICONS[task.creativeType]} ${CREATIVE_TYPE_LABELS[task.creativeType]}`],
              ["Due date", task.dueDate ? <span style={isOverdue ? { color: "var(--red-700)", fontWeight: 600 } : {}}>{format(task.dueDate.toDate?.() || new Date(task.dueDate), "MMM d, yyyy")}</span> : "—"],
              ["Created", task.createdAt ? format(task.createdAt.toDate?.() || new Date(task.createdAt), "MMM d, yyyy") : "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11, gap: 8 }}>
                <span style={{ color: "var(--gray-500)", fontSize: 13 }}>{l}</span>
                <span style={{ fontWeight: 500, fontSize: 13, color: "var(--gray-800)", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="card td-section">
            <h3 className="td-section-title" style={{ marginBottom: 12 }}>Activity Log</h3>
            {[...(task.history || [])].sort((a, b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp)).map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, background: "var(--gray-300)", borderRadius: "50%", marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--gray-700)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--gray-900)" }}>{h.byName}</strong> {formatAction(h)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 1 }}>
                    {h.timestamp && format(h.timestamp.toDate?.() || new Date(h.timestamp), "MMM d, h:mm a")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Allocate modal */}
      {showAllocate && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAllocate(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Allocate Task</h3><button className="btn btn-secondary btn-sm" onClick={() => setShowAllocate(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">Select team member</label>
                <select className="input" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)}>
                  <option value="">— Choose a person —</option>
                  {assignableMembers.map((m) => <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role]})</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAllocate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAllocate} disabled={!selectedAssignee || busy}>Allocate</button>
            </div>
          </div>
        </div>
      )}

      {/* Rework modal */}
      {showReject && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowReject(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Request Rework</h3><button className="btn btn-secondary btn-sm" onClick={() => setShowReject(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">What needs to be changed? *</label>
                <textarea className="input" rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Describe what needs to change..." autoFocus style={{ resize: "vertical" }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={!rejectReason.trim() || busy}>Send for Rework</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAction(h) {
  const map = { created: "created this task", allocated: `allocated to ${h.assigneeName || "someone"}`, started_work: "started working", submitted_for_review: "submitted for review", approved: `approved → ${STAGE_LABELS[h.stage] || h.stage}`, rejected: `requested rework (${h.reason || "see comments"})` };
  return map[h.action] || h.action;
}
