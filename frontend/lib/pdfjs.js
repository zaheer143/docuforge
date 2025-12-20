import * as pdfjsLib from "pdfjs-dist";

// Force PDF.js to load worker from /public (prevents Vercel build crash)
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default pdfjsLib;