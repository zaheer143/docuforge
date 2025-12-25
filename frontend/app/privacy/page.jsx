// frontend/app/privacy/page.jsx
import LegalShell from "../../components/LegalShell";


export const metadata = {
  title: "Privacy Policy - DocuForge",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" subtitle="Last updated: December 2025">
      <p>
        We respect your privacy. This policy explains how we collect, use, and protect
        information when you use DocuForge.
      </p>

      <h2>Information We Collect</h2>
      <p>
        We may collect basic account details such as email address and information required
        to provide the service. We also process the documents you upload to generate outputs
        (e.g., signed PDFs).
      </p>

      <h2>How We Use Information</h2>
      <p>
        We use information only to provide and improve our services, support users, and maintain
        security and fraud prevention.
      </p>

      <h2>Data Sharing</h2>
      <p>
        We do not sell your personal data. We do not share user data with third parties except
        where required for service operation (e.g., infrastructure providers) or legal compliance.
      </p>

      <h2>Security</h2>
      <p>
        We implement reasonable security measures to protect user data. However, no online system
        is 100% secure.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy requests, contact:{" "}
        <a href="mailto:support@docuforge.in">support@docuforge.in</a>
      </p>
    </LegalShell>
  );
}
