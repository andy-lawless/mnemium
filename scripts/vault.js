import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const TOPIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STOP = new Set("a an the and or of to in on for with is it this that be as at by from are was were via".split(" "));

export function defaultConfigPath() {
  return path.join(os.homedir(), ".config", "mnemium", "config.json");
}

export function slugify(name) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Topic name must contain a letter or number");
  return slug;
}

export function ensureVault(vaultDir) {
  const root = path.resolve(vaultDir);
  mkdirSync(path.join(root, "topics"), { recursive: true });
  writeIfMissing(path.join(root, "catalog.json"), { topics: [] });
  writeIfMissing(path.join(root, "graph.json"), { nodes: [], edges: [] });
  return root;
}

export function readConfig(configPath) {
  if (!existsSync(configPath)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new Error(`Invalid config: ${configPath}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Invalid config: ${configPath}`);
  }
  return data;
}

export function configuredVault(configPath) {
  const config = readConfig(configPath);
  if (!config?.vault || typeof config.vault !== "string") return null;
  if (!existsSync(config.vault)) return null;
  return config.vault;
}

export function writeConfig(configPath, vaultDir) {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify({ vault: path.resolve(vaultDir) }, null, 2)}\n`);
}

export function createTopic(vaultDir, name) {
  const root = ensureVault(vaultDir);
  const title = name.trim();
  if (!title) throw new Error("Topic name must contain a letter or number");
  const id = slugify(title);
  const topicDir = path.join(root, "topics", id);
  if (existsSync(topicDir)) throw new Error(`Topic already exists: ${id}`);

  const now = new Date();
  mkdirSync(path.join(topicDir, "assets"), { recursive: true });
  writeFileSync(path.join(topicDir, "note.md"), noteSkeleton(id, title, now));
  writeFileSync(path.join(topicDir, "skill.md"), skillSkeleton(id, title));
  const index = {
    id,
    title,
    summary: "",
    terms: terms(title),
    links: [],
    assets: [],
    updated: now.toISOString(),
  };
  writeJson(path.join(topicDir, "index.json"), index);
  upsertCatalog(root, index);
  upsertNode(root, index);
  return { id, title, path: path.posix.join("topics", id) };
}

export function addExcerpt(vaultDir, { topic, kind, body = "", file }) {
  const root = ensureVault(vaultDir);
  const id = requireTopic(root, topic);
  const topicDir = path.join(root, "topics", id);
  const index = readJson(path.join(topicDir, "index.json"));
  const now = new Date();
  const heading = stamp(now);

  let snippet = "";
  let assetName = null;
  let block = "";

  if (kind === "text") {
    const prose = body.trim();
    if (!prose) throw new Error("Text excerpt is empty");
    snippet = collapse(prose).slice(0, 180);
    block = `### ${heading}\n\n${prose}\n`;
  } else if (kind === "diagram") {
    const source = body.trim();
    if (!source) throw new Error("Diagram excerpt is empty");
    const firstLine = source.replace(/```mermaid|```/g, "").trim().split("\n")[0] || "diagram";
    snippet = `Diagram: ${collapse(firstLine).slice(0, 80)}`;
    const fenced = /```mermaid[\s\S]*```/.test(source)
      ? source
      : `\`\`\`mermaid\n${source}\n\`\`\``;
    block = `### ${heading} diagram\n\n${fenced}\n`;
  } else if (kind === "asset") {
    if (!file) throw new Error("Asset excerpt needs a file");
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Asset not found: ${file}`);
    assetName = uniqueAssetName(path.join(topicDir, "assets"), safeBasename(file));
    copyFileSync(file, path.join(topicDir, "assets", assetName));
    snippet = `Asset: ${assetName}`;
    block = `### ${heading} asset\n\n[${assetName}](assets/${assetName})\n`;
  } else {
    throw new Error("Excerpt kind must be text, diagram, or asset");
  }

  const notePath = path.join(topicDir, "note.md");
  const note = readFileSync(notePath, "utf8");
  const withHeading = note.includes("\n## Excerpts\n") ? note : `${note.trimEnd()}\n\n## Excerpts\n`;
  writeFileSync(notePath, `${withHeading.trimEnd()}\n\n${block}`);

  const catalog = readJson(path.join(root, "catalog.json"));
  const linked = resolveLinks(`${body}`, catalog.topics, id);
  index.summary = extendSummary(index.summary, snippet);
  index.terms = mergeTerms(index.title, index.terms, snippet);
  index.links = [...new Set([...index.links, ...linked.links])];
  if (assetName) index.assets = [...new Set([...index.assets, assetName])];
  index.updated = now.toISOString();
  writeJson(path.join(topicDir, "index.json"), index);

  const skillPath = path.join(topicDir, "skill.md");
  writeFileSync(skillPath, setContext(readFileSync(skillPath, "utf8"), index.summary));
  upsertCatalog(root, index);
  upsertNode(root, index);
  addEdges(root, id, linked.links);

  return { id, kind, links: linked.links, unlinked: linked.unlinked, asset: assetName };
}

