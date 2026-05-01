// src/utils/workflow.js
import { LEVEL_1, CREATIVE_TYPES, STAGES } from "./constants";

// What tasks should be visible to a given user
export function getVisibleTasks(tasks, user) {
  if (!user || !tasks) return [];
  const role = user.role;
  const uid = user.id;

  return tasks.filter((t) => {
    // Creator always sees their own tasks
    if (t.createdBy === uid) return true;

    // Assigned person sees their task
    if (t.assignedTo === uid) return true;

    // Level 1 leads see tasks in final review or raised (waiting for their action)
    if (LEVEL_1.includes(role)) {
      if (t.stage === "raised") return true;
      if (t.stage === "final_review") return true;
      if (t.stage === "final_rework") return true;
      if (t.assignedBy === uid) return true;
    }

    // Content lead sees content stage tasks only
    if (role === "content_lead") {
      if (["content_allocated","content_in_progress","content_review","content_rework"].includes(t.stage) && (t.assignedBy === uid || t.assignedTo === uid)) return true;
    }
    // Content writer sees only tasks assigned to them at content stage
    if (role === "content_writer") {
      if (["content_allocated","content_in_progress","content_rework"].includes(t.stage) && t.assignedTo === uid) return true;
    }

    // Design lead sees design stage tasks only
    if (role === "design_lead") {
      if (["design_allocated","design_in_progress","design_review","design_rework"].includes(t.stage) && (t.assignedBy === uid || t.assignedTo === uid)) return true;
    }
    // Designer sees only tasks assigned to them at design stage
    if (role === "designer") {
      if (["design_allocated","design_in_progress","design_rework"].includes(t.stage) && t.assignedTo === uid) return true;
    }
    // Video lead sees video stage tasks only
    if (role === "video_lead") {
      if (["video_allocated","video_in_progress","video_review","video_rework"].includes(t.stage) && (t.assignedBy === uid || t.assignedTo === uid)) return true;
    }
    // Video editor sees only tasks assigned to them at video stage
    if (role === "video_editor") {
      if (["video_allocated","video_in_progress","video_rework"].includes(t.stage) && t.assignedTo === uid) return true;
    }

    return false;
  });
}

// What actions can the current user perform on this task
export function getActions(task, user) {
  if (!task || !user) return {};
  const { stage, assignedTo, assignedBy } = task;
  const role = user.role;
  const uid = user.id;

  const actions = {
    canAllocate: false,
    canStart: false,
    canSubmit: false,
    canApprove: false,
    canReject: false,
    canComment: true,
  };

  // Level 1 can allocate from raised stage
  if (stage === "raised" && LEVEL_1.includes(role)) actions.canAllocate = true;

  // Content lead can allocate from content_allocated
  if (stage === "content_allocated" && role === "content_lead") actions.canAllocate = true;

  // Design lead can allocate from design_allocated
  if (stage === "design_allocated" && role === "design_lead") actions.canAllocate = true;

  // Video lead can allocate from video_allocated
  if (stage === "video_allocated" && role === "video_lead") actions.canAllocate = true;

  // Assignee can start work - only at their stage
  if (uid === assignedTo && stage === "content_allocated") actions.canStart = true;
  if (uid === assignedTo && stage === "design_allocated") actions.canStart = true;
  if (uid === assignedTo && stage === "video_allocated") actions.canStart = true;

  // Assignee can submit work
  if (uid === assignedTo && ["content_in_progress","content_rework","design_in_progress","design_rework","video_in_progress","video_rework","final_rework"].includes(stage)) {
    actions.canSubmit = true;
  }
  // Lead can also submit if they're doing it themselves
  if (role === "content_lead" && ["content_in_progress","content_rework"].includes(stage) && assignedTo === uid) actions.canSubmit = true;
  if (role === "design_lead" && ["design_in_progress","design_rework"].includes(stage) && assignedTo === uid) actions.canSubmit = true;
  if (role === "video_lead" && ["video_in_progress","video_rework"].includes(stage) && assignedTo === uid) actions.canSubmit = true;

  // Approvals
  if (stage === "content_review" && role === "content_lead") { actions.canApprove = true; actions.canReject = true; }
  if (stage === "design_review" && role === "design_lead") { actions.canApprove = true; actions.canReject = true; }
  if (stage === "video_review" && role === "video_lead") { actions.canApprove = true; actions.canReject = true; }
  if (stage === "final_review" && LEVEL_1.includes(role)) { actions.canApprove = true; actions.canReject = true; }

  // External approver (person who allocated can approve ext tasks)
  if (stage === "final_review" && uid === assignedBy) { actions.canApprove = true; actions.canReject = true; }

  return actions;
}

// Next stage after approval
export function getNextStageOnApprove(task) {
  const { stage, creativeType } = task;
  if (stage === "content_review") {
    if (creativeType === CREATIVE_TYPES.FLYER) return STAGES.DESIGN_ALLOCATED;
    return STAGES.VIDEO_ALLOCATED;
  }
  if (stage === "design_review") return STAGES.FINAL_REVIEW;
  if (stage === "video_review") return STAGES.FINAL_REVIEW;
  if (stage === "final_review") return STAGES.DELIVERED;
  return null;
}

// Next stage on rejection
export function getNextStageOnReject(task) {
  const map = {
    content_review: "content_rework",
    design_review: "design_rework",
    video_review: "video_rework",
    final_review: "final_rework",
  };
  return map[task.stage] || null;
}

// Next stage on submit
export function getNextStageOnSubmit(task) {
  const map = {
    content_in_progress: "content_review",
    content_rework: "content_review",
    design_in_progress: "design_review",
    design_rework: "design_review",
    video_in_progress: "video_review",
    video_rework: "video_review",
    final_rework: "final_review",
  };
  return map[task.stage] || null;
}

// Next stage on start
export function getNextStageOnStart(task) {
  const map = {
    content_allocated: "content_in_progress",
    design_allocated: "design_in_progress",
    video_allocated: "video_in_progress",
  };
  return map[task.stage] || null;
}

// Next stage on allocate
export function getNextStageOnAllocate(task) {
  if (task.stage === "raised") return "content_allocated";
  if (task.stage === "content_allocated") return "content_in_progress";
  if (task.stage === "design_allocated") return "design_in_progress";
  if (task.stage === "video_allocated") return "video_in_progress";
  return null;
}

// Who can be assigned at current stage
export function getAssignableRoles(task, user) {
  const { stage } = task;
  if (stage === "raised") return ["content_lead","content_writer","design_lead","designer","video_lead","video_editor","pm_executive","avp","assistant_manager","creative_head","performance_head"];
  if (stage === "content_allocated") return ["content_lead","content_writer"];
  if (stage === "design_allocated") return ["design_lead","designer"];
  if (stage === "video_allocated") return ["video_lead","video_editor"];
  return [];
}
