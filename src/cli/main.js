#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatStatus, vaultStatus } from "../storage/filesystem.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function main(env = process.env) {
  const configured = env.MNEMIUM_VAULT || "vault";
  const vaultDir = path.resolve(repoRoot, configured);
  console.log(formatStatus(vaultStatus(vaultDir)));
}

main();
