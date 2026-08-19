import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "local.properties";

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/extract-public-runtime-env.mjs <nuvio.env.js> [output.properties]");
  process.exit(1);
}

const source = fs.readFileSync(inputPath, "utf8");
const match = source.match(/var\s+values\s*=\s*(\{[\s\S]*?\});\s*for\s*\(/);
if (!match) {
  console.error("Unable to locate runtime values in official nuvio.env.js");
  process.exit(1);
}

let values;
try {
  values = JSON.parse(match[1]);
} catch (error) {
  console.error("Unable to parse official runtime values:", error.message);
  process.exit(1);
}

for (const requiredKey of ["NUVIO_SUPABASE_URL", "NUVIO_SUPABASE_ANON_KEY", "TV_LOGIN_WEB_BASE_URL"]) {
  if (!String(values[requiredKey] || "").trim()) {
    console.error(`Official runtime is missing required key: ${requiredKey}`);
    process.exit(1);
  }
}

const escapeProperty = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n");

const properties = Object.entries(values)
  .map(([key, value]) => `${key}=${escapeProperty(value)}`)
  .join("\n");

fs.writeFileSync(outputPath, `${properties}\n`, "utf8");
console.log(`Wrote ${Object.keys(values).length} public runtime properties to ${outputPath}`);
