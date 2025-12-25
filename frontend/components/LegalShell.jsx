// frontend/components/LegalShell.jsx
import SiteFooter from "./SiteFooter";

export default function LegalShell({ title, subtitle, children }) {
  return (
    <div className="legalWrap">
      <div className="legalContainer">
        <div className="legalCard">
          <div className="legalHeader">
            <div>
              <h1 className="legalTitle">{title}</h1>
              {subtitle ? <p className="legalSubtitle">{subtitle}</p> : null}
            </div>
          </div>

          <div className="legalDivider" />
          <div className="legalText">{children}</div>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
