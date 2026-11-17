# Mnemium

Mnemium is a skill named `mn`. In a chat you file a note into a folder on OneDrive, Google Drive, or iCloud. In a later chat the agent can search that folder and bring the note back. The walkthrough below is the whole product.

## Install

Requires Node.js 18 or newer. The agent runs `scripts/mn.js` whenever it saves or searches notes. This directory is the skill. Put it where the agent loads skills.

On macOS:

```sh
ln -sfn "$PWD" "$HOME/.cursor/skills/mn"
ln -sfn "$PWD" "$HOME/.claude/skills/mn"
```

On Windows, copy this directory to `%USERPROFILE%\.cursor\skills\mn` (and `%USERPROFILE%\.claude\skills\mn` when Claude is installed). A directory symlink to the repo works too.

A new chat can call `/mn`. An agent can also load the skill when the conversation is worth saving or a saved topic might answer it.

## First run

On macOS:

```sh
node scripts/mn.js ensure
```

This opens a folder dialog starting in OneDrive. Choose an existing folder or create `Mnemium` there. Google Drive and iCloud are valid if you navigate to them in that dialog. Canceling saves nothing.

On Windows the dialog is unavailable. Point the vault at a OneDrive folder directly:

```bat
node scripts/mn.js ensure --vault "%USERPROFILE%\OneDrive\Mnemium"
```

Use a Google Drive path the same way when that is the cloud folder. The skill writes notes only in the folder you pick and remembers the path in `~/.config/mnemium/config.json` (`%USERPROFILE%\.config\mnemium\config.json` on Windows). If that folder later disappears, the next `ensure` asks again.

## A worked example

You are designing a small grocery API and you want the decisions to survive this chat.

**Start a topic.** You type:

```
/mn topic Grocery API
```

The agent creates a folder named `topics/grocery-api/` in the cloud folder from the first run. Inside it, `note.md` is an empty note titled Grocery API. That folder is the topic. Later excerpts are added to it. The agent also writes `skill.md`, which tells a future agent to read this note before using it, and `index.json`, which is still empty of excerpts.

**File a decision.** After you work out the list endpoint, you type:

```
/mn the list endpoint returns items for one store
```

The agent checks the topics you already have and asks: "Add this to Grocery API?" You say yes. It appends the sentence to `note.md`:

```markdown
## Excerpts

### 2026-11-17 09:20

the list endpoint returns items for one store
```

It then records the words `list`, `endpoint`, `items`, and `store` in `index.json`, and adds Grocery API to `catalog.json` at the top of the vault. Search uses those files. It does not open every note.

**File a diagram or a file.** You paste a Mermaid diagram, or you give the agent a PDF. It asks which topic again. A diagram is appended to the same `note.md`. A PDF is copied into `topics/grocery-api/assets/` and `note.md` gets a link to that file.

**Connect two topics.** You already have a topic called Auth. In an excerpt you write `[[auth]]`. The agent stores a link from Grocery API to Auth in `graph.json`, so a later search can move from one topic to the other.

**Let the agent offer.** You never type `/mn`. Near the end of the chat the agent says: "Save this on Grocery API? Checkout returns a receipt id." It writes that sentence only after you accept, and it offers one save at a time.

**Ask it back.** A new chat, another day, you type:

```
What did I decide about the grocery list endpoint?
```

The agent searches `catalog.json` for `list` and `endpoint`, finds Grocery API, and asks: "Use the Grocery API note?" You say yes. It reads `note.md` and answers from the excerpt: the list endpoint returns items for one store. If you say no, it answers without opening the note. If you say "check my notes" up front, it reads the matching topic without that extra question.

## What the folder looks like after that

```
Mnemium/
  catalog.json                 list of topics the search reads first
  graph.json                   Grocery API → Auth, from [[auth]]
  topics/grocery-api/
    note.md                    title, the list-endpoint sentence, any diagram
    skill.md                   instructions for an agent using this topic
    index.json                 terms and a short summary of the excerpts
    assets/spec.pdf            a file you attached, if you attached one
```

You type the `/mn` lines. The agent runs `scripts/mn.js` after you confirm. You do not run those script commands yourself.

## Test

```sh
npm test
```
