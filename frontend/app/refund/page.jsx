// frontend/app/refund/page.jsx
import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Refund & Cancellation Policy - DocuForge",
};

export default function RefundPage() {
  return (
    <LegalShell
      title="Refund & Cancellation Policy"
      subtitle="Last updated: December 2025"
    >
      <p>
        DocuForge provides digital services. Refunds are applicable only in cases where
        the service was not delivered due to a verified technical failure.
      </p>

      <h2>Refund Eligibility</h2>
      <p>
        Refund requests must be raised within 7 days of purchase. If approved, refunds will
        be processed within 5–7 business days to the original payment method.
      </p>

      <h2>Non-Refundable Cases</h2>
      <p>
        No refunds will be provided for successfully delivered digital services, partial usage,
        or cases where the service has been used as intended.
      </p>

      <h2>How to Request a Refund</h2>
      <p>
        Email{" "}
        <a href="mailto:support@docuforge.in">support@docuforge.in</a> with your order details and issue description.
      </p>
    </LegalShell>
  );
}
