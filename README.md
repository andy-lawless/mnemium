# Mnemium

Mnemium is a local-first second brain. Notes stay plain Markdown files on disk, arranged in a short lifecycle: capture in `inbox/`, keep working material in `notes/`, and move finished material to `archive/`.

The code around the vault is deliberately thin. It should be easy to grow this repository into a CLI, a web dashboard, or a small local service without first committing to a framework, a database, or a sync protocol.

## Layout

```
vault/          Markdown notes (inbox, notes, archive)
src/core/       Note shape and Markdown parsing
src/storage/    Reading and writing the vault on disk
src/cli/        Command-line entrypoint
tests/          Smoke test
docs/adr/       Architectural decision records
```

## Run

Requires Node.js 18 or newer. There are no dependencies to install.

```sh
node src/cli/main.js
```

The same command is `npm start`. It prints how many notes sit in each tier.

Set `MNEMIUM_VAULT` to point at another directory. See `.env.example`. The process reads the variable from the environment; it does not load a `.env` file on its own.

```sh
npm test
```

## Architectural decision records

Choices that constrain Mnemium — storage, note identity, sync, interfaces — will be written down in [`docs/adr/`](docs/adr/) as they are made. That directory starts empty so early prototypes can change direction without defending a stack that was never chosen.
