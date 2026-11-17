import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  addExcerpt,
  configuredVault,
  createTopic,
  ensureVault,
  listTopics,
  searchTopics,
  showTopic,
  slugify,
  writeConfig,
} from "../scripts/vault.js";

function tempVault() {
  return ensureVault(mkdtempSync(path.join(tmpdir(), "mnemium-")));
}

test("slugify turns a title into a topic id", () => {
  assert.equal(slugify("Grocery API"), "grocery-api");
});

test("topic creates a skeleton and catalog and graph nodes", () => {
  const vault = tempVault();
  const topic = createTopic(vault, "Grocery API");

  assert.equal(topic.id, "grocery-api");
  assert.equal(topic.path, "topics/grocery-api");
  const listed = listTopics(vault);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].title, "Grocery API");
  assert.deepEqual(JSON.parse(readFileSync(path.join(vault, "graph.json"), "utf8")).nodes.map((node) => node.id), ["grocery-api"]);
  const note = readFileSync(path.join(vault, "topics/grocery-api/note.md"), "utf8");
  assert.match(note, /title: Grocery API/);
  assert.equal(readFileSync(path.join(vault, "topics/grocery-api/index.json"), "utf8").includes('"summary": ""'), true);
});

test("a second topic with the same name is refused", () => {
  const vault = tempVault();
  createTopic(vault, "Grocery API");
  assert.throws(() => createTopic(vault, "Grocery API"), /already exists/);
});

test("text, diagram, and asset excerpts land in the topic and update the indexes", () => {
  const vault = tempVault();
  createTopic(vault, "Grocery API");
  createTopic(vault, "Auth");
  const source = path.join(vault, "spec.pdf");
  writeFileSync(source, "pdf");

  const text = addExcerpt(vault, { topic: "grocery-api", kind: "text", body: "Need a list endpoint. See [[Auth]]." });
  const diagram = addExcerpt(vault, { topic: "grocery-api", kind: "diagram", body: "flowchart LR\n  cart --> pay" });
  const asset = addExcerpt(vault, { topic: "grocery-api", kind: "asset", file: source });

  assert.deepEqual(text.links, ["auth"]);
  assert.equal(diagram.links.length, 0);
  assert.equal(asset.asset, "spec.pdf");

  const note = readFileSync(path.join(vault, "topics/grocery-api/note.md"), "utf8");
  assert.match(note, /Need a list endpoint/);
  assert.match(note, /```mermaid\nflowchart LR/);
  assert.match(note, /\[spec\.pdf\]\(assets\/spec\.pdf\)/);
  assert.equal(readFileSync(path.join(vault, "topics/grocery-api/assets/spec.pdf"), "utf8"), "pdf");

  const index = JSON.parse(readFileSync(path.join(vault, "topics/grocery-api/index.json"), "utf8"));
  assert.deepEqual(index.links, ["auth"]);
  assert.ok(index.terms.includes("endpoint"));
  assert.match(index.summary, /list endpoint/);
  const graph = JSON.parse(readFileSync(path.join(vault, "graph.json"), "utf8"));
  assert.deepEqual(graph.edges, [{ from: "grocery-api", to: "auth" }]);

  addExcerpt(vault, { topic: "grocery-api", kind: "text", body: "Again [[Auth]]" });
  const again = JSON.parse(readFileSync(path.join(vault, "graph.json"), "utf8"));
  assert.equal(again.edges.length, 1);
});

test("search ranks the title and returns no note body", () => {
  const vault = tempVault();
  createTopic(vault, "Grocery API");
  createTopic(vault, "Garden plan");
  addExcerpt(vault, { topic: "grocery-api", kind: "text", body: "Need a list endpoint" });

  const results = searchTopics(vault, "grocery endpoint");
  assert.equal(results[0].id, "grocery-api");
  assert.equal(results.some((result) => result.id === "garden-plan"), false);
  assert.equal("note" in results[0], false);
});

test("show reads one topic after a caller decides to open it", () => {
  const vault = tempVault();
  createTopic(vault, "Grocery API");
  const shown = showTopic(vault, "grocery-api");
  assert.match(shown.note, /# Grocery API/);
  assert.match(shown.skill, /## Context/);
});

test("config remembers a vault path and ignores a missing folder", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mnemium-config-"));
  const configPath = path.join(dir, "config.json");
  const vault = tempVault();
  writeConfig(configPath, vault);
  assert.equal(configuredVault(configPath), vault);
  writeConfig(configPath, path.join(dir, "missing"));
  assert.equal(configuredVault(configPath), null);
});

test("the cli writes json for a topic", () => {
  const vault = tempVault();
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/mn.js");
  const result = spawnSync(process.execPath, [script, "topic", "--name", "Grocery API", "--vault", vault], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.topic.id, "grocery-api");
});
