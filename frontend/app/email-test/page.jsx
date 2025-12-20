"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export default function EmailTestPage() {
  const [signedPdf, setSignedPdf] = useState(null);
  const [certificatePdf, setCertificatePdf] = useState(null);
  const [emails, setEmails] = useState("");
  const [loading, setLoading] = useState(false);

  const sendEmail = async () => {
    if (!signedPdf || !certificatePdf || !emails) {
      alert("Please upload PDFs and enter emails");
      return;
    }

    const formData = new FormData();
    formData.append("signedPdf", signedPdf);
    formData.append("certificatePdf", certificatePdf);
    formData.append("emails", JSON.stringify(emails.split(",").map(e => e.trim())));

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/email-documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Email failed");
      }

      alert("Email sent successfully");
    } catch (err) {
      alert("Error sending email");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-page">
      <div className="tool-card">
        <h1 className="tool-title">Email Signed Documents</h1>

        <div className="upload-box">
          <label>Signed PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setSignedPdf(e.target.files[0])}
          />
        </div>

        <div className="upload-box">
          <label>Certificate PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setCertificatePdf(e.target.files[0])}
          />
        </div>

        <div className="upload-box">
          <label>Email addresses (comma separated)</label>
          <input
            type="text"
            placeholder="user1@gmail.com, user2@gmail.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
        </div>

        <button
          className="btn-primary"
          onClick={sendEmail}
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Email"}
        </button>
      </div>
    </div>
  );
}