export function listTopics(vaultDir) {
  const root = ensureVault(vaultDir);
  const catalog = readJson(path.join(root, "catalog.json"));
  return [...catalog.topics].sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

export function searchTopics(vaultDir, query) {
  const topics = listTopics(vaultDir).map((topic) => ({
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    terms: topic.terms,
  }));
  const tokens = terms(query);
  if (tokens.length === 0) return topics.map((topic) => ({ ...topic, score: 0 }));

  return topics
    .map((topic) => {
      const title = topic.title.toLowerCase();
      const summary = topic.summary.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (title.includes(token)) score += 3;
        if (topic.terms.some((term) => term.includes(token))) score += 2;
        if (summary.includes(token)) score += 1;
      }
      return { ...topic, score };
    })
    .filter((topic) => topic.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function showTopic(vaultDir, topic) {
  const root = ensureVault(vaultDir);
  const id = requireTopic(root, topic);
  const topicDir = path.join(root, "topics", id);
  const assets = readdirSync(path.join(topicDir, "assets")).filter((name) => !name.startsWith("."));
  return {
    id,
    title: readJson(path.join(topicDir, "index.json")).title,
    note: readFileSync(path.join(topicDir, "note.md"), "utf8"),
    skill: readFileSync(path.join(topicDir, "skill.md"), "utf8"),
    index: readJson(path.join(topicDir, "index.json")),
    assets,
  };
}

function requireTopic(root, topic) {
  const id = String(topic || "");
  if (!TOPIC_ID.test(id)) throw new Error(`Unknown topic: ${id}`);
  if (!existsSync(path.join(root, "topics", id, "note.md"))) throw new Error(`Unknown topic: ${id}`);
  return id;
}

function noteSkeleton(id, title, now) {
  const day = stamp(now).slice(0, 10);
  return `---
id: ${id}
title: ${title}
date: ${day}
tags: []
---

# ${title}
`;
}

function skillSkeleton(id, title) {
  return `---
name: ${id}
description: Context for the ${title} topic. Use when an agent is working with this note.
---

# ${title}

Read note.md and assets/ before using this topic. Related topics are in the vault link index. Ask the user before pulling this note into a conversation.

## Context

Skeleton topic. No excerpts yet.
`;
}

function setContext(skillText, summary) {
  const marker = "## Context\n";
  const body = summary.trim() || "Skeleton topic. No excerpts yet.";
  const block = `${marker}\n${body}\n`;
  const at = skillText.indexOf(marker);
  if (at === -1) return `${skillText.trimEnd()}\n\n${block}`;
  return skillText.slice(0, at) + block;
}

function resolveLinks(text, topics, selfId) {
  const labels = [...text.matchAll(/\[\[([^\]\n]+)\]\]/g)].map((match) => match[1].trim());
  const links = [];
  const unlinked = [];
  for (const label of labels) {
    const id = topics.find((topic) => topic.id === label || topic.id === slugifySafe(label) || topic.title.toLowerCase() === label.toLowerCase())?.id;
    if (id === selfId) continue;
    if (!id) {
      if (label) unlinked.push(label);
      continue;
    }
    if (!links.includes(id)) links.push(id);
  }
  return { links, unlinked };
}

function slugifySafe(label) {
  try {
    return slugify(label);
  } catch {
    return "";
  }
}

function upsertCatalog(root, index) {
  const catalog = readJson(path.join(root, "catalog.json"));
  const entry = {
    id: index.id,
    title: index.title,
    summary: index.summary,
    terms: index.terms,
    updated: index.updated,
  };
  const existing = catalog.topics.findIndex((topic) => topic.id === index.id);
  if (existing === -1) catalog.topics.push(entry);
  else catalog.topics[existing] = entry;
  writeJson(path.join(root, "catalog.json"), catalog);
}

function upsertNode(root, index) {
  const graph = readJson(path.join(root, "graph.json"));
  const node = { id: index.id, title: index.title, terms: index.terms };
  const existing = graph.nodes.findIndex((item) => item.id === index.id);
  if (existing === -1) graph.nodes.push(node);
  else graph.nodes[existing] = node;
  writeJson(path.join(root, "graph.json"), graph);
}

function addEdges(root, from, links) {
  const graph = readJson(path.join(root, "graph.json"));
  for (const to of links) {
    if (!graph.edges.some((edge) => edge.from === from && edge.to === to)) {
      graph.edges.push({ from, to });
    }
  }
  writeJson(path.join(root, "graph.json"), graph);
}

function terms(text) {
  return [...new Set((text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? []))].filter((word) => !STOP.has(word));
}

function mergeTerms(title, previous, snippet) {
  const merged = [];
  for (const term of [...terms(title), ...previous, ...terms(snippet)]) {
    if (!merged.includes(term)) merged.push(term);
  }
  return merged.slice(0, 40);
}

function extendSummary(previous, snippet) {
  const next = [previous, snippet].filter(Boolean).join("\n");
  if (next.length <= 1000) return next;
  return next.slice(next.length - 1000);
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

function stamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeBasename(filePath) {
  const base = path.basename(filePath).replace(/[^\w.\- ]+/g, "_").trim();
  if (!base || base === "." || base === "..") return "asset";
  return base;
}

function uniqueAssetName(directory, name) {
  if (!existsSync(path.join(directory, name))) return name;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${stem}-${n}${ext}`;
    if (!existsSync(path.join(directory, candidate))) return candidate;
  }
  throw new Error(`Could not store asset ${name}`);
}

function writeIfMissing(file, value) {
  if (!existsSync(file)) writeJson(file, value);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
