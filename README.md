# CryptVault

Cross-platform encrypted volume and file vault built with **Tauri 2 + Next.js + Rust**.

> Open source · MIT licensed · Linux, Windows and macOS

## Features

- **Encrypted containers (`.cv` volumes)** — single-file vaults that can hold many files. Mount, browse, add, extract, and delete entries.
- **Standalone file/folder encryption** — produce portable `.cv` archives without a container.
- **Authenticated cascade encryption**
  - Inner: **AES-256-GCM**
  - Outer: **XChaCha20-Poly1305**
  - Independent random nonces and AAD bound to the volume id
- **Strong key derivation** with **Argon2id**
  - `Fast` (64 MiB · 3 iters), `Strong` (256 MiB · 8 iters), `Paranoid` (1 GiB · 12 iters)
- **HKDF-SHA-512** splits the master key into per-cipher subkeys
- **Built-in passphrase strength meter** and diceware-style passphrase generator
- **KDF benchmark** so users can tune cost to their hardware
- **Animated, motion-graphics UI** powered by **Framer Motion** — animated background, splash sequence, motion paths showing the crypto pipeline, layout-animated tabs and lists
- **Cross-platform builds via GitHub Actions** for Linux, Windows and macOS

## Project layout

```
.
├── app/                     Next.js 14 (App Router) frontend
│   ├── components/          Animated UI building blocks
│   └── lib/store.ts         Zustand store + Tauri command bridge
├── src-tauri/               Rust backend (all crypto + IO logic here)
│   └── src/
│       ├── crypto/          Argon2id, AEAD ciphers, HKDF, cascade
│       ├── volume/          Container header, create, mount, entries
│       ├── files/           One-shot file/folder encryption
│       ├── commands.rs      Tauri command handlers
│       └── lib.rs           App entry point
└── .github/workflows/       Cross-platform release pipeline
```

## Development

Requirements: Node 20+, Rust stable, the platform prerequisites listed in the [Tauri docs](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

Production bundle:

```bash
npm run tauri build
```

Artifacts are emitted under `src-tauri/target/release/bundle/`.

## Container format (v1)

```
MAGIC(8="CVAULT01") | VERSION(2 LE) | HEADER_LEN(4 LE) | HEADER_JSON
                   | BODY_LEN(8 LE) | BODY (cascade-encrypted JSON)
                   | optional random padding to a fixed size
```

The header carries Argon2id parameters, salt, the volume id, and an
authenticated check token used to detect a wrong passphrase **before**
decrypting the body. The body holds the file index plus inline contents,
encrypted with a separate HKDF-derived cascade subkey.

Standalone files use a similar layout with magic `CVFILE01`.

## Security notes

- All cryptographic primitives are implemented with audited Rust crates
  (`argon2`, `aes-gcm`, `chacha20poly1305`, `hkdf`, `sha2`).
- Random material comes from the OS CSPRNG via `rand::thread_rng()`.
- Master keys are wiped via `zeroize` when dropped.
- AEAD tags authenticate every layer; bit flips in the file are rejected.
- This project is provided **as-is** with no warranty. Audit before relying on
  it for high-risk threat models.

## Releases

Push a tag matching `v*.*.*` to trigger the cross-platform release workflow:

```bash
git tag v0.1.0
git push --tags
```

Linux (`.AppImage`, `.deb`), Windows (`.msi`, `.exe`), and macOS (`.dmg`,
`.app.tar.gz`) artifacts are uploaded to a draft GitHub Release.

## License

MIT — see [LICENSE](LICENSE).
