const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");

if (!fs.existsSync(envPath)) {
  console.log("Note: .env.local not found. Skipping validation (expected in CI/server environments).");
  process.exit(0);
}

const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (key) envVars[key.trim()] = rest.join("=").trim();
}

const required = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((key) => {
  const value = envVars[key];
  return !value || value === "" || value.startsWith("your_");
});

if (missing.length > 0) {
  console.error("Error: Missing required environment variables:");
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error("\nPlease add these to your .env.local file or set them in Vercel.");
  process.exit(1);
}

console.log("Environment validation passed.");