const routes = [
  "/",
  "/services",
  "/booking",
  "/shop",
  "/gallery",
  "/ai-try-on",
  "/braiders-near-me",
  "/reviews",
  "/admin",
  "/privacy",
  "/shopping-policy",
  "/returns-policy",
  "/terms",
  "/smoke-test-missing-image.png",
];

const base = "http://localhost:3000";
let failures = 0;
for (const route of routes) {
  try {
    const response = await fetch(`${base}${route}`, { redirect: "manual" });
    const contentType = response.headers.get("content-type") ?? "";
    console.log(`${route.padEnd(48)} ${response.status} ${contentType}`);
    if (response.status >= 500) failures += 1;
  } catch (error) {
    failures += 1;
    console.log(`${route.padEnd(48)} ERROR ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
