import { createNote } from "./note.js";

/**
 * Split a Markdown document into raw frontmatter lines and a body.
 * Recognizes a leading `---` block only. Values stay strings.
 */
export function splitFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { fields: {}, body: text };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { fields: {}, body: text };
  }

  const fields = {};
  for (const line of lines.slice(1, end)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) fields[key] = value;
  }

  return { fields, body: lines.slice(end + 1).join("\n").replace(/^\n/, "") };
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseTags(value) {
  if (!value || value === "[]") return [];
  const inner = value.replace(/^\[/, "").replace(/\]$/, "");
  return inner
    .split(",")
    .map((tag) => unquote(tag.trim()))
    .filter(Boolean);
}

/** Parse the template frontmatter (`id`, `title`, `date`, `tags`) into a note. */
export function parseNote(text, path = null) {
  const { fields, body } = splitFrontmatter(text);
  return createNote({
    id: unquote(fields.id ?? ""),
    title: unquote(fields.title ?? ""),
    date: unquote(fields.date ?? ""),
    tags: parseTags(fields.tags),
    body,
    path,
  });
}
