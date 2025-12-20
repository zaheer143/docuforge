import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

router.post("/", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).send("No PDF uploaded");

  res.json({
    filename: req.file.filename,
    original: req.file.originalname,
    size: req.file.size,
  });
});

export default router;
