import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

/**
 * Issue a PRO token (30 days)
 */
export function signProToken(payload = {}) {
  return jwt.sign(
    {
      plan: "pro",
      ...payload,
    },
    SECRET,
    { expiresIn: "30d" }
  );
}

/**
 * Read plan from Authorization header:
 * Authorization: Bearer <token>
 * Returns: "pro" | "free"
 */
export function getPlanFromReq(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return "free";

  try {
    const decoded = jwt.verify(token, SECRET);
    return decoded?.plan === "pro" ? "pro" : "free";
  } catch (e) {
    return "free";
  }
}

/**
 * Middleware: require PRO
 * Returns HTTP 402 if not PRO
 */
export function requirePro(req, res, next) {
  // Emergency switch for local testing only
  if (process.env.BYPASS_PAYWALL === "true") return next();

  const plan = getPlanFromReq(req);
  if (plan !== "pro") {
    return res.status(402).json({
      error: "PRO_REQUIRED",
      message: "Upgrade to Pro to use this feature.",
    });
  }
  next();
}
