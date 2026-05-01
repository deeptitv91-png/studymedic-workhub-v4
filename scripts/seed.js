// scripts/seed.js
// Creates initial members with individual login credentials
// Usage: node seed.js

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ROLE_LEVELS = {
  avp: "level1", assistant_manager: "level1", creative_head: "level1", performance_head: "level1",
  content_lead: "level2", design_lead: "level2", video_lead: "level2",
  designer: "executive", video_editor: "executive", content_writer: "executive", pm_executive: "executive",
};

// ── Edit these with actual StudyMEDIC team members ────────────────────
// username must be lowercase, no spaces
// password can be anything
const MEMBERS = [
  { name: "Creative Head Name",     username: "creativehead",  password: "creative123",  role: "creative_head" },
  { name: "AVP Name",               username: "avp",           password: "avp123",        role: "avp" },
  { name: "Assistant Manager Name", username: "am",            password: "am123",         role: "assistant_manager" },
  { name: "Performance Head Name",  username: "perfhead",      password: "perf123",       role: "performance_head" },
  { name: "Content Lead Name",      username: "contentlead",   password: "content123",    role: "content_lead" },
  { name: "Design Lead Name",       username: "designlead",    password: "design123",     role: "design_lead" },
  { name: "Video Lead Name",        username: "videolead",     password: "video123",      role: "video_lead" },
  { name: "Designer Name",          username: "designer1",     password: "designer123",   role: "designer" },
  { name: "Video Editor Name",      username: "videoeditor1",  password: "editor123",     role: "video_editor" },
  { name: "Content Writer Name",    username: "writer1",       password: "writer123",     role: "content_writer" },
  { name: "PM Executive Name",      username: "pm1",           password: "pm123",         role: "pm_executive" },
];

async function seed() {
  console.log("Seeding members with individual logins...\n");

  for (const m of MEMBERS) {
    await db.collection("members").add({
      name: m.name,
      username: m.username,
      password: m.password,
      role: m.role,
      level: ROLE_LEVELS[m.role],
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✓ ${m.name} → login: ${m.username} / ${m.password}`);
  }

  console.log("\n✅ Done! Share credentials with each team member.");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
