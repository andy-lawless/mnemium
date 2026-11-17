---
name: mn
description: >-
  Saves and recalls Mnemium notes in a cloud-drive folder. Use when the user
  types /mn, says mnemium or second brain, asks to remember, capture, or file a
  note, excerpt, diagram, or asset, asks to find or check saved notes, or when
  the conversation produces something worth keeping or may be answered from a
  saved topic.
---

# mn

Mnemium stores notes in one cloud-drive folder. Each topic is a folder. `scripts/mn.js` in this skill's directory is the only writer. Run it by its file path. The working directory may be the user's project.

## 1. Resolve the vault

Run `node <skill-dir>/scripts/mn.js ensure`.

Done when the command prints `"ok": true` and a `vault` path.

The first run opens a macOS folder dialog starting in OneDrive. Tell the user to choose or create the Mnemium folder. Google Drive and iCloud are valid when they navigate there in that dialog. A cancel stops the command and saves nothing. On a later run the path in `~/.config/mnemium/config.json` is reused.

## 2. Choose one branch

- `/mn topic <name>`: create a topic.
- `/mn` plus text, a diagram, or a file: add an excerpt.
- The user asked to recall, search, or check notes, or `/mn` is a question: recall.
- This skill loaded because the conversation produced something worth keeping, and the user did not ask to save: propose a save.
- This skill loaded because a saved topic might answer the conversation: recall.

Done when one branch is selected.

## 3. Confirm

Create topic: use the name the user typed. That name is the confirmation.

Add excerpt: run `list`, show the likely topics, and ask which topic receives the excerpt. Create a topic when the user names a new one. Write after they answer.

Propose a save: one proposal. Name the topic and the excerpt. Write after the user accepts. On accept, create the topic when it is new, then add the excerpt.

Recall: run `search`. Results are titles, terms, and summaries. Read a note when the user asked to check or use their notes, or when they accept your ask. When several topics match, ask which one to open. When the user declines, answer from the conversation.

Done when the write is approved, or the recall is cleared to read.

## 4. Write or read

Create:

`node <skill-dir>/scripts/mn.js topic --name "Title"`

Excerpt:

`node <skill-dir>/scripts/mn.js excerpt --topic <id> --kind text --body "..."`

`node <skill-dir>/scripts/mn.js excerpt --topic <id> --kind diagram --body "..."`

`node <skill-dir>/scripts/mn.js excerpt --topic <id> --kind asset --file "/absolute/path"`

Use `diagram` when the user asks for a diagram or the excerpt is Mermaid. Use `asset` when the user gives a file. Use `text` otherwise. Relate this topic to another by writing `[[topic-id]]` in the body.

Read:

`node <skill-dir>/scripts/mn.js search --query "..."`

`node <skill-dir>/scripts/mn.js show --topic <id>`

Open the single topic the user chose. `show` is the read.

Done when the script prints `"ok": true`.

## 5. Report

Tell the user the topic id, the vault path, and what changed. For a recall, answer from the note and name the topic.

Done when the user has that result.

## Layout

```
<vault>/catalog.json
<vault>/graph.json
<vault>/topics/<id>/note.md
<vault>/topics/<id>/skill.md
<vault>/topics/<id>/index.json
<vault>/topics/<id>/assets/
```

`note.md` holds the writing. `skill.md` is context for this topic. `index.json` is the note's own terms, summary, and links. `catalog.json` lists every topic. `graph.json` links topics that mention each other with `[[topic-id]]`. The vault folder is the only copy.
