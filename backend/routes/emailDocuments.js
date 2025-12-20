import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { requirePro } from "../utils/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeStr(v, fallback = "") {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return fallback;
  return String(v);
}

router.post(
  "/email-documents",
  requirePro,
  upload.fields([
    { name: "signedPdf", maxCount: 1 },
    { name: "certificatePdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const EMAIL_USER = mustEnv("EMAIL_USER");
      const EMAIL_PASS = mustEnv("EMAIL_PASS");

      const toEmail = safeStr(req.body?.toEmail).trim();
      if (!toEmail) {
        return res.status(400).json({ error: "toEmail is required" });
      }

      const subject =
        safeStr(req.body?.subject).trim() || "Your signed document";
      const message =
        safeStr(req.body?.message).trim() ||
        "Attached are your signed PDF and signing certificate.";

      const signed = req.files?.signedPdf?.[0];
      const cert = req.files?.certificatePdf?.[0];

      if (!signed) {
        return res.status(400).json({ error: "signedPdf file is required" });
      }
      if (!cert) {
        return res
          .status(400)
          .json({ error: "certificatePdf file is required" });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS, // Gmail App Password
        },
      });

      const attachments = [
        {
          filename: signed.originalname || "signed.pdf",
          content: signed.buffer,
          contentType: "application/pdf",
        },
        {
          filename: cert.originalname || "certificate.pdf",
          content: cert.buffer,
          contentType: "application/pdf",
        },
      ];

      await transporter.sendMail({
        from: `SignForge <${EMAIL_USER}>`,
        to: toEmail,
        subject,
        text: message,
        attachments,
      });

      return res.json({ ok: true, sentTo: toEmail });
    } catch (e) {
      console.error("email-documents error:", e);
      return res.status(500).json({
        error: e?.message || String(e),
      });
    }
  }
);

export default router;
