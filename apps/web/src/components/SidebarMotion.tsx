import { ShieldCheck } from "lucide-react";
// Add a quiet decorative illustration of evidence converging on human review.
export function SidebarMotion() {
  return (
    <div className="sidebar-assurance" aria-hidden="true">
      <svg viewBox="0 0 180 160" fill="none">
        <ellipse
          cx="90"
          cy="118"
          rx="65"
          ry="22"
          stroke="currentColor"
          strokeOpacity=".12"
        />
        <ellipse
          cx="90"
          cy="118"
          rx="42"
          ry="14"
          stroke="currentColor"
          strokeOpacity=".18"
        />
        <path
          d="M30 51L90 27L150 51L90 76L30 51Z"
          stroke="currentColor"
          strokeOpacity=".2"
        />
        <path
          className="assurance-layer"
          d="M30 66L90 42L150 66L90 91L30 66Z"
          stroke="currentColor"
          strokeOpacity=".35"
        />
        <path
          d="M30 81L90 57L150 81L90 106L30 81Z"
          stroke="currentColor"
          strokeOpacity=".18"
        />
        <path
          d="M30 51V81M150 51V81M90 76V106"
          stroke="currentColor"
          strokeOpacity=".12"
          strokeDasharray="2 4"
        />
        <path d="M90 106V118" stroke="currentColor" strokeOpacity=".3" />
        <circle
          className="assurance-point point-left"
          cx="30"
          cy="66"
          r="2"
          fill="currentColor"
        />
        <circle
          className="assurance-point point-right"
          cx="150"
          cy="66"
          r="2"
          fill="currentColor"
        />
        <circle cx="90" cy="118" r="3" fill="currentColor" fillOpacity=".45" />
      </svg>
      <span className="assurance-check">
        <ShieldCheck size={23} strokeWidth={1.2} />
      </span>
    </div>
  );
}
