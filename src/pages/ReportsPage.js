// src/pages/ReportsPage.js
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { STAGE_LABELS, ROLE_LABELS, CATEGORY_LABELS, CREATIVE_TYPE_LABELS } from "../utils/constants";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, differenceInHours } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import "./ReportsPage.css";

const PIE_COLORS = ["#f4a7b9","#7eb8d4","#f9c4d2","#a8d4f0","#e87fa0","#5b8fb9"];
const LEVEL1 = ["avp","assistant_manager","creative_head","performance_head"];
const LEVEL2 = ["content_lead","design_lead","video_lead"];
const EXECUTIVES = ["designer","video_editor","content_writer","pm_executive"];

function getRange(period, custom) {
  const now = new Date();
  if (period === "daily")   return { start: startOfDay(now), end: endOfDay(now), label: format(now, "MMMM d, yyyy") };
  if (period === "weekly")  return { start: startOfWeek(now,{weekStartsOn:1}), end: endOfWeek(now,{weekStartsOn:1}), label: `Week of ${format(startOfWeek(now,{weekStartsOn:1}),"MMM d")}` };
  if (period === "monthly") return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy") };
  if (period === "custom" && custom.start && custom.end) return { start: startOfDay(new Date(custom.start)), end: endOfDay(new Date(custom.end)), label: `${custom.start} to ${custom.end}` };
  return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy") };
}

function avgHours(arr) {
  if (!arr.length) return "—";
  const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
  if (avg < 1) return "<1h";
  if (avg < 24) return `${Math.round(avg)}h`;
  return `${Math.round(avg/24)}d`;
}

