"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import pdfjsLib from "../../lib/pdfjs";


// ✅ pdf.js worker fix for Next.js
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("pro_token") ||
    "";

  return token ? { Authorization: `Bearer ${token}` } : {};
};


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

const SIG_STORAGE_KEY_GLOBAL = "signpdf_default_signature_v2";
const SIGNERS_STORAGE_KEY = "signpdf_signers_v1";

const isPasswordError = (err) => {
  const msg = String(err?.message || err || "");
  return (
    err?.name === "PasswordException" ||
    msg.toLowerCase().includes("password") ||
    msg.toLowerCase().includes("encrypted") ||
    msg.toLowerCase().includes("passwordexception")
  );
};

const formatDate = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const nowStamp = () => {
  const d = new Date();
  return d.toLocaleString();
};

const toDataUrlBytes = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
};

const palette = [
  { name: "Purple", border: "#7b3cf5" },
  { name: "Pink", border: "#ff4db2" },
  { name: "Blue", border: "#4a6cf7" },
  { name: "Green", border: "#1db954" },
  { name: "Orange", border: "#ff8a00" },
  { name: "Teal", border: "#0aa6b5" },
];

export default function SignPdfDay4() {
  const inputRef = useRef(null);
  const sigUploadRef = useRef(null);

  // Draw pad refs
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef({ x: 0, y: 0 });

  const imgContainerRef = useRef(null);

  const [errorMsg, setErrorMsg] = useState("");

  const [pdfFile, setPdfFile] = useState(null);
  const [pages, setPages] = useState([]); // dataURL images
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ Multiple Signers
  // signer: { id, name, colorIdx, signatureDataUrl }
  const [signers, setSigners] = useState(() => {
    // default one signer
    return [{ id: `s_${Date.now()}`, name: "Signer 1", colorIdx: 0, signatureDataUrl: "" }];
  });
  const [activeSignerId, setActiveSignerId] = useState(() => signers?.[0]?.id || "");

  // Current signer name input (typed signature uses this too)
  const activeSigner = useMemo(
    () => signers.find((s) => s.id === activeSignerId) || signers[0],
    [signers, activeSignerId]
  );

  // Saved global default signature (localStorage)
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState("");

  // selected overlay
  const [activeId, setActiveId] = useState(null);

  // signature placements
  // {id, pageIndex, xPct, yPct, wPct, hPct, signerId, locked}
  const [placements, setPlacements] = useState([]);

  // text placements (date/name)
  // {id, pageIndex, xPct, yPct, wPct, hPct, text, signerId, locked}
  const [textPlacements, setTextPlacements] = useState([]);

  // typed signature states
  const [typedFont, setTypedFont] = useState("Segoe Script");

  // Choose mode (Draw / Type)
  const [sigMode, setSigMode] = useState("type"); // "type" | "draw"

  // Lock behavior
  const [lockAfterAdd, setLockAfterAdd] = useState(true);

  // Default box sizes
  const defaultSigBox = { wPct: 0.28, hPct: 0.10 };
  const defaultTextBox = { wPct: 0.26, hPct: 0.06 };

  const fileLabel = useMemo(() => {
    if (!pdfFile) return "No PDF selected — click to choose or drag & drop";
    return pdfFile.name;
  }, [pdfFile]);

  // ✅ Load saved signers + global default signature
  useEffect(() => {
    try {
      const savedSig = localStorage.getItem(SIG_STORAGE_KEY_GLOBAL);
      if (savedSig && savedSig.startsWith("data:image/")) {
        setSavedSignatureDataUrl(savedSig);
        // optionally set first signer signature if empty
        setSigners((prev) =>
          prev.map((s, idx) => {
            if (idx === 0 && !s.signatureDataUrl) return { ...s, signatureDataUrl: savedSig };
            return s;
          })
        );
      }

      const savedSigners = localStorage.getItem(SIGNERS_STORAGE_KEY);
      if (savedSigners) {
        const parsed = JSON.parse(savedSigners);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ensure fields exist
          const cleaned = parsed.map((s, idx) => ({
            id: s.id || `s_${Date.now()}_${idx}`,
            name: String(s.name || `Signer ${idx + 1}`),
            colorIdx: Number.isFinite(s.colorIdx) ? s.colorIdx : idx % palette.length,
            signatureDataUrl: typeof s.signatureDataUrl === "string" ? s.signatureDataUrl : "",
          }));
          setSigners(cleaned);
          setActiveSignerId(cleaned[0].id);
        }
      }
    } catch (e) {
      console.warn("Load saved data failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist signers
  useEffect(() => {
    try {
      localStorage.setItem(SIGNERS_STORAGE_KEY, JSON.stringify(signers));
    } catch {}
  }, [signers]);

  const clearAll = () => {
    setPdfFile(null);
    setPages([]);
    setPageIndex(0);
    setLoading(false);
    setErrorMsg("");
    setPlacements([]);
    setTextPlacements([]);
    setActiveId(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const renderPdf = async (file) => {
    if (!file) return;

    setLoading(true);
    setErrorMsg("");
    setPages([]);
    setPageIndex(0);

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      const images = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.35 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/png"));
      }

      setPages(images);
      setPageIndex(0);
    } catch (e) {
      console.error(e);
      if (isPasswordError(e)) {
        setErrorMsg(
          "This PDF is password-protected / encrypted. Please unlock it first, then upload again."
        );
      } else {
        setErrorMsg("Failed to load PDF. Try another file.");
      }
      clearAll();
    } finally {
      setLoading(false);
    }
  };

  const onPickPdf = async (file) => {
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please select a PDF file.");
      return;
    }

    setPdfFile(file);
    await renderPdf(file);
  };

  const onDropPdf = async (e) => {
    e.preventDefault();
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    await onPickPdf(file);
  };

  // ---------- Signature Pad (Draw) ----------
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);

    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getCanvasPoint = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    return { x, y };
  };

  const startDraw = (e) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    drawingRef.current = true;
    lastPtRef.current = getCanvasPoint(e);
  };

  const moveDraw = (e) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const pt = getCanvasPoint(e);

    ctx.beginPath();
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPtRef.current = pt;
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignaturePad = () => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const saveDrawnSignature = () => {
    if (!activeSignerId) return;
    const src = canvasRef.current;
    const rect = src.getBoundingClientRect();

    const tmp = document.createElement("canvas");
    tmp.width = Math.ceil(rect.width);
    tmp.height = Math.ceil(rect.height);
    const tctx = tmp.getContext("2d");

    tctx.drawImage(src, 0, 0, tmp.width, tmp.height);

    // make white transparent
    const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (r > 245 && g > 245 && b > 245) data[i + 3] = 0;
    }
    tctx.putImageData(img, 0, 0);

    const url = tmp.toDataURL("image/png");
    setSigners((prev) => prev.map((s) => (s.id === activeSignerId ? { ...s, signatureDataUrl: url } : s)));
    setErrorMsg("");
  };

  const uploadSignature = async (file) => {
    if (!file) return;
    if (!activeSignerId) return;

    const ok =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.name.toLowerCase().endsWith(".png") ||
      file.name.toLowerCase().endsWith(".jpg") ||
      file.name.toLowerCase().endsWith(".jpeg");
    if (!ok) {
      setErrorMsg("Please upload a PNG/JPG signature image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setSigners((prev) => prev.map((s) => (s.id === activeSignerId ? { ...s, signatureDataUrl: url } : s)));
      setErrorMsg("");
    };
    reader.readAsDataURL(file);
  };

  // ---------- Typed Signature ----------
  const generateTypedSignature = () => {
    if (!activeSignerId) return;
    const name = String(activeSigner?.name || "").trim();
    if (!name) {
      setErrorMsg("Enter signer name first.");
      return;
    }

    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 260;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);

    let fontSize = 110;
    const padding = 60;

    const pickFont = () => {
      ctx.font = `${fontSize}px "${typedFont}", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive`;
    };

    pickFont();
    while (fontSize > 40 && ctx.measureText(name).width > c.width - padding * 2) {
      fontSize -= 6;
      pickFont();
    }

    // baseline line
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 210);
    ctx.lineTo(820, 210);
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.textBaseline = "middle";

    const textWidth = ctx.measureText(name).width;
    const x = (c.width - textWidth) / 2;
    const y = 140;

    ctx.save();
    ctx.translate(c.width / 2, y);
    ctx.rotate(-0.03);
    ctx.translate(-c.width / 2, -y);
    ctx.fillText(name, x, y);
    ctx.restore();

    const url = c.toDataURL("image/png");
    setSigners((prev) => prev.map((s) => (s.id === activeSignerId ? { ...s, signatureDataUrl: url } : s)));
    setErrorMsg("");
  };

  // ---------- Save / Use / Clear Default Signature (GLOBAL) ----------
  const activeSignatureDataUrl = activeSigner?.signatureDataUrl || "";

  const saveAsDefaultSignature = () => {
    if (!activeSignatureDataUrl) return setErrorMsg("Create or upload a signature first.");
    try {
      localStorage.setItem(SIG_STORAGE_KEY_GLOBAL, activeSignatureDataUrl);
      setSavedSignatureDataUrl(activeSignatureDataUrl);
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("Could not save signature (storage full or blocked).");
    }
  };

  const useDefaultSignature = () => {
    if (!savedSignatureDataUrl) return setErrorMsg("No saved signature found.");
    if (!activeSignerId) return;
    setSigners((prev) =>
      prev.map((s) => (s.id === activeSignerId ? { ...s, signatureDataUrl: savedSignatureDataUrl } : s))
    );
    setErrorMsg("");
  };

  const clearDefaultSignature = () => {
    try {
      localStorage.removeItem(SIG_STORAGE_KEY_GLOBAL);
      setSavedSignatureDataUrl("");
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("Could not clear saved signature.");
    }
  };

  // ---------- Signers ----------
  const addSigner = () => {
    const idx = signers.length;
    const id = `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const next = {
      id,
      name: `Signer ${idx + 1}`,
      colorIdx: idx % palette.length,
      signatureDataUrl: savedSignatureDataUrl || "",
    };
    setSigners((prev) => [...prev, next]);
    setActiveSignerId(id);
    setErrorMsg("");
  };

  const removeActiveSigner = () => {
    if (signers.length <= 1) {
      setErrorMsg("At least one signer is required.");
      return;
    }
    const id = activeSignerId;
    setSigners((prev) => prev.filter((s) => s.id !== id));
    // remove any placements belonging to this signer
    setPlacements((prev) => prev.filter((p) => p.signerId !== id));
    setTextPlacements((prev) => prev.filter((t) => t.signerId !== id));
    // pick first remaining
    setTimeout(() => {
      setActiveSignerId((curr) => {
        const still = signers.filter((s) => s.id !== id);
        return still[0]?.id || "";
      });
    }, 0);
    setErrorMsg("");
  };

  const updateSignerName = (name) => {
    setSigners((prev) =>
      prev.map((s) => (s.id === activeSignerId ? { ...s, name } : s))
    );
  };

  // ---------- Add placements ----------
  const addSignatureToPage = () => {
    if (!activeSignerId) return;
    if (!activeSignatureDataUrl) {
      setErrorMsg("Create (typed/draw) or upload a signature first (for this signer).");
      return;
    }
    if (pages.length === 0) {
      setErrorMsg("Upload a PDF first.");
      return;
    }

    const id = `sig_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setPlacements((prev) => [
      ...prev,
      {
        id,
        signerId: activeSignerId,
        pageIndex,
        xPct: 0.10,
        yPct: 0.12,
        wPct: defaultSigBox.wPct,
        hPct: defaultSigBox.hPct,
        locked: !!lockAfterAdd,
      },
    ]);
    setActiveId(id);
    setErrorMsg("");
  };

  const addDateStamp = () => {
    if (pages.length === 0) return setErrorMsg("Upload a PDF first.");
    const id = `txt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setTextPlacements((prev) => [
      ...prev,
      {
        id,
        signerId: activeSignerId || "",
        pageIndex,
        text: `Date: ${formatDate()}`,
        xPct: 0.10,
        yPct: 0.24,
        wPct: defaultTextBox.wPct,
        hPct: defaultTextBox.hPct,
        locked: !!lockAfterAdd,
      },
    ]);
    setActiveId(id);
    setErrorMsg("");
  };

  const addNameStamp = () => {
    if (pages.length === 0) return setErrorMsg("Upload a PDF first.");
    const name = String(activeSigner?.name || "").trim();
    if (!name) return setErrorMsg("Enter signer name to use Name stamp.");
    const id = `txt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setTextPlacements((prev) => [
      ...prev,
      {
        id,
        signerId: activeSignerId || "",
        pageIndex,
        text: `Name: ${name}`,
        xPct: 0.10,
        yPct: 0.32,
        wPct: defaultTextBox.wPct,
        hPct: defaultTextBox.hPct,
        locked: !!lockAfterAdd,
      },
    ]);
    setActiveId(id);
    setErrorMsg("");
  };

  // ---------- Update / delete overlays ----------
  const currentPageSig = placements.filter((p) => p.pageIndex === pageIndex);
  const currentPageTxt = textPlacements.filter((t) => t.pageIndex === pageIndex);

  const updateSig = (id, patch) => {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const updateTxt = (id, patch) => {
    setTextPlacements((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const deleteActive = () => {
    if (!activeId) return;
    setPlacements((prev) => prev.filter((p) => p.id !== activeId));
    setTextPlacements((prev) => prev.filter((t) => t.id !== activeId));
    setActiveId(null);
  };

  const unlockSelected = () => {
    if (!activeId) return;
    setPlacements((prev) => prev.map((p) => (p.id === activeId ? { ...p, locked: false } : p)));
    setTextPlacements((prev) => prev.map((t) => (t.id === activeId ? { ...t, locked: false } : t)));
  };

  const lockSelected = () => {
    if (!activeId) return;
    setPlacements((prev) => prev.map((p) => (p.id === activeId ? { ...p, locked: true } : p)));
    setTextPlacements((prev) => prev.map((t) => (t.id === activeId ? { ...t, locked: true } : t)));
  };

  // ---------- Drag / Resize shared ----------
  const dragStateRef = useRef(null);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const onBoxPointerDown = (e, id, mode, kind) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveId(id);

    const container = imgContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const item =
      kind === "sig" ? placements.find((pp) => pp.id === id) : textPlacements.find((tt) => tt.id === id);

    if (!item) return;
    if (item.locked) return; // ✅ lock after placement

    dragStateRef.current = {
      id,
      kind, // "sig" | "txt"
      mode, // "move" | "resize"
      startX: x,
      startY: y,
      start: { ...item },
      rectW: rect.width,
      rectH: rect.height,
    };

    window.addEventListener("pointermove", onBoxPointerMove);
    window.addEventListener("pointerup", onBoxPointerUp, { once: true });
  };

  const onBoxPointerMove = (e) => {
    const st = dragStateRef.current;
    const container = imgContainerRef.current;
    if (!st || !container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - st.startX;
    const dy = y - st.startY;

    const dxPct = dx / st.rectW;
    const dyPct = dy / st.rectH;

    const applyUpdate = st.kind === "sig" ? updateSig : updateTxt;

    if (st.mode === "move") {
      const nextX = clamp01(st.start.xPct + dxPct);
      const nextY = clamp01(st.start.yPct + dyPct);

      const maxX = 1 - st.start.wPct;
      const maxY = 1 - st.start.hPct;

      applyUpdate(st.id, {
        xPct: Math.max(0, Math.min(maxX, nextX)),
        yPct: Math.max(0, Math.min(maxY, nextY)),
      });
    } else {
      const nextW = clamp01(st.start.wPct + dxPct);
      const nextH = clamp01(st.start.hPct + dyPct);

      const maxW = 1 - st.start.xPct;
      const maxH = 1 - st.start.yPct;

      applyUpdate(st.id, {
        wPct: Math.max(0.10, Math.min(maxW, nextW)),
        hPct: Math.max(0.03, Math.min(maxH, nextH)),
      });
    }
  };

  const onBoxPointerUp = () => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", onBoxPointerMove);
  };

  // ---------- Download signed PDF (MULTI) ----------
  const downloadSigned = async () => {
    try {
      if (!pdfFile) return setErrorMsg("Upload a PDF first.");
      if (placements.length === 0 && textPlacements.length === 0)
        return setErrorMsg("Add at least one signature or stamp.");

      // each signer used in placements must have signature
      const usedSignerIds = new Set(placements.map((p) => p.signerId));
      for (const sid of usedSignerIds) {
        const s = signers.find((x) => x.id === sid);
        if (!s?.signatureDataUrl) {
          return setErrorMsg(`Signer "${s?.name || sid}" has no signature. Create/upload it first.`);
        }
      }

      setLoading(true);
      setErrorMsg("");

      const form = new FormData();
      form.append("pdf", pdfFile);

      form.append("signers", JSON.stringify(signers));
      form.append("placements", JSON.stringify(placements));
      form.append("textPlacements", JSON.stringify(textPlacements));
      form.append("clientStamp", nowStamp());

      const res = await fetch(`${API_BASE}/sign-pdf/apply-multi`, {
        method: "POST",
        body: form,
        headers: {
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Signing failed");
        setErrorMsg(txt || "Signing failed");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `signed_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setErrorMsg("Something went wrong while signing. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Certificate only
  const downloadCertificate = async () => {
    try {
      if (!pdfFile) return setErrorMsg("Upload a PDF first.");
      setLoading(true);
      setErrorMsg("");

      const form = new FormData();
      form.append("pdf", pdfFile);
      form.append("signers", JSON.stringify(signers));
      form.append("placements", JSON.stringify(placements));
      form.append("textPlacements", JSON.stringify(textPlacements));
      form.append("clientStamp", nowStamp());

      const res = await fetch(`${API_BASE}/sign-pdf/certificate`, {
        method: "POST",
        body: form,
        headers: {
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Certificate failed");
        setErrorMsg(txt || "Certificate failed");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to generate certificate.");
    } finally {
      setLoading(false);
    }
  };

  const signerBorder = (signerId) => {
    const s = signers.find((x) => x.id === signerId);
    const c = palette[(s?.colorIdx ?? 0) % palette.length];
    return c.border;
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Sign PDF</h1>
          <p style={styles.subtitle}>Multiple signers + signatures + Date/Name stamps + certificate.</p>
        </div>

        {/* Upload PDF */}
        <div
          style={styles.uploadBox}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropPdf}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => onPickPdf(e.target.files?.[0])}
          />

          <div style={styles.uploadText}>
            {pdfFile ? (
              <div style={styles.fileRow}>
                <div style={styles.badge}>PDF</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={styles.fileName}>{pdfFile.name}</div>
                  <div style={styles.fileSize}>{(pdfFile.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            ) : (
              <div style={styles.empty}>{fileLabel}</div>
            )}
          </div>
        </div>

        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        <div style={styles.grid}>
          {/* Left: Preview */}
          <div>
            <div style={styles.previewTop}>
              <button
                style={styles.navBtn}
                disabled={pageIndex === 0 || loading || pages.length === 0}
                onClick={() => setPageIndex((p) => p - 1)}
              >
                ‹ Prev
              </button>

              <div style={styles.pageCount}>
                {pages.length > 0 ? `Page ${pageIndex + 1} / ${pages.length}` : "No PDF loaded"}
              </div>

              <button
                style={styles.navBtn}
                disabled={pageIndex === pages.length - 1 || loading || pages.length === 0}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next ›
              </button>
            </div>

            <div style={styles.previewBox}>
              {pages.length === 0 ? (
                <div style={styles.previewEmpty}>Upload a PDF to preview pages here.</div>
              ) : (
                <div ref={imgContainerRef} style={styles.imgWrap}>
                  <img
                    src={pages[pageIndex]}
                    alt="PDF page preview"
                    style={styles.previewImg}
                    draggable={false}
                  />

                  {/* Signature overlays */}
                  {currentPageSig.map((p) => {
                    const isActive = p.id === activeId;
                    const border = signerBorder(p.signerId);
                    const sig = signers.find((s) => s.id === p.signerId)?.signatureDataUrl || "";

                    return (
                      <div
                        key={p.id}
                        style={{
                          ...styles.sigBox,
                          left: `${p.xPct * 100}%`,
                          top: `${p.yPct * 100}%`,
                          width: `${p.wPct * 100}%`,
                          height: `${p.hPct * 100}%`,
                          outline: isActive ? `2px solid ${border}` : `1px solid ${border}55`,
                          boxShadow: isActive ? "0 6px 18px rgba(123,60,245,0.18)" : "none",
                          cursor: p.locked ? "default" : "grab",
                        }}
                        onPointerDown={(e) => onBoxPointerDown(e, p.id, "move", "sig")}
                        onClick={() => setActiveId(p.id)}
                      >
                        {sig ? (
                          <img src={sig} alt="signature" style={styles.sigImg} />
                        ) : (
                          <div style={styles.sigPlaceholder}>Signature</div>
                        )}

                        <div style={{ ...styles.cornerBadge, borderColor: border, color: border }}>
                          {signers.find((s) => s.id === p.signerId)?.name || "Signer"}
                          {p.locked ? " • locked" : ""}
                        </div>

                        {!p.locked && (
                          <div
                            style={styles.resizeHandle}
                            onPointerDown={(e) => onBoxPointerDown(e, p.id, "resize", "sig")}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Text overlays */}
                  {currentPageTxt.map((t) => {
                    const isActive = t.id === activeId;
                    const border = signerBorder(t.signerId);
                    return (
                      <div
                        key={t.id}
                        style={{
                          ...styles.txtBox,
                          left: `${t.xPct * 100}%`,
                          top: `${t.yPct * 100}%`,
                          width: `${t.wPct * 100}%`,
                          height: `${t.hPct * 100}%`,
                          outline: isActive ? `2px solid ${border}` : `1px solid ${border}55`,
                          boxShadow: isActive ? "0 6px 18px rgba(123,60,245,0.18)" : "none",
                          cursor: t.locked ? "default" : "grab",
                        }}
                        onPointerDown={(e) => onBoxPointerDown(e, t.id, "move", "txt")}
                        onClick={() => setActiveId(t.id)}
                      >
                        <div style={styles.txtInner}>{t.text}</div>

                        <div style={{ ...styles.cornerBadge, borderColor: border, color: border }}>
                          {signers.find((s) => s.id === t.signerId)?.name || "Signer"}
                          {t.locked ? " • locked" : ""}
                        </div>

                        {!t.locked && (
                          <div
                            style={styles.resizeHandle}
                            onPointerDown={(e) => onBoxPointerDown(e, t.id, "resize", "txt")}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.tip}>
              Tip: Select box → drag to move → corner to resize → Delete Selected to remove.
              {lockAfterAdd ? " New items are locked by default." : ""}
            </div>
          </div>

          {/* Right: Controls */}
          <div style={styles.side}>
            {/* Signer */}
            <div style={styles.sideTitle}>Signer</div>

            <div style={styles.signerRow}>
              <select
                value={activeSignerId}
                onChange={(e) => setActiveSignerId(e.target.value)}
                style={styles.select}
                disabled={loading}
              >
                {signers.map((s) => {
                  const c = palette[(s.colorIdx ?? 0) % palette.length].border;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({c})
                    </option>
                  );
                })}
              </select>

              <button onClick={addSigner} style={styles.addBtn} disabled={loading}>
                + Add
              </button>
            </div>

            <button onClick={removeActiveSigner} style={styles.removeBtn} disabled={loading}>
              Remove Signer
            </button>

            <div style={styles.block}>
              <label style={styles.label}>Signer name</label>
              <input
                value={activeSigner?.name || ""}
                onChange={(e) => updateSignerName(e.target.value)}
                placeholder="Signer name"
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.divider} />

            {/* Signature */}
            <div style={styles.sideTitle}>Signature</div>

            <div style={styles.tabs}>
              <button
                onClick={() => setSigMode("type")}
                style={{ ...styles.tabBtn, ...(sigMode === "type" ? styles.tabActive : {}) }}
                disabled={loading}
              >
                Type
              </button>
              <button
                onClick={() => setSigMode("draw")}
                style={{ ...styles.tabBtn, ...(sigMode === "draw" ? styles.tabActive : {}) }}
                disabled={loading}
              >
                Draw
              </button>
            </div>

            {sigMode === "type" && (
              <div style={styles.block}>
                <label style={styles.label}>Style</label>
                <select
                  value={typedFont}
                  onChange={(e) => setTypedFont(e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="Segoe Script">Segoe Script</option>
                  <option value="Brush Script MT">Brush Script MT</option>
                  <option value="Lucida Handwriting">Lucida Handwriting</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                </select>

                <button style={styles.primarySmallBtn} onClick={generateTypedSignature} disabled={loading}>
                  Generate Typed Signature
                </button>
              </div>
            )}

            {sigMode === "draw" && (
              <div style={styles.block}>
                <div style={styles.sigPadWrap}>
                  <canvas
                    style={styles.sigPad}
                    ref={canvasRef}
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                  />
                  <div style={styles.sigPadHint}>Draw here</div>
                </div>

                <div style={styles.sideActions}>
                  <button style={styles.smallBtn} onClick={clearSignaturePad} disabled={loading}>
                    Clear
                  </button>
                  <button style={styles.primarySmallBtn} onClick={saveDrawnSignature} disabled={loading}>
                    Save Drawn Signature
                  </button>
                </div>
              </div>
            )}

            <input
              ref={sigUploadRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: "none" }}
              onChange={(e) => uploadSignature(e.target.files?.[0])}
            />

            <button style={styles.uploadSigBtn} onClick={() => sigUploadRef.current?.click()} disabled={loading}>
              Upload Signature Image
            </button>

            {activeSignatureDataUrl && (
              <div style={styles.sigPreviewRow}>
                <div style={styles.sigPreviewLabel}>Preview</div>
                <img src={activeSignatureDataUrl} alt="sig preview" style={styles.sigPreviewImg} />
              </div>
            )}

            <div style={styles.savedRow}>
              <button
                style={styles.smallBtn}
                onClick={saveAsDefaultSignature}
                disabled={loading || !activeSignatureDataUrl}
              >
                Save as Default
              </button>
              <button
                style={styles.smallBtn}
                onClick={useDefaultSignature}
                disabled={loading || !savedSignatureDataUrl}
              >
                Use Default
              </button>
              <button
                style={styles.smallBtnDanger}
                onClick={clearDefaultSignature}
                disabled={loading || !savedSignatureDataUrl}
              >
                Clear Default
              </button>
            </div>

            {savedSignatureDataUrl && (
              <div style={styles.savedHint}>✅ Default signature saved (can reuse across signers)</div>
            )}

            <div style={styles.divider} />

            {/* Lock behavior */}
            <div style={styles.rowBetween}>
              <div style={styles.lockRow}>
                <input
                  type="checkbox"
                  checked={lockAfterAdd}
                  onChange={(e) => setLockAfterAdd(e.target.checked)}
                  disabled={loading}
                  style={{ transform: "scale(1.05)" }}
                />
                <span style={styles.lockLabel}>Lock after add</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.smallBtn} onClick={unlockSelected} disabled={!activeId || loading}>
                  Unlock Selected
                </button>
                <button style={styles.smallBtn} onClick={lockSelected} disabled={!activeId || loading}>
                  Lock Selected
                </button>
              </div>
            </div>

            <button style={styles.convertBtn} onClick={addSignatureToPage} disabled={loading}>
              Add Signature to This Page
            </button>

            <div style={styles.stampsTitle}>Stamps</div>
            <div style={styles.stampsRow}>
              <button style={styles.smallBtn} onClick={addDateStamp} disabled={loading}>
                Add Date
              </button>
              <button style={styles.smallBtn} onClick={addNameStamp} disabled={loading}>
                Add Name
              </button>
            </div>

            <div style={styles.rowBetween}>
              <button style={styles.linkBtn} onClick={deleteActive} disabled={!activeId || loading}>
                Delete Selected
              </button>

              <button style={styles.backLinkBtn} onClick={clearAll} disabled={loading}>
                Reset PDF
              </button>
            </div>

            <button style={styles.downloadBtn} onClick={downloadSigned} disabled={loading}>
              {loading ? <Loader /> : "Download Signed PDF"}
            </button>

            <button style={styles.secondaryBtn} onClick={downloadCertificate} disabled={loading}>
              Download Certificate (PDF)
            </button>

            <a href="/" style={styles.backHome}>
              Back Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={styles.loaderWrap}>
      <div style={styles.loaderDot} />
      <span style={{ marginLeft: 8 }}>Working...</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 48,
    paddingBottom: 48,
    background: "linear-gradient(180deg,#F6F5FF, #FFF)",
  },
  card: {
    width: 1100,
    maxWidth: "94vw",
    background: "#ffffff",
    padding: 28,
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(79,49,120,0.08)",
  },
  header: { textAlign: "center", marginBottom: 14 },
  title: { fontSize: 30, fontWeight: 900, color: "#2a0b62", margin: 0 },
  subtitle: { marginTop: 6, color: "#6b4aa3", fontSize: 13 },

  uploadBox: {
    marginTop: 14,
    borderRadius: 12,
    border: "1px dashed #e6dfff",
    background: "#faf8ff",
    padding: 14,
    cursor: "pointer",
  },
  uploadText: {
    minHeight: 92,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: "#8b68b9", fontSize: 14, textAlign: "center", width: "100%", padding: 18 },
  fileRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    padding: 12,
    borderRadius: 12,
    boxShadow: "0 3px 10px rgba(74,108,247,0.04)",
  },
  badge: {
    width: 60,
    height: 48,
    borderRadius: 10,
    background: "#f3eefc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#5e2bd1",
  },
  fileName: { fontSize: 13, fontWeight: 800, color: "#3b1a6a" },
  fileSize: { fontSize: 12, color: "#8a6fb8", marginTop: 2 },

  errorBox: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#fff1f6",
    border: "1px solid #ffd0e1",
    color: "#8a0038",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },

  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "1.35fr 0.65fr",
    gap: 18,
    alignItems: "start",
  },

  previewTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  navBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #e6dfff",
    background: "#fff",
    color: "#3b1a6a",
    fontWeight: 800,
    cursor: "pointer",
  },
  pageCount: { color: "#6b4aa3", fontWeight: 800, fontSize: 13 },
  previewBox: {
    borderRadius: 12,
    border: "1px solid #eee6ff",
    background: "#fff",
    overflow: "hidden",
    minHeight: 520,
  },
  previewEmpty: { padding: 22, color: "#8b68b9", fontWeight: 700, textAlign: "center" },
  imgWrap: { position: "relative" },
  previewImg: { width: "100%", display: "block", userSelect: "none" },

  sigBox: {
    position: "absolute",
    borderRadius: 10,
    background: "rgba(255,255,255,0.88)",
    overflow: "hidden",
  },
  sigImg: { width: "100%", height: "100%", objectFit: "contain", display: "block" },
  sigPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b4aa3",
    fontWeight: 800,
    fontSize: 12,
  },

  txtBox: {
    position: "absolute",
    borderRadius: 10,
    background: "rgba(255,255,255,0.92)",
    overflow: "hidden",
  },
  txtInner: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    fontWeight: 900,
    color: "#2a0b62",
    fontSize: 14,
    userSelect: "none",
  },

  cornerBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    fontSize: 11,
    fontWeight: 900,
    background: "rgba(255,255,255,0.9)",
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid",
    boxShadow: "0 6px 16px rgba(79,49,120,0.10)",
    userSelect: "none",
  },

  resizeHandle: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 4,
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    cursor: "nwse-resize",
    boxShadow: "0 6px 14px rgba(123,60,245,0.22)",
  },

  tip: { marginTop: 10, fontSize: 12, color: "#8b68b9", textAlign: "center" },

  side: {
    border: "1px solid #eee6ff",
    borderRadius: 14,
    padding: 16,
    background: "#fbfaff",
  },
  sideTitle: { fontWeight: 900, color: "#2a0b62", marginBottom: 10 },

  signerRow: { display: "flex", gap: 10, alignItems: "center" },
  addBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(74,108,247,0.16)",
    background: "#fff",
    fontWeight: 900,
    color: "#4a6cf7",
    cursor: "pointer",
    minWidth: 80,
  },
  removeBtn: {
    marginTop: 10,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ffd0e1",
    background: "#fff1f6",
    fontWeight: 900,
    color: "#8a0038",
    cursor: "pointer",
  },

  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  tabBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e6dfff",
    background: "#fff",
    fontWeight: 900,
    color: "#3b1a6a",
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid rgba(123,60,245,0.35)",
    boxShadow: "0 6px 18px rgba(123,60,245,0.10)",
  },

  block: { marginTop: 10 },
  label: { display: "block", fontSize: 12, fontWeight: 900, color: "#6b4aa3", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e6dfff",
    outline: "none",
    fontWeight: 800,
    color: "#2a0b62",
    background: "#fff",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e6dfff",
    outline: "none",
    fontWeight: 800,
    color: "#2a0b62",
    background: "#fff",
  },

  primarySmallBtn: {
    marginTop: 10,
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  sigPadWrap: {
    marginTop: 10,
    borderRadius: 12,
    border: "1px dashed #e6dfff",
    background: "#fff",
    position: "relative",
    overflow: "hidden",
  },
  sigPad: { width: "100%", height: 140, display: "block" },
  sigPadHint: {
    position: "absolute",
    bottom: 8,
    right: 10,
    fontSize: 12,
    color: "#8b68b9",
    fontWeight: 900,
  },
  sideActions: { display: "flex", gap: 10, marginTop: 10 },

  uploadSigBtn: {
    marginTop: 10,
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid rgba(74,108,247,0.14)",
    background: "#fff",
    fontWeight: 900,
    color: "#3b1a6a",
    cursor: "pointer",
  },

  sigPreviewRow: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    alignItems: "center",
    background: "#fff",
    borderRadius: 12,
    padding: 10,
    border: "1px solid #eee6ff",
  },
  sigPreviewLabel: { fontSize: 12, fontWeight: 900, color: "#6b4aa3" },
  sigPreviewImg: { height: 40, objectFit: "contain" },

  savedRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 },
  smallBtn: {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #e6dfff",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    color: "#4a6cf7",
  },
  smallBtnDanger: {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #ffd0e1",
    background: "#fff1f6",
    fontWeight: 900,
    cursor: "pointer",
    color: "#8a0038",
  },
  savedHint: { marginTop: 8, fontSize: 12, color: "#1b7f3a", fontWeight: 900 },

  divider: { height: 1, background: "#eee6ff", margin: "14px 0" },

  lockRow: { display: "flex", alignItems: "center", gap: 8 },
  lockLabel: { fontSize: 12, fontWeight: 900, color: "#6b4aa3" },

  convertBtn: {
    marginTop: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  stampsTitle: { marginTop: 12, fontWeight: 900, color: "#2a0b62" },
  stampsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },

  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10 },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#6b4aa3",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 900,
  },
  backLinkBtn: {
    background: "linear-gradient(90deg,#5e2bd1,#b84bb7)",
    border: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    fontWeight: 900,
    cursor: "pointer",
  },

  downloadBtn: {
    marginTop: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(74,108,247,0.14)",
    background: "#fff",
    color: "#3b1a6a",
    fontWeight: 900,
    cursor: "pointer",
  },

  backHome: {
    marginTop: 12,
    display: "block",
    textAlign: "center",
    color: "#ffffff",
    textDecoration: "none",
    background: "linear-gradient(90deg,#5e2bd1,#b84bb7)",
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 900,
  },

  loaderWrap: { display: "flex", alignItems: "center", color: "#fff", fontWeight: 900, fontSize: 14 },
  loaderDot: {
    width: 18,
    height: 18,
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 0 0 0 rgba(255,255,255,0.35)",
    animation: "pulse 1s infinite",
  },
};

// inject keyframes
if (typeof window !== "undefined") {
  const styleId = "sign-pdf-loader-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
        70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 8px rgba(255,255,255,0); }
        100% { transform: scale(0.9); opacity: 0.8; box-shadow: 0 0 0 0 rgba(255,255,255,0); }
      }
    `;
    document.head.appendChild(s);
  }
}
