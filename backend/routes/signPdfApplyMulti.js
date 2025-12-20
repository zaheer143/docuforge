import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPlanFromReq } from "../utils/auth.js";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const parseJson = (str, fallback) => {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const pngBytesFromDataUrl = (dataUrl) => {
  const m = String(dataUrl || "").match(/^data:image\/png;base64,(.+)$/);
  if (!m) return null;
  return Buffer.from(m[1], "base64");
};

function wrapText(text, maxChars = 95) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

router.post(
  "/apply-multi",
  upload.single("pdf"),
  async (req, res) => {
    let pdfPath = "";
    try {
      const pdfFile = req.file;
      if (!pdfFile) return res.status(400).send("No PDF uploaded");
      pdfPath = pdfFile.path;

      const originalPdfBytes = fs.readFileSync(pdfPath);
      const originalHash = crypto
        .createHash("sha256")
        .update(originalPdfBytes)
        .digest("hex");

      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();

      const placements = parseJson(req.body?.placements || "[]", []);
      const signerMeta = parseJson(req.body?.signerMetaJson || "[]", []);
      const signaturesMap = parseJson(req.body?.signaturesJson || "{}", {});

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Map signerId -> embedded PNG image
      const signerIdToImage = new Map();
      if (signaturesMap && typeof signaturesMap === "object") {
        for (const [signerId, dataUrlOrBase64] of Object.entries(signaturesMap)) {
          const bytes = pngBytesFromDataUrl(dataUrlOrBase64);
          if (!bytes) continue;
          try {
            const img = await pdfDoc.embedPng(bytes);
            signerIdToImage.set(String(signerId), img);
          } catch {
            // ignore
          }
        }
      }

      // Apply placements
      if (Array.isArray(placements) && placements.length > 0) {
        for (const p of placements) {
          const pageIndex = Number(p.pageIndex);
          if (
            !Number.isInteger(pageIndex) ||
            pageIndex < 0 ||
            pageIndex >= pages.length
          )
            continue;

          const xPct = safeNum(p.xPct, NaN);
          const yPct = safeNum(p.yPct, NaN);
          const wPct = safeNum(p.wPct, NaN);
          const hPct = safeNum(p.hPct, NaN);
          if (![xPct, yPct, wPct, hPct].every(Number.isFinite)) continue;

          const page = pages[pageIndex];
          const { width: pageW, height: pageH } = page.getSize();

          const x = xPct * pageW;
          const w = wPct * pageW;
          const h = hPct * pageH;

          const yTop = yPct * pageH;
          const y = pageH - yTop - h;

          const signerId = p?.signerId ? String(p.signerId) : "";
          const img = signerId ? signerIdToImage.get(signerId) : null;

          if (img) {
            page.drawImage(img, { x, y, width: w, height: h });
          } else {
            // fallback box
            page.drawRectangle({
              x,
              y,
              width: w,
              height: h,
              borderColor: rgb(0.5, 0.2, 0.8),
              borderWidth: 1,
              color: rgb(1, 1, 1),
              opacity: 0,
            });
            page.drawText("SIGN", {
              x: x + 6,
              y: y + h / 2 - 6,
              size: 12,
              font: fontBold,
              color: rgb(0.35, 0.12, 0.55),
            });
          }
        }
      }

      // Append audit trail page (simple)
      const usedSignerIds = new Set(
        (Array.isArray(placements) ? placements : [])
          .map((p) => p?.signerId)
          .filter(Boolean)
      );

      const usedSigners = Array.isArray(signerMeta)
        ? signerMeta.filter((s) => usedSignerIds.has(s.id))
        : [];

      const auditPage = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width: aw, height: ah } = auditPage.getSize();

      const margin = 48;
      let y = ah - margin;

      const draw = (text, size = 11, bold = false) => {
        const lines = wrapText(text, 95);
        for (const ln of lines) {
          auditPage.drawText(ln, {
            x: margin,
            y,
            size,
            font: bold ? fontBold : font,
            color: rgb(0.08, 0.08, 0.08),
            maxWidth: aw - margin * 2,
          });
          y -= size + 7;
        }
      };

      const nowIso = new Date().toISOString();

      draw("Audit Trail", 18, true);
      y -= 8;
      draw(`Generated: ${nowIso}`, 11, false);
      draw(`Original Document Hash (SHA-256): ${originalHash}`, 10, false);
      y -= 10;

      draw("Signers:", 12, true);
      if (usedSigners.length) {
        for (const s of usedSigners) {
          const nm = String(s?.name || "Unknown");
          const em = String(s?.email || "-");
          const signedAt = String(s?.signedAt || "-");
          draw(`• ${nm} <${em}>`, 11, false);
          draw(`  Signed At: ${signedAt}`, 10, false);
          if (y < 80) break;
        }
      } else {
        draw("• No signer metadata found.", 11, false);
      }

      y -= 8;
      draw("Signature Placements:", 12, true);
      if (Array.isArray(placements) && placements.length) {
        for (const p of placements.slice(0, 25)) {
          const pageIndex = Number(p.pageIndex) + 1;
          const signerId = p?.signerId ? String(p.signerId) : "-";
          draw(`• Page ${pageIndex} | Signer: ${signerId}`, 10, false);
          if (y < 80) break;
        }
      } else {
        draw("• No signature placements found.", 11, false);
      }

      // -------- FREE WATERMARK ----------
      const plan = getPlanFromReq(req);
      if (plan !== "pro") {
        const wmFont = fontBold || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));
        const allPages = pdfDoc.getPages();
        for (const pg of allPages) {
          const { width: w, height: h } = pg.getSize();

          pg.drawText("SIGNFORGE FREE", {
            x: 70,
            y: h / 2,
            size: 42,
            font: wmFont,
            color: rgb(0.78, 0.78, 0.78),
            opacity: 0.35,
          });

          pg.drawText("Free version — upgrade to remove watermark", {
            x: 48,
            y: 20,
            size: 10,
            font: wmFont,
            color: rgb(0.55, 0.55, 0.55),
            opacity: 0.9,
          });
        }
      }

      const outBytes = await pdfDoc.save();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="signed_${Date.now()}.pdf"`
      );
      res.send(Buffer.from(outBytes));
    } catch (err) {
      console.error("apply-multi error:", err);
      res.status(500).send(String(err?.message || err));
    } finally {
      try {
        if (pdfPath) fs.unlinkSync(pdfPath);
      } catch {}
    }
  }
);

export default router;
