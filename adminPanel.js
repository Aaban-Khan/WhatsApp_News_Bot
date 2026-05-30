// adminPanel.js — Admin web UI

const express = require("express");
const db = require("./db");
const { sendMessage, msgWelcomeRegister } = require("./whatsapp");

const router = express.Router();

// ─── GET /admin ───────────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  const officers = db.getAllOfficers();
  const { success, error, info } = req.query;

  const rows = officers.map((o) => {
    const statusColor =
      o.status === "active" ? "#22c55e" :
        o.status === "pending" ? "#f59e0b" : "#ef4444";
    const date = new Date(o.registered_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
    });
    const displayName = o.name ? o.name : `<span style="color:#475569;font-style:italic">—</span>`;
    return `
      <tr>
        <td>${o.id}</td>
        <td>${displayName}</td>
        <td>+${o.phone}</td>
        <td><span class="badge" style="background:${statusColor}">${o.status}</span></td>
        <td>${o.language === "hindi" ? "🇮🇳 Hindi" : "🇬🇧 English"}</td>
        <td>${date}</td>
        <td class="actions">
          <button class="btn-icon" onclick="openEdit(${o.id},'${o.phone}','${(o.name || "").replace(/'/g, "\\'")}','${o.status}','${o.language}')" title="Edit">✏️</button>
          <form method="POST" action="/admin/resend/${o.phone}" style="display:inline"
            onsubmit="return confirm('Re-send welcome to +${o.phone}?')">
            <button class="btn-icon" title="Re-send welcome">📨</button>
          </form>
          <form method="POST" action="/admin/delete/${o.id}" style="display:inline"
            onsubmit="return confirm('Delete ${o.name || '+' + o.phone}?')">
            <button class="btn-icon delete" title="Delete">🗑️</button>
          </form>
        </td>
      </tr>`;
  }).join("");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>WhatsApp News Bot — Admin</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem}
    .container{max-width:1050px;margin:0 auto}
    header{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid #1e293b}
    header h1{font-size:1.5rem;font-weight:700}
    header span{font-size:.85rem;color:#94a3b8}
    .card{background:#1e293b;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;border:1px solid #334155}
    .card h2{font-size:1rem;font-weight:600;margin-bottom:1rem;color:#cbd5e1}
    .form-grid{display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:.65rem;align-items:end}
    .form-group{display:flex;flex-direction:column;gap:.3rem}
    .form-group label{font-size:.78rem;color:#94a3b8;font-weight:500}
    .phone-wrap{display:flex;align-items:center;background:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden}
    .phone-wrap:focus-within{border-color:#6366f1}
    .phone-prefix{padding:.65rem .6rem .65rem .9rem;color:#6366f1;font-weight:700;font-size:.95rem;white-space:nowrap;user-select:none}
    .phone-wrap input{border:none;background:transparent;padding:.65rem .9rem .65rem .1rem;color:#f1f5f9;font-size:.95rem;outline:none;width:100%}
    input[type=text],select{width:100%;padding:.65rem 1rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:.95rem;outline:none}
    input[type=text]:focus,select:focus{border-color:#6366f1}
    select option{background:#1e293b}
    .btn{padding:.65rem 1.3rem;border:none;border-radius:8px;color:#fff;font-weight:600;cursor:pointer;font-size:.9rem;transition:background .2s;white-space:nowrap}
    .btn-primary{background:#6366f1}.btn-primary:hover{background:#4f46e5}
    .btn-warning{background:#d97706}.btn-warning:hover{background:#b45309}
    .btn-ghost{background:#334155}.btn-ghost:hover{background:#475569}
    .btn-icon{background:none;border:none;cursor:pointer;font-size:1.05rem;padding:.25rem .4rem;border-radius:6px;transition:background .15s}
    .btn-icon:hover{background:#334155}
    .btn-icon.delete:hover{background:#450a0a}
    .hint{font-size:.78rem;color:#64748b;margin-top:.4rem}
    .alert{padding:.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}
    .success{background:#14532d;border:1px solid #22c55e;color:#bbf7d0}
    .error{background:#450a0a;border:1px solid #ef4444;color:#fecaca}
    .info{background:#1e3a5f;border:1px solid #3b82f6;color:#bfdbfe}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem}
    .stat-box{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:1rem;text-align:center}
    .stat-box .num{font-size:2rem;font-weight:700}
    .stat-box .lbl{font-size:.8rem;color:#64748b;margin-top:.25rem}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:.6rem .75rem;font-size:.75rem;font-weight:600;text-transform:uppercase;color:#64748b;border-bottom:1px solid #334155}
    td{padding:.65rem .75rem;font-size:.88rem;border-bottom:1px solid #0f172a}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#1a2740}
    .badge{display:inline-block;padding:.2rem .55rem;border-radius:99px;font-size:.7rem;font-weight:700;color:#fff;text-transform:uppercase}
    .actions{display:flex;gap:.2rem;align-items:center}
    .empty{color:#475569;text-align:center;padding:2rem}
    /* Modal */
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;align-items:center;justify-content:center}
    .overlay.open{display:flex}
    .modal{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:2rem;width:100%;max-width:440px}
    .modal h3{margin-bottom:1.25rem;font-size:1.1rem}
    .modal .form-group{margin-bottom:.75rem}
    .modal-actions{display:flex;gap:.75rem;margin-top:1.5rem;justify-content:flex-end}
    @media(max-width:700px){.form-grid{grid-template-columns:1fr 1fr;}}
  </style>
</head>
<body>
<div class="container">
  <header>
    <div style="font-size:1.8rem">🚔</div>
    <div>
      <h1>WhatsApp News Bot — Admin Panel</h1>
      <span>India News Digest for Police Officers</span>
    </div>
  </header>

  ${success ? `<div class="alert success">✅ ${decodeURIComponent(success)}</div>` : ""}
  ${error ? `<div class="alert error">❌ ${decodeURIComponent(error)}</div>` : ""}
  ${info ? `<div class="alert info">ℹ️ ${decodeURIComponent(info)}</div>` : ""}

  <!-- Stats -->
  <div class="stats">
    <div class="stat-box">
      <div class="num" style="color:#6366f1">${officers.length}</div>
      <div class="lbl">Total Registered</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:#22c55e">${officers.filter(o => o.status === "active").length}</div>
      <div class="lbl">Active</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:#f59e0b">${officers.filter(o => o.status === "pending").length}</div>
      <div class="lbl">Pending</div>
    </div>
  </div>

  <!-- Register -->
  <div class="card">
    <h2>➕ Register New Officer</h2>
    <form method="POST" action="/admin/register">
      <div class="form-grid">
        <div class="form-group">
          <label>Officer Name</label>
          <input type="text" name="name" placeholder="e.g. Rajesh Kumar" />
        </div>
        <div class="form-group">
          <label>WhatsApp Number</label>
          <div class="phone-wrap">
            <span class="phone-prefix">+91</span>
            <input type="text" name="phone" placeholder="9876543210" required pattern="[0-9]{10}" maxlength="10"/>
          </div>
        </div>
        <div class="form-group">
          <label>Language</label>
          <select name="language">
            <option value="english">🇬🇧 English</option>
            <option value="hindi">🇮🇳 Hindi</option>
          </select>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn btn-primary" type="submit">Register &amp; Send Welcome</button>
        </div>
      </div>
      <p class="hint">Enter 10-digit number — country code +91 is added automatically</p>
    </form>
  </div>

  <!-- Officers Table -->
  <div class="card">
    <h2>👮 Registered Officers</h2>
    ${officers.length === 0
      ? `<p class="empty">No officers registered yet.</p>`
      : `<div style="overflow-x:auto"><table>
          <thead><tr>
            <th>#</th><th>Name</th><th>Phone</th><th>Status</th><th>Language</th><th>Registered</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
    }
  </div>

  <!-- Trigger Digest -->
  <div class="card">
    <h2>📤 Send Digest Now</h2>
    <p style="font-size:.88rem;color:#94a3b8;margin-bottom:1rem">Send today's news to all active officers immediately.</p>
    <form method="POST" action="/admin/trigger-digest"
      onsubmit="return confirm('Send digest to all active officers now?')">
      <button class="btn btn-warning" type="submit">📨 Send Digest to All Active Officers</button>
    </form>
  </div>
</div>

<!-- Edit Modal -->
<div class="overlay" id="editOverlay">
  <div class="modal">
    <h3>✏️ Edit Officer</h3>
    <form method="POST" action="/admin/edit" id="editForm">
      <input type="hidden" name="id" id="editId"/>
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" id="editName" placeholder="Officer name"/>
      </div>
      <div class="form-group">
        <label>Phone (read-only)</label>
        <input type="text" id="editPhone" readonly style="opacity:.45"/>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select name="status" id="editStatus">
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="left">Left</option>
        </select>
      </div>
      <div class="form-group">
        <label>Language</label>
        <select name="language" id="editLanguage">
          <option value="english">🇬🇧 English</option>
          <option value="hindi">🇮🇳 Hindi</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeEdit()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<script>
function openEdit(id, phone, name, status, language) {
  document.getElementById('editId').value = id;
  document.getElementById('editPhone').value = '+' + phone;
  document.getElementById('editName').value = name;
  document.getElementById('editStatus').value = status;
  document.getElementById('editLanguage').value = language;
  document.getElementById('editOverlay').classList.add('open');
}
function closeEdit() {
  document.getElementById('editOverlay').classList.remove('open');
}
document.getElementById('editOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeEdit();
});
</script>
</body>
</html>`);
});

// ─── POST /admin/register ─────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  let { phone, language, name } = req.body;

  // Auto-prepend 91 (India country code)
  phone = (phone || "").replace(/\D/g, "");
  if (phone.length === 10) phone = "91" + phone;

  language = language === "hindi" ? "hindi" : "english";
  name = (name || "").trim();

  if (!phone || phone.length < 12 || phone.length > 13) {
    return res.redirect(`/admin?error=${encodeURIComponent("Invalid number. Enter 10-digit Indian number.")}`);
  }

  try {
    db.registerOfficer(phone, language, name);
    await sendMessage(phone, msgWelcomeRegister(name));
    res.redirect(`/admin?success=${encodeURIComponent(`${name || "Officer"} (+${phone}) registered. Welcome message sent!`)}`);
  } catch (err) {
    res.redirect(`/admin?error=${encodeURIComponent("Failed: " + err.message)}`);
  }
});

// ─── POST /admin/edit ─────────────────────────────────────────────────────────

router.post("/edit", (req, res) => {
  const { id, status, language, name } = req.body;
  if (!id) return res.redirect("/admin?error=Missing+ID");
  try {
    db.updateOfficerById(parseInt(id), { status, language, name: (name || "").trim() });
    res.redirect(`/admin?success=${encodeURIComponent("Officer updated successfully.")}`);
  } catch (err) {
    res.redirect(`/admin?error=${encodeURIComponent("Update failed: " + err.message)}`);
  }
});

// ─── POST /admin/delete/:id ───────────────────────────────────────────────────

router.post("/delete/:id", (req, res) => {
  try {
    db.deleteOfficer(parseInt(req.params.id));
    res.redirect(`/admin?success=${encodeURIComponent("Officer deleted.")}`);
  } catch (err) {
    res.redirect(`/admin?error=${encodeURIComponent("Delete failed: " + err.message)}`);
  }
});

// ─── POST /admin/resend/:phone ────────────────────────────────────────────────

router.post("/resend/:phone", async (req, res) => {
  const { phone } = req.params;
  try {
    const officer = db.getOfficer(phone);
    db.resetOfficerStep(phone);
    await sendMessage(phone, msgWelcomeRegister(officer ? officer.name : ""));
    res.redirect(`/admin?info=${encodeURIComponent("Welcome message re-sent to +" + phone)}`);
  } catch (err) {
    res.redirect(`/admin?error=${encodeURIComponent("Re-send failed: " + err.message)}`);
  }
});

// ─── POST /admin/trigger-digest ──────────────────────────────────────────────

router.post("/trigger-digest", async (req, res) => {
  res.redirect(`/admin?info=${encodeURIComponent("Digest triggered! Check server logs.")}`);
  const { sendDailyDigest } = require("./index");
  await sendDailyDigest();
});

module.exports = router;