export default function ReportsPage() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [custom, setCustom] = useState({ start:"", end:"" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"tasks"), (s) => { setTasks(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    const u2 = onSnapshot(collection(db,"members"), (s) => setMembers(s.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, []);

  const membersMap = Object.fromEntries(members.map(m=>[m.id,m]));
  const range = getRange(period, custom);

  const inRange = (task) => {
    const d = task.createdAt?.toDate?.() || (task.createdAt ? new Date(task.createdAt) : null);
    if (!d) return false;
    return isWithinInterval(d, { start: range.start, end: range.end });
  };

  const rangedTasks = tasks.filter(inRange);
  const allDelivered = tasks.filter(t=>t.stage==="delivered");
  const rangedDelivered = rangedTasks.filter(t=>t.stage==="delivered");
  const rangedPending = rangedTasks.filter(t=>t.stage!=="delivered");
  const overdue = rangedTasks.filter(t=>t.dueDate&&t.stage!=="delivered"&&new Date(t.dueDate.toDate?..()||t.dueDate)<new Date());

  // ── Per member stats ────────────────────────────────────────────
  const memberStats = members.map(m => {
    const role = m.role;
    const uid = m.id;

    if (LEVEL1.includes(role)) {
      // Level 1: supervision metrics
      const allocations = rangedTasks.filter(t => t.history?.some(h=>h.by===uid&&h.action==="allocated")).length;
      const approvals   = rangedTasks.filter(t => t.history?.some(h=>h.by===uid&&h.action==="approved")).length;
      const supervised  = allocations + approvals;

      // Timely allocations: allocated within 24hrs of creation
      const allocTimes = rangedTasks
        .filter(t=>t.history?.some(h=>h.by===uid&&h.action==="allocated"))
        .map(t=>{
          const created = t.createdAt?.toDate?.() || new Date(t.createdAt||0);
          const allocated = t.history?.find(h=>h.by===uid&&h.action==="allocated");
          const allocTime = allocated?.timestamp?.toDate?.() || new Date(allocated?.timestamp||0);
          return differenceInHours(allocTime, created);
        }).filter(h=>h>=0);
      const timelyAlloc = allocTimes.filter(h=>h<=24).length;

      // Timely approvals: approved within 24hrs of submission
      const approvTimes = rangedTasks
        .filter(t=>t.history?.some(h=>h.by===uid&&h.action==="approved"))
        .map(t=>{
          const submitted = t.history?.find(h=>h.action==="submitted_for_review");
          const approved  = t.history?.find(h=>h.by===uid&&h.action==="approved");
          if (!submitted||!approved) return null;
          const st = submitted.timestamp?.toDate?.() || new Date(submitted.timestamp||0);
          const at = approved.timestamp?.toDate?.() || new Date(approved.timestamp||0);
          return differenceInHours(at, st);
        }).filter(h=>h!==null&&h>=0);
      const timelyApproval = approvTimes.filter(h=>h<=24).length;

      return { ...m, level:"level1", supervised, allocations, approvals,
        timelyAlloc: allocTimes.length ? `${timelyAlloc}/${allocTimes.length}` : "—",
        timelyApproval: approvTimes.length ? `${timelyApproval}/${approvTimes.length}` : "—",
        avgAllocTime: avgHours(allocTimes),
        avgApprovalTime: avgHours(approvTimes),
      };
    }

    if (LEVEL2.includes(role)) {
      // Level 2: lead metrics
      const allocated   = rangedTasks.filter(t=>t.history?.some(h=>h.by===uid&&h.action==="allocated")).length;
      const approved    = rangedTasks.filter(t=>t.history?.some(h=>h.by===uid&&h.action==="approved")).length;
      const reworkReq   = rangedTasks.filter(t=>t.history?.some(h=>h.by===uid&&h.action==="rejected")).length;
      const submitted   = rangedTasks.filter(t=>t.history?.some(h=>h.by===uid&&h.action==="submitted_for_review")).length;
      const reworkRcvd  = rangedTasks.filter(t=>t.history?.some(h=>h.action==="rejected"&&t.assignedTo===uid)).length;

      const reviewTimes = rangedTasks
        .filter(t=>t.history?.some(h=>h.by===uid&&h.action==="approved"))
        .map(t=>{
          const sub  = t.history?.find(h=>h.action==="submitted_for_review");
          const app  = t.history?.find(h=>h.by===uid&&h.action==="approved");
          if (!sub||!app) return null;
          const st = sub.timestamp?.toDate?.() || new Date(sub.timestamp||0);
          const at = app.timestamp?.toDate?.() || new Date(app.timestamp||0);
          return differenceInHours(at, st);
        }).filter(h=>h!==null&&h>=0);

      const completionTimes = rangedTasks
        .filter(t=>t.assignedTo===uid&&t.stage==="delivered")
        .map(t=>{
          const allocH = t.history?.find(h=>h.action==="allocated"&&t.assignedTo===uid);
          const delivH = t.history?.find(h=>h.action==="approved"&&h.stage==="delivered");
          if (!allocH||!delivH) return null;
          const st = allocH.timestamp?.toDate?.() || new Date(allocH.timestamp||0);
          const et = delivH.timestamp?.toDate?.() || new Date(delivH.timestamp||0);
          return differenceInHours(et, st);
        }).filter(h=>h!==null&&h>=0);

      return { ...m, level:"level2", allocated, approved, reworkReq, submitted, reworkRcvd,
        avgReviewTime: avgHours(reviewTimes),
        avgCompletionTime: avgHours(completionTimes),
      };
    }

    // Executive metrics
    const assigned   = rangedTasks.filter(t=>t.assignedTo===uid).length;
    const submitted  = rangedTasks.filter(t=>t.history?.some(h=>h.by===uid&&h.action==="submitted_for_review")).length;
    const rework     = rangedTasks.filter(t=>t.history?.some(h=>h.action==="rejected"&&t.assignedTo===uid)).length;
    const raised     = rangedTasks.filter(t=>t.createdBy===uid).length;

    const completionTimes = rangedTasks
      .filter(t=>t.assignedTo===uid&&t.stage==="delivered")
      .map(t=>{
        const allocH = t.history?.find(h=>h.action==="allocated"&&t.assignedTo===uid);
        const delivH = t.history?.find(h=>h.action==="approved"&&h.stage==="delivered");
        if (!allocH||!delivH) return null;
        const st = allocH.timestamp?.toDate?.() || new Date(allocH.timestamp||0);
        const et = delivH.timestamp?.toDate?.() || new Date(delivH.timestamp||0);
        return differenceInHours(et, st);
      }).filter(h=>h!==null&&h>=0);

    return { ...m, level:"executive", assigned, submitted, rework, raised,
      avgCompletionTime: avgHours(completionTimes),
    };
  }).filter(m => {
    if (m.level==="level1") return m.supervised > 0;
    if (m.level==="level2") return m.allocated > 0 || m.approved > 0;
    return m.assigned > 0 || m.raised > 0;
  });

  const level1Stats    = memberStats.filter(m=>m.level==="level1");
  const level2Stats    = memberStats.filter(m=>m.level==="level2");
  const execStats      = memberStats.filter(m=>m.level==="executive");

  // Charts
  const catCounts = {};
  rangedTasks.forEach(t=>{ catCounts[t.category]=(catCounts[t.category]||0)+1; });
  const catData = Object.entries(catCounts).map(([cat,count])=>({ name: CATEGORY_LABELS[cat]||cat, value: count }));

  const stageCounts = {};
  rangedTasks.forEach(t=>{ stageCounts[t.stage]=(stageCounts[t.stage]||0)+1; });
  const stageData = Object.entries(stageCounts).map(([stage,count])=>({ name: STAGE_LABELS[stage]||stage, value: count }));

  const execBarData = execStats.map(m=>({ name: m.name?.split(" ")[0], assigned: m.assigned, submitted: m.submitted, rework: m.rework }));

  async function handleExportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation:"landscape" });
    doc.setFontSize(18); doc.text("StudyMEDIC Work Hub — Report", 14, 22);
    doc.setFontSize(11); doc.text(`Period: ${range.label}`, 14, 32);
    doc.text(`Generated: ${format(new Date(),"MMM d, yyyy h:mm a")}`, 14, 39);

    doc.setFontSize(14); doc.text("Summary", 14, 52);
    autoTable(doc, { startY:56, head:[["Metric","Value"]], body:[
      ["Total tasks",rangedTasks.length],["Delivered",rangedDelivered.length],
      ["Pending",rangedPending.length],["Overdue",overdue.length],
    ], theme:"striped" });

    if (level1Stats.length) {
      doc.setFontSize(14); doc.text("Level 1 Leads — Supervision", 14, doc.lastAutoTable.finalY+14);
      autoTable(doc, { startY:doc.lastAutoTable.finalY+18,
        head:[["Name","Role","Supervised","Allocations","Approvals","Timely Alloc","Timely Approval","Avg Alloc Time","Avg Approval Time"]],
        body: level1Stats.map(m=>[m.name,ROLE_LABELS[m.role],m.supervised,m.allocations,m.approvals,m.timelyAlloc,m.timelyApproval,m.avgAllocTime,m.avgApprovalTime]),
        theme:"striped" });
    }

    if (level2Stats.length) {
      doc.setFontSize(14); doc.text("Level 2 Leads — Review", 14, doc.lastAutoTable.finalY+14);
      autoTable(doc, { startY:doc.lastAutoTable.finalY+18,
        head:[["Name","Role","Allocated","Approved","Rework Requested","Avg Review Time"]],
        body: level2Stats.map(m=>[m.name,ROLE_LABELS[m.role],m.allocated,m.approved,m.reworkReq,m.avgReviewTime]),
        theme:"striped" });
    }

    if (execStats.length) {
      doc.setFontSize(14); doc.text("Executives — Performance", 14, doc.lastAutoTable.finalY+14);
      autoTable(doc, { startY:doc.lastAutoTable.finalY+18,
        head:[["Name","Role","Assigned","Submitted","Rework Received","Raised","Avg Completion Time"]],
        body: execStats.map(m=>[m.name,ROLE_LABELS[m.role],m.assigned,m.submitted,m.rework,m.raised,m.avgCompletionTime]),
        theme:"striped" });
    }

    doc.save(`studymedic-report-${range.label.replace(/[^a-z0-9]/gi,"-")}.pdf`);
  }

  if (loading) return <div style={{display:"flex",justifyContent:"center",padding:80}}><div className="spinner" style={{width:32,height:32}}/></div>;

  return (
    <div className="reports-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">{range.label}</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportPDF}>⬇ Export PDF</button>
      </div>

      {/* Period */}
      <div className="report-period card">
        {["daily","weekly","monthly","custom"].map(p=>(
          <button key={p} className={`period-btn ${period===p?"period-btn--active":""}`} onClick={()=>setPeriod(p)}>
            {p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
        {period==="custom" && (
          <div style={{display:"flex",gap:10,alignItems:"center",marginLeft:16}}>
            <input className="input" type="date" style={{width:150}} value={custom.start} onChange={e=>setCustom({...custom,start:e.target.value})}/>
            <span style={{color:"var(--gray-400)"}}>to</span>
            <input className="input" type="date" style={{width:150}} value={custom.end} onChange={e=>setCustom({...custom,end:e.target.value})}/>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="report-kpis">
        {[["Total Tasks",rangedTasks.length,"#fff"],["Delivered",rangedDelivered.length,"#f0fdf4"],["Pending",rangedPending.length,"#f0f0ff"],["Overdue",overdue.length,overdue.length>0?"#fff0f0":"#fff"],["All-time Delivered",allDelivered.length,"#fff"]].map(([l,v,bg])=>(
          <div key={l} className="card kpi-card" style={{background:bg}}>
            <div className="kpi-value">{v}</div>
            <div className="kpi-label">{l}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="report-charts">
        {execBarData.length>0 && (
          <div className="card chart-card chart-wide">
            <h3 className="chart-title">Executive Performance</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={execBarData} margin={{top:5,right:20,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0d6e4"/>
                <XAxis dataKey="name" tick={{fontSize:12}}/>
                <YAxis tick={{fontSize:12}}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="assigned" fill="#7eb8d4" name="Assigned" radius={[3,3,0,0]}/>
                <Bar dataKey="submitted" fill="#f4a7b9" name="Submitted" radius={[3,3,0,0]}/>
                <Bar dataKey="rework" fill="#e87fa0" name="Rework" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {catData.length>0 && (
          <div className="card chart-card">
            <h3 className="chart-title">Retail vs Corporate</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
                  {catData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip/><Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Level 1 Leads */}
      {level1Stats.length>0 && (
        <div className="card report-table-card">
          <div className="report-table-header">
            <h3>Level 1 Leads — Supervision Report</h3>
            <p className="text-muted" style={{fontSize:12}}>Combined allocations, reviews and approvals</p>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="report-table">
              <thead><tr>
                <th>Name</th><th>Role</th><th>Total Supervised</th><th>Allocations</th><th>Approvals</th>
                <th>Timely Alloc</th><th>Timely Approval</th><th>Avg Alloc Time</th><th>Avg Approval Time</th>
              </tr></thead>
              <tbody>
                {level1Stats.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontWeight:600}}>{m.name}</td>
                    <td><span className="badge" style={{background:"var(--blue-light)",color:"var(--brand)"}}>{ROLE_LABELS[m.role]}</span></td>
                    <td><strong>{m.supervised}</strong></td>
                    <td>{m.allocations}</td>
                    <td>{m.approvals}</td>
                    <td><span style={{color:m.timelyAlloc!=="—"?"var(--green-700)":"var(--gray-400)"}}>{m.timelyAlloc}</span></td>
                    <td><span style={{color:m.timelyApproval!=="—"?"var(--green-700)":"var(--gray-400)"}}>{m.timelyApproval}</span></td>
                    <td style={{fontFamily:"var(--mono)",fontSize:12}}>{m.avgAllocTime}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:12}}>{m.avgApprovalTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 2 Leads */}
      {level2Stats.length>0 && (
        <div className="card report-table-card">
          <div className="report-table-header">
            <h3>Level 2 Leads — Review Report</h3>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="report-table">
              <thead><tr>
                <th>Name</th><th>Role</th><th>Allocated</th><th>Submitted</th><th>Approved</th><th>Rework Requested</th><th>Rework Received</th><th>Avg Review Time</th><th>Avg Completion</th>
              </tr></thead>
              <tbody>
                {level2Stats.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontWeight:600}}>{m.name}</td>
                    <td><span className="badge" style={{background:"var(--pink)",color:"var(--pink-dark)"}}>{ROLE_LABELS[m.role]}</span></td>
                    <td>{m.allocated}</td>
                    <td style={{color:"var(--brand)",fontWeight:600}}>{m.submitted}</td>
                    <td style={{color:"var(--green-700)",fontWeight:600}}>{m.approved}</td>
                    <td style={{color:m.reworkReq>0?"var(--red-700)":"var(--gray-400)"}}>{m.reworkReq}</td>
                    <td style={{color:m.reworkRcvd>0?"var(--red-700)":"var(--gray-400)"}}>{m.reworkRcvd}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:12}}>{m.avgReviewTime}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:12}}>{m.avgCompletionTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Executives */}
      {execStats.length>0 && (
        <div className="card report-table-card">
          <div className="report-table-header">
            <h3>Executives — Performance Report</h3>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="report-table">
              <thead><tr>
                <th>Name</th><th>Role</th><th>Assigned</th><th>Submitted</th><th>Rework Received</th><th>Tasks Raised</th><th>Avg Completion</th>
              </tr></thead>
              <tbody>
                {execStats.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontWeight:600}}>{m.name}</td>
                    <td><span className="badge" style={{background:"#f3e5f5",color:"#6a1b9a"}}>{ROLE_LABELS[m.role]}</span></td>
                    <td>{m.assigned}</td>
                    <td style={{color:"var(--brand)",fontWeight:600}}>{m.submitted}</td>
                    <td style={{color:m.rework>0?"var(--red-700)":"var(--gray-400)"}}>{m.rework}</td>
                    <td>{m.raised}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:12}}>{m.avgCompletionTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {memberStats.length===0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">No activity data for this period</div>
        </div>
      )}
    </div>
  );
}
