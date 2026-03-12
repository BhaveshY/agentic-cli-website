# AGENTS.md

## Cursor Cloud specific instructions

This is a single-file static HTML project (`index.html`) — an interactive learning platform for harness engineering in agentic systems. There is no package manager, build system, or test framework.

### Serving the app

Run a local HTTP server from the workspace root:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080` in the browser.

### Linting

HTML linting uses `htmlhint` (installed globally via npm):

```
htmlhint index.html
```

### Notes

- No `package.json`, lockfile, or build tooling exists — the update script is intentionally a no-op (`echo`).
- External CDN resources (Google Fonts, Chart.js) require internet access but the page degrades gracefully without them.
