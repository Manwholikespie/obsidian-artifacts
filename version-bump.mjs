import { readFileSync, writeFileSync } from "node:fs";

// Usage: node version-bump.mjs patch|minor|major
//
// Bumps version in package.json, manifest.json, and versions.json.
// Does NOT commit or tag — you do that yourself so the tag has no
// `v` prefix (Obsidian requires bare version tags).

const level = process.argv[2];
if (!["patch", "minor", "major"].includes(level)) {
  console.error("Usage: node version-bump.mjs patch|minor|major");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const prev = pkg.version;
const [major, minor, patch] = prev.split(".").map(Number);

const next =
  level === "major"
    ? `${major + 1}.0.0`
    : level === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

// package.json
pkg.version = next;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

// manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = next;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

// versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[next] = minAppVersion;
writeFileSync("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

console.log(`${prev} → ${next}`);
