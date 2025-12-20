import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { signProToken } from "../utils/auth.js";

const router = express.Router();

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getRazorpay() {
  const key_id = mustEnv("RAZORPAY_KEY_ID");
  const key_secret = mustEnv("RAZORPAY_KEY_SECRET");
  return new Razorpay({ key_id, key_secret });
}

router.post("/billing/razorpay/order", async (req, res) => {
  try {
    const amountInINR = Number(req.body?.amountInINR ?? 299);
    if (!Number.isFinite(amountInINR) || amountInINR < 1) {
      return res.status(400).json({ error: "Invalid amountInINR" });
    }

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: Math.round(amountInINR * 100),
      currency: "INR",
      receipt: `signforge_${Date.now()}`,
      notes: req.body?.notes || {},
    });

    return res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    console.error("Razorpay order error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

router.post("/billing/razorpay/verify", async (req, res) => {
  try {
    const secret = mustEnv("RAZORPAY_KEY_SECRET");

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing Razorpay payment fields" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const token = signProToken({
      email: email || "",
      rp_order: razorpay_order_id,
      rp_payment: razorpay_payment_id,
    });

    return res.json({ token });
  } catch (e) {
    console.error("Razorpay verify error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
