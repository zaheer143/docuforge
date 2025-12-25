// frontend/components/SiteFooter.jsx
import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="siteFooter">
      <div className="footerRow">
        <div className="footerLinks">
          <Link href="/pricing">Pricing</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refund & Cancellation</Link>
        </div>

        <div className="footerMeta">
          Support:{" "}
          <a href="mailto:support@docuforge.in">support@docuforge.in</a>
          {" "}• © {year} DocuForge
        </div>
      </div>
    </footer>
  );
}
