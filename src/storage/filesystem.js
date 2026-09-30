import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseNote } from "../core/markdown.js";

export const TIERS = ["inbox", "notes", "archive"];

function walkMarkdown(directory, found) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(fullPath, found);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(fullPath);
    }
  }
}

/** Absolute paths of Markdown notes under the three lifecycle tiers. */
export function listNotes(vaultDir) {
  const notes = [];
  for (const tier of TIERS) {
    walkMarkdown(path.join(vaultDir, tier), notes);
  }
  return notes.sort();
}

export function readNote(filePath) {
  return parseNote(readFileSync(filePath, "utf8"), filePath);
}

export function vaultStatus(vaultDir) {
  const notes = listNotes(vaultDir);
  const byTier = Object.fromEntries(TIERS.map((tier) => [tier, 0]));

  for (const notePath of notes) {
    const tier = path.relative(vaultDir, notePath).split(path.sep)[0];
    if (Object.hasOwn(byTier, tier)) byTier[tier] += 1;
  }

  return { vaultDir, total: notes.length, byTier };
}

export function formatStatus(status) {
  const lines = [
    "Mnemium",
    `Vault: ${status.vaultDir}`,
    `Notes: ${status.total}`,
  ];
  for (const tier of TIERS) {
    lines.push(`  ${tier}: ${status.byTier[tier]}`);
  }
  return lines.join("\n");
}
