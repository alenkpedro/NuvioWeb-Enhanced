import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ipkPath = process.argv[2];
if (!ipkPath || !fs.existsSync(ipkPath)) {
  console.error("Usage: node scripts/generate-webosbrew.mjs <path-to-ipk>");
  process.exit(1);
}

const appinfo = JSON.parse(fs.readFileSync("appinfo.json", "utf8"));
const data = fs.readFileSync(ipkPath);
const sha256 = crypto.createHash("sha256").update(data).digest("hex");
const size = data.length;
const filename = path.basename(ipkPath);
const [owner = "alenkpedro", repo = "NuvioWeb-Enhanced"] = String(
  process.env.GITHUB_REPOSITORY || "alenkpedro/NuvioWeb-Enhanced"
).split("/");
const tag = process.env.RELEASE_TAG || "webos-latest";
const sourceUrl = `https://github.com/${owner}/${repo}`;
const ipkUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${filename}`;
const iconUri = `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/images/icon.png`;

const output = {
  paging: { page: 1, count: 1, maxPage: 1, itemsTotal: 1 },
  packages: [
    {
      id: appinfo.id,
      title: "Nuvio TV Enhanced",
      iconUri,
      manifest: {
        id: appinfo.id,
        version: appinfo.version,
        type: appinfo.type || "web",
        title: "Nuvio TV Enhanced",
        appDescription:
          "Enhanced LG webOS build based on NuvioWeb with TV-focused optimisations inspired by ysosrs123/NuvioTV-Fork.",
        iconUri,
        sourceUrl,
        rootRequired: false,
        ipkUrl,
        ipkHash: { sha256 },
        ipkSize: size
      },
      pool: "main",
      shortDescription: "Enhanced Nuvio build for LG webOS."
    }
  ]
};

fs.mkdirSync("webosbrew", { recursive: true });
fs.writeFileSync("webosbrew/apps.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated webosbrew/apps.json for ${filename}`);
console.log(`sha256=${sha256}`);
console.log(`size=${size}`);
