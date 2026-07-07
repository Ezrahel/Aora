import { Router } from "express";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SendByte } from "@sendbyte/node";

const DATA_DIR = join(process.cwd(), "data");
const WAITLIST_FILE = join(DATA_DIR, "waitlist.jsonl");

// Lazy SendByte client — only initialises when we actually send
let _sendbyte: SendByte | null = null;
function getSendByte(): SendByte | null {
  if (!_sendbyte) {
    const key = process.env.SENDBYTE_API_KEY;
    if (!key || (!key.startsWith("sk_live_") && !key.startsWith("sk_test_"))) {
      console.warn("[waitlist] SENDBYTE_API_KEY not configured — confirmation emails disabled.");
      return null;
    }
    _sendbyte = new SendByte(key);
  }
  return _sendbyte;
}

async function addEntry(entry: Record<string, unknown>): Promise<number> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(WAITLIST_FILE, JSON.stringify({ ...entry, createdAt: new Date().toISOString() }) + "\n");
  let count = 0;
  try {
    const content = await readFile(WAITLIST_FILE, "utf-8");
    count = content.trim().split("\n").filter(Boolean).length;
  } catch { /* file doesn't exist yet */ }
  return count;
}

async function sendConfirmation(email: string, name: string | null, position: number) {
  const greeting = name ? `Hey ${name},` : "Hey there,";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F5F5F7; padding: 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table style="max-width: 480px; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
      <tr><td style="text-align: center; padding-bottom: 24px;">
        <span style="font-size: 32px;">✨</span>
      </td></tr>
      <tr><td style="text-align: center; padding-bottom: 8px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #111011; margin: 0;">You're on the waitlist.</h1>
      </td></tr>
      <tr><td style="text-align: center; padding-bottom: 24px;">
        <p style="font-size: 14px; color: #6E6E73; line-height: 1.5; margin: 0;">${greeting}</p>
      </td></tr>
      <tr><td style="text-align: center; padding-bottom: 24px;">
        <div style="display: inline-block; background: #F5F5F7; border-radius: 12px; padding: 16px 32px;">
          <p style="font-size: 11px; color: #6E6E73; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Your position</p>
          <p style="font-size: 36px; font-weight: 800; color: #111011; font-family: monospace; margin: 0;">#${position.toLocaleString()}</p>
        </div>
      </td></tr>
      <tr><td style="padding-bottom: 16px;">
        <p style="font-size: 14px; color: #6E6E73; line-height: 1.6; margin: 0;">Here's what happens next:</p>
        <ul style="font-size: 14px; color: #6E6E73; line-height: 1.7; padding-left: 20px; margin: 8px 0 0;">
          <li><strong style="color: #111011;">We onboard in batches</strong> — every few days. You'll get a Calendly link to book a 30-min onboarding call.</li>
          <li><strong style="color: #111011;">Founder's Plan locked in</strong> — 3 months free on any tier. No expiration. This stays with you forever.</li>
          <li><strong style="color: #111011;">Direct line to the team</strong> — reply to this email and it lands in my inbox.</li>
        </ul>
      </td></tr>
      <tr><td style="padding-top: 16px; border-top: 1px solid #E5E5E7;">
        <p style="font-size: 12px; color: #A3A3A6; margin: 0;">— Ditech, Founder @ AoraHQ</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

  const sb = getSendByte();
  if (!sb) return; // silently skip when SendByte isn't configured

  try {
    await sb.emails.send({
      from: process.env.WAITLIST_FROM || "AoraHQ <hello@aorahq.com>",
      to: email,
      subject: `You're #${position} on the AoraHQ waitlist. Here's what happens next.`,
      html,
    });
  } catch (err) {
    console.error("SendByte confirmation failed for", email, err);
  }
}

async function sendNotification(email: string, name: string | null, company: string | null, position: number) {
  const sb = getSendByte();
  if (!sb) return;

  const namePart = name ? ` **${name}**` : "";
  const companyPart = company ? ` from **${company}**` : "";

  try {
    await sb.emails.send({
      from: process.env.WAITLIST_FROM || "AoraHQ <hello@aorahq.com>",
      to: "adelakinisrael024@gmail.com",
      subject: `🚀 New waitlist signup: ${email} (#${position})`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F5F5F7; padding: 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table style="max-width: 480px; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td style="padding-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #111011; margin: 0;">New waitlist signup 🚀</h2>
      </td></tr>
      <tr><td style="padding-bottom: 8px;">
        <p style="font-size: 14px; color: #6E6E73; margin: 0;"><strong style="color: #111011;">Position:</strong> #${position.toLocaleString()}</p>
      </td></tr>
      <tr><td style="padding-bottom: 8px;">
        <p style="font-size: 14px; color: #6E6E73; margin: 0;"><strong style="color: #111011;">Email:</strong> ${email}</p>
      </td></tr>
      <tr><td style="padding-bottom: 8px;">
        <p style="font-size: 14px; color: #6E6E73; margin: 0;"><strong style="color: #111011;">Name:</strong> ${name || "—"}</p>
      </td></tr>
      <tr><td style="padding-bottom: 8px;">
        <p style="font-size: 14px; color: #6E6E73; margin: 0;"><strong style="color: #111011;">Company:</strong> ${company || "—"}</p>
      </td></tr>
      <tr><td style="padding-bottom: 8px;">
        <p style="font-size: 14px; color: #6E6E73; margin: 0;"><strong style="color: #111011;">Signed up:</strong> ${new Date().toLocaleString()}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });
    console.log("[waitlist] Notification sent for", email);
  } catch (err) {
    console.error("[waitlist] Notification failed for", email, err);
  }
}

const router = Router();

router.post("/waitlist", async (req, res) => {
  try {
    const { email, name, company, gateway, mrr, referral } = req.body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const position = await addEntry({
      email: normalizedEmail,
      name: name?.trim() || null,
      company: company?.trim() || null,
      gateway: gateway || null,
      mrr: mrr || null,
      referral: referral || null,
    });

    // Send confirmation — fire-and-forget, don't block the response
    sendConfirmation(normalizedEmail, name?.trim() || null, position);

    // Notify the team
    sendNotification(normalizedEmail, name?.trim() || null, company?.trim() || null, position);

    res.status(201).json({ status: "ok", position });
  } catch (err: any) {
    console.error("Waitlist error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

export default router;
