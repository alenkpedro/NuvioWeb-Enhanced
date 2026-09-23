import { MemberAccessRepository } from "../../data/remote/supabase/memberAccessRepository.js";
import { I18n } from "../../i18n/index.js";
import { renderBrandWordmarkImage } from "./brandWordmark.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tierLabel(tier) {
  return String(tier || "").trim() === "SUPPORTER_PLUS"
    ? I18n.t("supporters_level_supporter_plus", {}, { fallback: "Supporter+" })
    : I18n.t("supporters_level_supporter", {}, { fallback: "Supporter" });
}

export function renderMemberBrandWordmark({
  access = MemberAccessRepository.getCurrentAccess(),
  imageClass = "",
  wrapperClass = "",
  imageAlt = "Nuvio Enhanced"
} = {}) {
  const tier = String(access?.tier || "")
    .trim()
    .toUpperCase();
  const hasTier = tier === "SUPPORTER" || tier === "SUPPORTER_PLUS";
  const safeWrapperClass = wrapperClass ? ` ${escapeHtml(wrapperClass)}` : "";
  const imageClassSuffix = imageClass ? ` ${imageClass}` : "";
  const suffix = hasTier
    ? `<span class="member-brand-suffix member-brand-suffix-${tier.toLowerCase().replace(/_/g, "-")}">${escapeHtml(tierLabel(tier))}</span>`
    : "";
  const accessibleLabel = `${imageAlt}${hasTier ? ` ${tierLabel(tier)}` : ""}`;

  return `<span class="member-brand-wordmark${safeWrapperClass}" aria-label="${escapeHtml(accessibleLabel)}">
    ${renderBrandWordmarkImage({
      className: `member-brand-logo${imageClassSuffix}`,
      alt: imageAlt
    })}
    ${suffix}
  </span>`;
}
