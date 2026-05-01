// src/utils/constants.js

// ── Special accounts ─────────────────────────────────────────────
export const SUPER_ADMIN = { username: "SUPER ADMIN", password: "superadmin@123" };
export const ADMIN_ACCOUNT = { username: "admin", password: "admin123" };

// ── Roles ─────────────────────────────────────────────────────────
export const ROLES = {
  AVP: "avp",
  ASSISTANT_MANAGER: "assistant_manager",
  CREATIVE_HEAD: "creative_head",
  PERFORMANCE_HEAD: "performance_head",
  CONTENT_LEAD: "content_lead",
  DESIGN_LEAD: "design_lead",
  VIDEO_LEAD: "video_lead",
  DESIGNER: "designer",
  VIDEO_EDITOR: "video_editor",
  CONTENT_WRITER: "content_writer",
  PM_EXECUTIVE: "pm_executive",
};

export const ROLE_LABELS = {
  avp: "AVP",
  assistant_manager: "Assistant Manager",
  creative_head: "Creative Head",
  performance_head: "Performance Head",
  content_lead: "Content Lead",
  design_lead: "Design Lead",
  video_lead: "Video Production Lead",
  designer: "Designer",
  video_editor: "Video Editor / Motion Graphics",
  content_writer: "Content Writer",
  pm_executive: "PM Executive",
};

export const LEVEL_1 = ["avp", "assistant_manager", "creative_head", "performance_head"];
export const LEVEL_2 = ["content_lead", "design_lead", "video_lead"];
export const EXECUTIVES = ["designer", "video_editor", "content_writer", "pm_executive"];

// Who can raise a work request
export const CAN_RAISE = [...LEVEL_1, ...LEVEL_2, "pm_executive"];

// Who can give approvals at each stage
export const APPROVERS = {
  content_review: ["content_lead"],
  design_review: ["design_lead"],
  video_review: ["video_lead"],
  final_review: [...LEVEL_1],
};

// ── Categories & Creative Types ───────────────────────────────────
export const CATEGORIES = { RETAIL: "retail", CORPORATE: "corporate" };
export const CATEGORY_LABELS = { retail: "Retail", corporate: "Corporate" };

export const CREATIVE_TYPES = { FLYER: "flyer", MOTION: "motion_graphics", VIDEO: "real_video" };
export const CREATIVE_TYPE_LABELS = { flyer: "Flyer", motion_graphics: "Motion Graphics", real_video: "Real Video" };
export const CREATIVE_TYPE_ICONS = { flyer: "🖼️", motion_graphics: "🎬", real_video: "🎥" };

// ── Workflow Stages ───────────────────────────────────────────────
export const STAGES = {
  RAISED: "raised",
  CONTENT_ALLOCATED: "content_allocated",
  CONTENT_IN_PROGRESS: "content_in_progress",
  CONTENT_REVIEW: "content_review",
  CONTENT_REWORK: "content_rework",
  DESIGN_ALLOCATED: "design_allocated",
  DESIGN_IN_PROGRESS: "design_in_progress",
  DESIGN_REVIEW: "design_review",
  DESIGN_REWORK: "design_rework",
  VIDEO_ALLOCATED: "video_allocated",
  VIDEO_IN_PROGRESS: "video_in_progress",
  VIDEO_REVIEW: "video_review",
  VIDEO_REWORK: "video_rework",
  FINAL_REVIEW: "final_review",
  FINAL_REWORK: "final_rework",
  DELIVERED: "delivered",
};

export const STAGE_LABELS = {
  raised: "Raised",
  content_allocated: "Content Allocated",
  content_in_progress: "Content In Progress",
  content_review: "Content Review",
  content_rework: "Content Rework",
  design_allocated: "Design Allocated",
  design_in_progress: "Design In Progress",
  design_review: "Design Review",
  design_rework: "Design Rework",
  video_allocated: "Video Allocated",
  video_in_progress: "Video In Progress",
  video_review: "Video Review",
  video_rework: "Video Rework",
  final_review: "Final Review",
  final_rework: "Final Rework",
  delivered: "Delivered ✓",
};

export const STAGE_COLORS = {
  raised:               { bg: "#e3f2fd", text: "#1565c0" },
  content_allocated:    { bg: "#e8eaf6", text: "#283593" },
  content_in_progress:  { bg: "#e8eaf6", text: "#283593" },
  content_review:       { bg: "#fff9c4", text: "#f57f17" },
  content_rework:       { bg: "#fef2f2", text: "#b71c1c" },
  design_allocated:     { bg: "#fce4ec", text: "#880e4f" },
  design_in_progress:   { bg: "#fce4ec", text: "#880e4f" },
  design_review:        { bg: "#fff9c4", text: "#f57f17" },
  design_rework:        { bg: "#fef2f2", text: "#b71c1c" },
  video_allocated:      { bg: "#e8f5e9", text: "#1b5e20" },
  video_in_progress:    { bg: "#e8f5e9", text: "#1b5e20" },
  video_review:         { bg: "#fff9c4", text: "#f57f17" },
  video_rework:         { bg: "#fef2f2", text: "#b71c1c" },
  final_review:         { bg: "#fff3e0", text: "#e65100" },
  final_rework:         { bg: "#fef2f2", text: "#b71c1c" },
  delivered:            { bg: "#e8f5e9", text: "#2e7d32" },
};

export const PRIORITIES = { LOW: "low", MEDIUM: "medium", HIGH: "high", URGENT: "urgent" };
export const PRIORITY_COLORS = {
  low:    { bg: "#e8f5e9", text: "#2e7d32" },
  medium: { bg: "#fff8e1", text: "#f57f17" },
  high:   { bg: "#fff3e0", text: "#e65100" },
  urgent: { bg: "#fce4ec", text: "#b71c1c" },
};
