// src/pages/AdmissionAnalysisPage.js
// Reads StudyMEDIC Google Sheet and auto-generates task cards
// for upcoming courses within 45-day window

import React, { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, query,
  where, serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { addDays, differenceInDays, isWithinInterval, startOfDay, parseISO, isValid } from "date-fns";
import { format } from "date-fns";
import "./AdmissionAnalysisPage.css";

const SHEET_ID = "1EIhvxqQ-PdL6k2-3CJSSBQu1raQ10fc7ATKMnXhg2dc";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

const COMMUNICATION_TYPES = [
  { key: "mentor_based",   label: "Mentor-based",          icon: "🎓", desc: "Highlight mentor expertise and success stories" },
  { key: "course_structure", label: "Course Structure-based", icon: "📚", desc: "Showcase curriculum, modules, and learning path" },
  { key: "pain_point",     label: "Pain Point-based",       icon: "💡", desc: "Address student challenges and how course solves them" },
  { key: "feature_based",  label: "Feature-based",          icon: "⭐", desc: "Highlight unique features, tools and resources" },
];

function parseDate(val) {
  if (!val) return null;
  // Handle Google Sheets date serial or string
  if (typeof val === "string") {
    // Try DD/MM/YYYY or YYYY-MM-DD or MM/DD/YYYY
    const parts = val.split(/[\/\-]/);
    if (parts.length === 3) {
      // Try different formats
      const d1 = new Date(val);
      if (isValid(d1)) return d1;
      // DD/MM/YYYY
      const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (isValid(d2)) return d2;
    }
    const d = new Date(val);
    if (isValid(d)) return d;
  }
  return null;
}

function getAchievement(capped, current) {
  const cap = parseFloat(String(capped).replace(/,/g,""));
  const cur = parseFloat(String(current).replace(/,/g,""));
  if (!cap || cap === 0) return 0;
  return cur / cap;
}

function shouldSkip(course) {
  const achievement = getAchievement(course.financeCapped, course.currentEnrollments);
  const daysToClose = course.admissionClosing
    ? differenceInDays(course.admissionClosing, new Date())
    : 999;
  // Skip if ≥70% achieved AND more than 30 days to closing
  return achievement >= 0.7 && daysToClose > 30;
}

function getPriority(course) {
  const achievement = getAchievement(course.financeCapped, course.currentEnrollments);
  const daysToStart = differenceInDays(course.startingDate, new Date());
  if (achievement < 0.3 || daysToStart < 10) return "urgent";
  if (achievement < 0.5 || daysToStart < 20) return "high";
  if (achievement < 0.7) return "medium";
  return "low";
}

export default function AdmissionAnalysisPage() {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState([]);
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  // Load existing auto-generated tasks
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "tasks"), where("createdBy", "==", "admission_analysis")),
      (snap) => setGeneratedTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  async function fetchSheet() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      // Strip Google's JSONP wrapper
      const json = JSON.parse(text.replace(/^.*?({.*}).*?$/s, "$1"));
      const rows = json.table.rows;
      const cols = json.table.cols.map(c => c.label);

      const getCol = (row, name) => {
        const idx = cols.findIndex(c => c.toLowerCase().includes(name.toLowerCase()));
        if (idx === -1) return "";
        const cell = row.c[idx];
        return cell?.v ?? cell?.f ?? "";
      };

      const parsed = rows.map(row => ({
        status:             getCol(row, "Status"),
        stream:             getCol(row, "Stream"),
        course:             getCol(row, "Course"),
        examBatch:          getCol(row, "Exam Batch"),
        startingDate:       parseDate(String(getCol(row, "Starting date") || "")),
        admissionClosing:   parseDate(String(getCol(row, "Admission Closing") || "")),
        adsStartingDate:    parseDate(String(getCol(row, "Ads Starting Date") || "")),
        financeCapped:      getCol(row, "Finance Capped"),
        currentEnrollments: getCol(row, "Current Enrollments"),
      })).filter(r => r.course && r.startingDate);

      setCourses(parsed);

      // Apply filters
      const now = new Date();
      const window45 = addDays(now, 45);
      const filtered = parsed.filter(c => {
        if (!c.startingDate) return false;
        // Within 45-day window
        const inWindow = isWithinInterval(c.startingDate, { start: startOfDay(now), end: window45 });
        if (!inWindow) return false;
        // Skip if achievement ≥70% and more than 30 days to closing
        if (shouldSkip(c)) return false;
        return true;
      });

      setFilteredCourses(filtered);
      setLastSync(new Date());
    } catch (err) {
      setError("Failed to fetch sheet. Make sure it's publicly accessible.");
      console.error(err);
    }
    setLoading(false);
  }

  async function generateTasks() {
    if (!filteredCourses.length) return;
    setSyncing(true);
    setSyncLog([]);
    let created = 0;
    let skipped = 0;

    for (const course of filteredCourses) {
      for (const commType of COMMUNICATION_TYPES) {
        // Check if task already exists
        const existing = await getDocs(query(
          collection(db, "tasks"),
          where("admissionCourseKey", "==", `${course.course}_${course.examBatch}_${commType.key}`)
        ));

        if (!existing.empty) {
          skipped++;
          setSyncLog(prev => [...prev, `⏭ Skipped (already exists): ${course.course} — ${commType.label}`]);
          continue;
        }

        const priority = getPriority(course);
        const category = course.stream?.toLowerCase().includes("corporate") ? "corporate" : "retail";

        await addDoc(collection(db, "tasks"), {
          title: `${course.course} ${course.examBatch} — ${commType.label}`,
          description: `${commType.desc}\n\nStream: ${course.stream}\nExam Batch: ${course.examBatch}\nStarting: ${course.startingDate ? format(course.startingDate, "MMM d, yyyy") : "—"}\nAds Start: ${course.adsStartingDate ? format(course.adsStartingDate, "MMM d, yyyy") : "—"}`,
          category,
          creativeType: "flyer",
          priority,
          stage: "raised",
          source: "admission_analysis",
          communicationType: commType.key,
          communicationLabel: commType.label,
          admissionCourseKey: `${course.course}_${course.examBatch}_${commType.key}`,
          courseData: {
            course: course.course,
            examBatch: course.examBatch,
            stream: course.stream,
            startingDate: course.startingDate,
            admissionClosing: course.admissionClosing,
            adsStartingDate: course.adsStartingDate,
            achievement: Math.round(getAchievement(course.financeCapped, course.currentEnrollments) * 100),
          },
          createdBy: "admission_analysis",
          createdByName: "Admission Analysis",
          assignedTo: null,
          assignedBy: null,
          contentBody: "",
          attachments: [],
          comments: [],
          history: [{
            action: "auto_generated",
            by: "admission_analysis",
            byName: "Admission Analysis",
            stage: "raised",
            timestamp: new Date(),
            note: `Auto-generated from Google Sheet sync. Course: ${course.course} ${course.examBatch}`,
          }],
          dueDate: course.adsStartingDate || course.startingDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        created++;
        setSyncLog(prev => [...prev, `✅ Created: ${course.course} ${course.examBatch} — ${commType.label} (${priority} priority)`]);
      }
    }

    setSyncLog(prev => [...prev, `\n📊 Done! Created ${created} tasks, skipped ${skipped} duplicates.`]);
    setSyncing(false);
  }

  const achievePct = (c) => {
    const a = getAchievement(c.financeCapped, c.currentEnrollments);
    return Math.round(a * 100);
  };

  return (
    <div className="admission-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Admission Analysis</h1>
          <p className="page-subtitle">Auto-generates creative tasks from Google Sheet · 45-day window</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchSheet} disabled={loading}>
            {loading ? <span className="spinner" /> : "🔄 Fetch Sheet"}
          </button>
          {filteredCourses.length > 0 && (
            <button className="btn btn-primary" onClick={generateTasks} disabled={syncing}>
              {syncing ? <span className="spinner" /> : `⚡ Generate ${filteredCourses.length * 4} Tasks`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--red-50)", border: "1px solid #fecaca", color: "var(--red-700)", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {lastSync && (
        <div style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 16 }}>
          Last fetched: {format(lastSync, "MMM d, h:mm a")} · {courses.length} courses total · {filteredCourses.length} in 45-day window · {generatedTasks.length} tasks generated so far
        </div>
      )}

      {/* Communication types legend */}
      <div className="comm-types card">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-500)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
          4 Task Types Generated Per Course
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {COMMUNICATION_TYPES.map(t => (
            <div key={t.key} className="comm-type-card">
              <div className="comm-type-icon">{t.icon}</div>
              <div className="comm-type-label">{t.label}</div>
              <div className="comm-type-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Eligible courses */}
      {filteredCourses.length > 0 && (
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0d6e4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Eligible Courses — 45 Day Window</h3>
            <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{filteredCourses.length} courses → {filteredCourses.length * 4} tasks</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admission-table">
              <thead>
                <tr>
                  <th>Course</th><th>Batch</th><th>Stream</th><th>Starting Date</th>
                  <th>Ads Start</th><th>Achievement</th><th>Priority</th><th>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c, i) => {
                  const pct = achievePct(c);
                  const pri = getPriority(c);
                  const existingCount = generatedTasks.filter(t => t.courseData?.course === c.course && t.courseData?.examBatch === c.examBatch).length;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.course}</td>
                      <td>{c.examBatch}</td>
                      <td>{c.stream}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {c.startingDate ? format(c.startingDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {c.adsStartingDate ? format(c.adsStartingDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, background: "var(--gray-100)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 70 ? "var(--green-700)" : pct >= 40 ? "#f59e0b" : "var(--red-700)", height: "100%", borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: pct >= 70 ? "var(--green-700)" : pct >= 40 ? "#d97706" : "var(--red-700)", fontWeight: 600 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: pri==="urgent"?"#fce4ec":pri==="high"?"#fff3e0":pri==="medium"?"#fff8e1":"#e8f5e9",
                          color: pri==="urgent"?"#b71c1c":pri==="high"?"#e65100":pri==="medium"?"#f57f17":"#2e7d32"
                        }}>{pri}</span>
                      </td>
                      <td>
                        {existingCount > 0
                          ? <span style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 600 }}>✓ {existingCount}/4 generated</span>
                          : <span style={{ fontSize: 12, color: "var(--gray-400)" }}>Not generated</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skipped courses */}
      {courses.length > 0 && courses.filter(c => {
        const inWindow = c.startingDate && isWithinInterval(c.startingDate, { start: startOfDay(new Date()), end: addDays(new Date(), 45) });
        return inWindow && shouldSkip(c);
      }).length > 0 && (
        <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0d6e4" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-500)" }}>⏭ Skipped — Achievement ≥70% with 30+ days to closing</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admission-table">
              <thead><tr><th>Course</th><th>Batch</th><th>Achievement</th><th>Days to Closing</th><th>Reason</th></tr></thead>
              <tbody>
                {courses.filter(c => {
                  const inWindow = c.startingDate && isWithinInterval(c.startingDate, { start: startOfDay(new Date()), end: addDays(new Date(), 45) });
                  return inWindow && shouldSkip(c);
                }).map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.course}</td>
                    <td>{c.examBatch}</td>
                    <td style={{ color: "var(--green-700)", fontWeight: 600 }}>{achievePct(c)}%</td>
                    <td>{c.admissionClosing ? `${differenceInDays(c.admissionClosing, new Date())} days` : "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--gray-400)" }}>On track — no ads needed yet</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sync Log</h3>
          <div style={{ background: "var(--gray-50)", borderRadius: 8, padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 12, lineHeight: 2, maxHeight: 300, overflowY: "auto" }}>
            {syncLog.map((line, i) => <div key={i} style={{ color: line.startsWith("✅") ? "var(--green-700)" : line.startsWith("⏭") ? "var(--gray-400)" : "var(--gray-700)" }}>{line}</div>)}
          </div>
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">Click "Fetch Sheet" to load courses from Google Sheets</div>
        </div>
      )}
    </div>
  );
}
