import fs from "node:fs";
import vm from "node:vm";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "local.properties";

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/extract-public-runtime-env.mjs <nuvio.env.js> [output.properties]");
  process.exit(1);
}

const source = fs.readFileSync(inputPath, "utf8");

const extractByExecution = () => {
  const context = {
    __NUVIO_ENV__: {},
    window: null,
    globalThis: null
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 1000, filename: "nuvio.env.js" });
  return context.__NUVIO_ENV__ || {};
};

const extractByRegex = () => {
  const patterns = [
    /(?:var|let|const)\s+values\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:for\s*\(|Object\.)/,
    /__NUVIO_ENV__\s*=\s*(\{[\s\S]*?\})\s*;?$/m
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      // Keep trying. The execution path below/above is preferred.
    }
  }
  return {};
};

let values = {};
try {
  values = extractByExecution();
} catch (error) {
  console.warn(`Direct runtime evaluation failed: ${error.message}`);
}

if (!values || typeof values !== "object" || !Object.keys(values).length) {
  values = extractByRegex();
}

for (const requiredKey of ["NUVIO_SUPABASE_URL", "NUVIO_SUPABASE_ANON_KEY", "TV_LOGIN_WEB_BASE_URL"]) {
  if (!String(values?.[requiredKey] || "").trim()) {
    console.error(`Official runtime is missing required key: ${requiredKey}`);
    console.error(`Available runtime keys: ${Object.keys(values || {}).join(", ") || "none"}`);
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
