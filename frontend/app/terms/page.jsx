// frontend/app/terms/page.jsx
import LegalShell from "../../components/LegalShell";


export const metadata = {
  title: "Terms & Conditions - DocuForge",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" subtitle="Last updated: December 2025">
      <p>
        DocuForge provides online document signing and PDF-related digital services.
        By accessing or using our website and services, you agree to these terms.
      </p>

      <h2>Digital Service</h2>
      <p>
        Our services are delivered digitally. You are responsible for ensuring the
        information and documents you upload are accurate and lawful.
      </p>

      <h2>User Responsibilities</h2>
      <p>
        You agree not to use the service for illegal activities, infringement, fraud,
        or uploading content that violates applicable laws or third-party rights.
      </p>

      <h2>Account & Access</h2>
      <p>
        We may suspend or terminate access if we reasonably believe there is misuse,
        suspicious activity, or policy violations.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, DocuForge is not liable for indirect,
        incidental, or consequential damages arising from use of the service.
      </p>

      <h2>Contact</h2>
      <p>
        For questions, contact:{" "}
        <a href="mailto:support@docuforge.in">support@docuforge.in</a>
      </p>
    </LegalShell>
  );
}
