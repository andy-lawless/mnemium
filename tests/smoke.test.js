import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatStatus, vaultStatus } from "../src/index.js";

const vaultDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../vault",
);

test("vault status reports a note count", () => {
  const status = vaultStatus(vaultDir);
  const report = formatStatus(status);

  assert.equal(typeof status.total, "number");
  assert.ok(status.total >= 0);
  assert.deepEqual(Object.keys(status.byTier).sort(), [
    "archive",
    "inbox",
    "notes",
  ]);
  assert.match(report, /Notes: \d+/);
});
