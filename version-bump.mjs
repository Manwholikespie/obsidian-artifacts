import { readFileSync, writeFileSync } from "node:fs";

// Sync manifest.json `version` with the new package.json version, and
// append an entry to versions.json that maps the new version to the
// current minAppVersion from manifest.json.
//
// Triggered automatically by the `version` script when you run
// `bun pm version patch|minor|major` or `npm version …`.

// bun doesn't set npm_package_version in lifecycle scripts, so read
// the version directly from package.json (which bun has already bumped
// by the time the `version` script runs).
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const targetVersion = process.env.npm_package_version || pkg.version;

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, "\t")}\n`);

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (versions[targetVersion] !== minAppVersion) {
  versions[targetVersion] = minAppVersion;
  writeFileSync("versions.json", `${JSON.stringify(versions, null, "\t")}\n`);
}
