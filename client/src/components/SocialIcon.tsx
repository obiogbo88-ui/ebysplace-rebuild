import { SOCIAL_ICONS, type SocialBrand } from "@shared/socialIcons";

/**
 * A social network's official logo. `tone="brand"` uses the brand's own
 * colour (Instagram gets its official gradient); `tone="current"` follows the
 * text colour, for dark or coloured buttons.
 */
export function SocialIcon({ brand, size = 16, tone = "brand", className, title }: { brand: SocialBrand; size?: number; tone?: "brand" | "current" | "white"; className?: string; title?: string }) {
  const icon = SOCIAL_ICONS[brand];
  const gradientId = `si-ig-${size}`;
  const fill = tone === "current" ? "currentColor" : tone === "white" ? "#FFFFFF" : brand === "instagram" ? `url(#${gradientId})` : icon.hex;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {tone === "brand" && brand === "instagram" ? (
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
            <stop offset="0" stopColor="#FDF497" />
            <stop offset="0.05" stopColor="#FDF497" />
            <stop offset="0.45" stopColor="#FD5949" />
            <stop offset="0.6" stopColor="#D6249F" />
            <stop offset="0.9" stopColor="#285AEB" />
          </radialGradient>
        </defs>
      ) : null}
      <path d={icon.path} fill={fill} />
    </svg>
  );
}
