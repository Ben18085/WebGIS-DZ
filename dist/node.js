// ─────────────────────────────────────────────
//  Install dependencies first:
//  npm install express nodemailer dotenv cors
// ─────────────────────────────────────────────

require("dotenv").config(); // Load credentials from .env file (see below)

const express    = require("express");
const nodemailer = require("nodemailer");
const cors       = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────
app.use(cors());                          // Allow cross-origin requests
app.use(express.json());                  // Parse JSON request bodies
app.use(express.static("public"));        // Serve your HTML/CSS/JS files from /public folder

// ── Email Transporter ─────────────────────────
// IMPORTANT: Never hardcode passwords here.
// Store them in a .env file (see bottom of this file).
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,         // Your Gmail address from .env
    pass: process.env.EMAIL_PASS         // Gmail App Password from .env
  }
});

// Verify transporter config on startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
    console.log("Make sure EMAIL_USER and EMAIL_PASS are set in your .env file.");
  } else {
    console.log("✅ Email server is ready to send messages.");
  }
});

// ── Simple rate limiter (prevent spam) ────────
const requestCounts = {};
function rateLimit(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();

  if (!requestCounts[ip]) requestCounts[ip] = [];
  // Keep only requests from the last 10 minutes
  requestCounts[ip] = requestCounts[ip].filter(t => now - t < 10 * 60 * 1000);

  if (requestCounts[ip].length >= 5) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please wait a few minutes before trying again."
    });
  }

  requestCounts[ip].push(now);
  next();
}

// ── POST /api/send-email ──────────────────────
app.post("/api/send-email", rateLimit, async (req, res) => {
  const { name, email, message } = req.body;

  // Server-side validation
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email address." });
  }

  try {
    await transporter.sendMail({
      from:     `"${name}" <${process.env.EMAIL_USER}>`, // Gmail requires sending from your own address
      replyTo:  email,                                   // Reply goes to the visitor's email
      to:       process.env.EMAIL_USER,                  // Reception inbox (your Gmail)
      subject:  `📬 New Contact Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #1a6b3c;">New Contact Form Message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left: 4px solid #1a6b3c; padding-left: 12px; color: #333;">
            ${escapeHtml(message).replace(/\n/g, "<br>")}
          </blockquote>
          <hr>
          <p style="font-size: 12px; color: #888;">Sent via WebGIS DZ contact form</p>
        </div>
      `
    });

    console.log(`📧 Email received from ${name} (${email})`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    res.status(500).json({ success: false, message: "Server error. Could not send email." });
  }
});

// ── Helper: prevent HTML injection in emails ──
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Start Server ──────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ─────────────────────────────────────────────
//  CREATE A FILE NAMED .env in your project root:
//
//  EMAIL_USER=abconsultdz.office@gmail.com
//  EMAIL_PASS=xxxx xxxx xxxx xxxx   ← Gmail App Password (16 chars)
//  PORT=3000
//
//  HOW TO GET A GMAIL APP PASSWORD:
//  1. Go to myaccount.google.com → Security
//  2. Enable 2-Step Verification
//  3. Go to "App passwords" → create one for "Mail"
//  4. Copy the 16-character password into .env
//
//  Also add .env to your .gitignore so it's never uploaded!
// ─────────────────────────────────────────────
