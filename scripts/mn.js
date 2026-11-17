#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  addExcerpt,
  configuredVault,
  createTopic,
  defaultConfigPath,
  ensureVault,
  listTopics,
  searchTopics,
  showTopic,
  writeConfig,
} from "./vault.js";

const HELP = `mn — Mnemium vault

  node scripts/mn.js ensure [--vault DIR]
  node scripts/mn.js topic --name TITLE [--vault DIR]
  node scripts/mn.js excerpt --topic ID --kind text|diagram|asset [--body TEXT] [--file PATH] [--vault DIR]
  node scripts/mn.js list [--vault DIR]
  node scripts/mn.js search --query TEXT [--vault DIR]
  node scripts/mn.js show --topic ID [--vault DIR]
`;

export function run(argv) {
  const { command, opts } = parseArgs(argv);
  if (!command || command === "help" || opts.help) return { ok: true, help: HELP.trim() };

  const vault = resolveVault(command, opts);
  if (command === "ensure") {
    ensureVault(vault);
    return { ok: true, action: "ensure", vault };
  }
  if (command === "topic") {
    const topic = createTopic(vault, opts.name || "");
    return { ok: true, action: "topic", vault, topic };
  }
  if (command === "excerpt") {
    const excerpt = addExcerpt(vault, {
      topic: opts.topic,
      kind: opts.kind,
      body: opts.body || "",
      file: opts.file,
    });
    return { ok: true, action: "excerpt", vault, ...excerpt };
  }
  if (command === "list") {
    return { ok: true, action: "list", vault, topics: listTopics(vault) };
  }
  if (command === "search") {
    return { ok: true, action: "search", vault, results: searchTopics(vault, opts.query || "") };
  }
  if (command === "show") {
    return { ok: true, action: "show", vault, topic: showTopic(vault, opts.topic) };
  }
  throw new Error(`Unknown command: ${command || "(none)"}\n\n${HELP}`);
}

function resolveVault(command, opts) {
  if (opts.vault) return ensureVault(opts.vault);
  const configPath = opts.config || defaultConfigPath();
  const saved = configuredVault(configPath);
  if (saved) return saved;
  if (command !== "ensure") {
    throw new Error("No Mnemium vault is configured. Run: node scripts/mn.js ensure");
  }
  const picked = chooseFolder();
  const vault = ensureVault(picked);
  writeConfig(configPath, vault);
  return vault;
}

function chooseFolder() {
  if (process.platform !== "darwin") {
    throw new Error("No Mnemium vault is configured. Run: node scripts/mn.js ensure --vault /path/to/Mnemium");
  }
  const start = [
    path.join(os.homedir(), "Library/CloudStorage/OneDrive-Personal"),
    path.join(os.homedir(), "OneDrive"),
    os.homedir(),
  ].find((candidate) => existsSync(candidate));
  const prompt = "Choose or create the Mnemium folder. Notes are stored only in this folder.";
  try {
    const picked = execFileSync(
      "osascript",
      [
        "-e",
        `on run argv
          set startFolder to POSIX file (item 1 of argv)
          set picked to choose folder with prompt (item 2 of argv) default location startFolder
          return POSIX path of picked
        end run`,
        "--",
        start,
        prompt,
      ],
      { encoding: "utf8" },
    );
    return picked.trim();
  } catch (error) {
    const text = `${error.stderr || ""} ${error.message || ""}`;
    if (text.includes("User canceled") || text.includes("-128")) {
      throw new Error("Folder selection canceled. No vault was saved.");
    }
    throw new Error("Could not open the folder dialog. Run: node scripts/mn.js ensure --vault /path/to/Mnemium");
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) opts[key] = true;
    else {
      opts[key] = next;
      i += 1;
    }
  }
  return { command, opts };
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    console.log(JSON.stringify(run(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }
}
