import "dotenv/config";
import express from "express";
import cors from "cors";

import pdfSignRoutes from "./routes/pdfSign.js";
import signPdfApplyRoutes from "./routes/signPdfApply.js";
import signPdfApplyMulti from "./routes/signPdfApplyMulti.js";
import signPdfCertificateRoutes from "./routes/signPdfCertificate.js";
import emailDocumentsRoutes from "./routes/emailDocuments.js";
import billingRoutes from "./routes/billing.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.send("docusignpdf backend ok"));

app.use("/sign-pdf", pdfSignRoutes);
app.use("/sign-pdf", signPdfApplyRoutes);
app.use("/sign-pdf", signPdfApplyMulti);
app.use("/sign-pdf", signPdfCertificateRoutes);
app.use("/sign-pdf", emailDocumentsRoutes);

app.use("/", billingRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Razorpay key present: ${process.env.RAZORPAY_KEY_ID ? "YES" : "NO"}`);
});
