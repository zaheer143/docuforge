// frontend/app/pricing/page.jsx
import Link from "next/link";
import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Pricing - DocuForge",
};

export default function PricingPage() {
  return (
    <LegalShell
      title="Pricing"
      subtitle="All prices are in INR (₹). Choose a plan that fits your usage."
    >
      <div className="grid2">
        <div className="plan">
          <div className="planTitleRow">
            <h2 className="planName">Starter Plan</h2>
            <p className="planPrice">₹199 / month</p>
          </div>

          <ul className="ul">
            <li>Upload & sign up to 20 documents</li>
            <li>Basic e-signature</li>
            <li>Email delivery</li>
            <li>Audit trail</li>
          </ul>

          <div className="btnRow">
            <button
              className="btnPrimary"
              onClick={() => alert("Payment integration next. KYC first.")}
            >
              Buy Now
            </button>
            <Link className="btnGhost" href="/">
              Back to Home
            </Link>
          </div>
        </div>

        <div className="plan">
          <div className="planTitleRow">
            <h2 className="planName">Professional Plan</h2>
            <p className="planPrice">₹999 / year</p>
          </div>

          <ul className="ul">
            <li>Unlimited documents</li>
            <li>Advanced e-signature</li>
            <li>Download signed PDFs</li>
            <li>Certificate of completion</li>
            <li>Priority support</li>
          </ul>

          <div className="btnRow">
            <button
              className="btnPrimary"
              onClick={() => alert("Payment integration next. KYC first.")}
            >
              Buy Now
            </button>
            <Link className="btnGhost" href="/">
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      <div className="legalDivider" />

      <p>
        Need help? Email{" "}
        <a href="mailto:support@docuforge.in">support@docuforge.in</a>.
      </p>
    </LegalShell>
  );
}
