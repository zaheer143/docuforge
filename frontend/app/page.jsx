"use client";

export default function Home() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>SignForge</h1>
        <p style={styles.sub}>
          Sign PDFs online with an audit trail. Upgrade to remove watermark and
          unlock certificate + email delivery.
        </p>

        <div style={styles.btnRow}>
          <a href="/sign-pdf" style={styles.btnPrimary}>
            Start Signing
          </a>
          <a href="/pricing" style={styles.btnSecondary}>
            Pricing
          </a>
        </div>

        <div style={styles.note}>
          <div style={styles.noteTitle}>Free vs Pro</div>
          <ul style={styles.ul}>
            <li>Free: Sign & download (watermarked)</li>
            <li>Pro: No watermark + certificate + email delivery</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "linear-gradient(120deg, #0b0b14, #2a0d3a, #0b0b14)",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
  },
  card: {
    width: "min(760px, 94vw)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  },
  title: {
    fontSize: 34,
    fontWeight: 950,
    margin: 0,
  },
  sub: {
    marginTop: 10,
    opacity: 0.86,
    lineHeight: 1.5,
  },
  btnRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  btnPrimary: {
    padding: "14px 18px",
    borderRadius: 14,
    textDecoration: "none",
    fontWeight: 950,
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
    display: "inline-block",
  },
  btnSecondary: {
    padding: "14px 18px",
    borderRadius: 14,
    textDecoration: "none",
    fontWeight: 900,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
    display: "inline-block",
  },
  note: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  noteTitle: {
    fontWeight: 900,
    marginBottom: 6,
  },
  ul: {
    margin: "0 0 0 18px",
    opacity: 0.92,
    lineHeight: 1.7,
  },
};
