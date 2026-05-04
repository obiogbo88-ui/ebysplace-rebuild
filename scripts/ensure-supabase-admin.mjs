import process from "node:process";

const adminEmail = (process.env.EBYSPLACE_ADMIN_EMAIL || "info@ebysplace.com").trim().toLowerCase();
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function request(path, init = {}) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed the admin account.");
  }
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = json?.msg || json?.message || `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = json;
    throw error;
  }
  return json;
}

const password = await readStdin();
if (!password || password.length < 8) throw new Error("A Supabase admin password with at least 8 characters must be provided on stdin.");

const users = await request(`/admin/users?per_page=100&page=1`, { method: "GET" });
const existing = Array.isArray(users?.users) ? users.users.find((user) => user.email?.toLowerCase() === adminEmail) : null;

if (existing?.id) {
  await request(`/admin/users/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { name: "Eby’s Place Admin", role: "admin" },
      app_metadata: { role: "admin" },
    }),
  });
  console.log(JSON.stringify({ ok: true, action: "updated", email: adminEmail, userId: existing.id }));
} else {
  const created = await request(`/admin/users`, {
    method: "POST",
    body: JSON.stringify({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { name: "Eby’s Place Admin", role: "admin" },
      app_metadata: { role: "admin" },
    }),
  });
  console.log(JSON.stringify({ ok: true, action: "created", email: adminEmail, userId: created?.id || created?.user?.id || null }));
}
