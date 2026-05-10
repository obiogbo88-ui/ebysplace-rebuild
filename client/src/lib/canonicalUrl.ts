export const CANONICAL_SITE_ORIGIN = "https://www.ebysplace.com";

export function canonicalUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_SITE_ORIGIN}${normalizedPath}`;
}

export function canonicalCurrentUrl(pathname: string, search = "", hash = "") {
  return canonicalUrl(`${pathname || "/"}${search || ""}${hash || ""}`);
}
