"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";
const TOKEN_KEY = "signforge_pro_token";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [hasPro, setHasPro] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    setHasPro(!!t);
  }, []);

  const buy = async () => {
    setMsg("");
    setLoading(true);

    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Razorpay SDK failed to load");

      // 1) Create order
      const res = await fetch(`${API_BASE}/billing/razorpay/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountInINR: 299,
          notes: { plan: "pro_monthly", product: "signforge" },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Order creation failed");

      // 2) Open checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "SignForge Pro",
        description: "Remove watermark + certificate + email delivery",
        order_id: data.orderId,
        handler: async function (response) {
          // 3) Verify payment -> get JWT token
          const vres = await fetch(`${API_BASE}/billing/razorpay/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });

          const vdata = await vres.json();
          if (!vres.ok) throw new Error(vdata?.error || "Payment verify failed");

          localStorage.setItem(TOKEN_KEY, vdata.token);
          setHasPro(true);
          setMsg("✅ Pro unlocked on this device. You can now remove watermark, download certificate and email documents.");
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
        theme: { color: "#7b3cf5" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setMsg("❌ " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const clearPro = () => {
    localStorage.removeItem(TOKEN_KEY);
    setHasPro(false);
    setMsg("Pro token removed from this device.");
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>MONETIZATION READY</div>
        <h1 style={styles.title}>SignForge Pro</h1>
        <p style={styles.sub}>
          Pay once per month to unlock the features businesses actually pay for.
        </p>

        <div style={styles.grid}>
          <div style={styles.box}>
            <h3 style={styles.h3}>Free</h3>
            <ul style={styles.ul}>
              <li>✔ Sign & download</li>
              <li>✔ Basic audit page</li>
              <li>✖ Watermark removed</li>
              <li>✖ Certificate PDF</li>
              <li>✖ Email delivery</li>
            </ul>
          </div>

          <div style={styles.boxPro}>
            <h3 style={styles.h3}>Pro</h3>
            <div style={styles.price}>₹299 / month</div>
            <ul style={styles.ul}>
              <li>✔ No watermark</li>
              <li>✔ Certificate PDF</li>
              <li>✔ Email signed + certificate</li>
              <li>✔ Multi-signer support</li>
            </ul>
          </div>
        </div>

        {!hasPro ? (
          <button onClick={buy} disabled={loading} style={styles.btn}>
            {loading ? "Opening checkout..." : "Upgrade via Razorpay"}
          </button>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={styles.proOn}>✅ Pro is active on this device</div>
            <button onClick={clearPro} style={styles.btnGhost}>
              Remove Pro Token (testing)
            </button>
          </div>
        )}

        {msg ? <div style={styles.msg}>{msg}</div> : null}

        <div style={styles.links}>
          <a href="/" style={styles.link}>
            ← Home
          </a>
          <a href="/sign-pdf" style={styles.link}>
            Go to Sign PDF →
          </a>
        </div>
      </div>
    </div>
  );
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
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
    width: "min(720px, 94vw)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.6,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    marginBottom: 10,
  },
  title: { fontSize: 30, fontWeight: 950, margin: "6px 0 0 0" },
  sub: { opacity: 0.85, marginTop: 8, lineHeight: 1.4 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 18,
    marginBottom: 18,
  },
  box: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  boxPro: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(123,60,245,0.12)",
  },
  h3: { margin: 0, fontSize: 18, fontWeight: 900 },
  price: { fontSize: 26, fontWeight: 950, margin: "10px 0 10px 0" },
  ul: { margin: "10px 0 0 18px", opacity: 0.92, lineHeight: 1.7 },
  btn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 16,
    background: "linear-gradient(90deg, #7b3cf5, #ff4db2)",
    color: "#fff",
  },
  btnGhost: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.22)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 14,
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
  },
  proOn: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,255,160,0.10)",
    border: "1px solid rgba(0,255,160,0.18)",
    fontWeight: 800,
  },
  msg: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    opacity: 0.95,
  },
  links: {
    marginTop: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  link: { color: "#fff", textDecoration: "none", opacity: 0.9 },
};
