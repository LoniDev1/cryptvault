# App icons

Tauri requires platform icons in this folder before bundling. They are not
checked into the repository to keep the tree small.

Generate them from a single 1024×1024 PNG once:

```bash
npm run tauri icon path/to/source.png
```

This produces every required size for Linux, Windows (`.ico`) and macOS
(`.icns`). The CI release workflow does **not** generate icons automatically,
so commit them after running the command above (or invoke it as part of your
release pipeline).
