import express from "express";
import multer from "multer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto";
import { requirePro } from "../utils/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function safeJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

router.post("/certificate", requirePro, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No PDF uploaded");

    const signers = safeJson(req.body.signers || "[]", []);
    const placements = safeJson(req.body.placements || "[]", []);
    const textPlacements = safeJson(req.body.textPlacements || "[]", []);
    const clientStamp = String(req.body.clientStamp || "");

    const pdfBytes = req.file.buffer;
    const hashFull = crypto.createHash("sha256").update(pdfBytes).digest("hex");

    const pdfDoc = await PDFDocument.create();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    page.drawText("Signing Certificate", {
      x: 50,
      y: height - 70,
      size: 22,
      font: helv,
      color: rgb(0.16, 0.04, 0.38),
    });

    page.drawText("Document Hash (SHA-256):", {
      x: 50,
      y: height - 110,
      size: 12,
      font: helv,
      color: rgb(0.10, 0.10, 0.10),
    });

    // Wrap hash across lines
    const hashLines = [];
    for (let i = 0; i < hashFull.length; i += 64) hashLines.push(hashFull.slice(i, i + 64));

    let y = height - 130;
    for (const line of hashLines) {
      page.drawText(line, {
        x: 50,
        y,
        size: 10,
        font: helv,
        color: rgb(0.10, 0.10, 0.10),
      });
      y -= 14;
    }

    y -= 10;

    page.drawText("Client Stamp:", {
      x: 50,
      y,
      size: 12,
      font: helv,
      color: rgb(0.10, 0.10, 0.10),
    });

    page.drawText(clientStamp || "-", {
      x: 150,
      y,
      size: 12,
      font: helv,
      color: rgb(0.10, 0.10, 0.10),
    });

    y -= 24;

    page.drawText("Signers:", {
      x: 50,
      y,
      size: 12,
      font: helv,
      color: rgb(0.10, 0.10, 0.10),
    });

    y -= 18;

    if (!Array.isArray(signers) || signers.length === 0) {
      page.drawText("-", {
        x: 70,
        y,
        size: 11,
        font: helv,
        color: rgb(0.10, 0.10, 0.10),
      });
      y -= 16;
    } else {
      for (const s of signers) {
        const name = String(s?.name || s?.fullName || "Unknown");
        const email = String(s?.email || "unknown");
        const signedAt = String(s?.signedAt || s?.timestamp || "-");

        page.drawText(`• ${name} <${email}>`, {
          x: 70,
          y,
          size: 11,
          font: helv,
          color: rgb(0.10, 0.10, 0.10),
        });
        y -= 14;

        page.drawText(`  Signed At: ${signedAt}`, {
          x: 85,
          y,
          size: 10,
          font: helv,
          color: rgb(0.20, 0.20, 0.20),
        });
        y -= 16;

        if (y < 80) break; // basic safety
      }
    }

    y -= 6;

    page.drawText("Signature Placements:", {
      x: 50,
      y,
      size: 12,
      font: helv,
      color: rgb(0.10, 0.10, 0.10),
    });

    y -= 18;

    const placementsAll = []
      .concat(Array.isArray(placements) ? placements : [])
      .concat(Array.isArray(textPlacements) ? textPlacements : []);

    if (placementsAll.length === 0) {
      page.drawText("-", {
        x: 70,
        y,
        size: 11,
        font: helv,
        color: rgb(0.10, 0.10, 0.10),
      });
      y -= 16;
    } else {
      for (const p of placementsAll.slice(0, 10)) {
        const pageIndex = Number(p?.pageIndex ?? p?.page ?? 0);
        const x = Number(p?.x ?? 0);
        const yPos = Number(p?.y ?? 0);

        page.drawText(`• Page ${pageIndex + 1} @ (${Math.round(x)}, ${Math.round(yPos)})`, {
          x: 70,
          y,
          size: 11,
          font: helv,
          color: rgb(0.10, 0.10, 0.10),
        });
        y -= 16;
        if (y < 80) break;
      }
    }

    const out = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate_${Date.now()}.pdf"`
    );
    return res.send(Buffer.from(out));
  } catch (e) {
    console.error("certificate error:", e);
    return res
      .status(500)
      .send(String(e?.message || "Failed to generate certificate"));
  }
});

export default router;
