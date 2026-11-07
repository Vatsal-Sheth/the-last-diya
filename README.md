# The Last Diya app

Static phone app for the Diwali mystery. Only the encrypted `dist/` directory is meant for GitHub Pages.

## Build

Run `node build.mjs` from this folder on the local machine. `build.mjs` is intentionally excluded from Git because it reads plaintext story inputs, including sealed sources, while preparing the encrypted output. Keep that build script and the source materials local. The public repository should contain only the static app shell and encrypted `dist/` bundles. The build writes generated codes to the ignored `private/player-codes.txt` file and writes the emergency code separately to `private/break-glass.txt`. It does not print codes, private story content, or selected ending details. Print the emergency code only after the final build, without opening the file.

Player codes use two words and six digits. Each encrypted blob uses its own random salt and PBKDF2-SHA256 with 600,000 iterations.

Every build rotates the player, host, and act codes. Do not send codes until the last build is complete.

## Local preview

Serve only the built output, bound to loopback:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173/` on this laptop. Do not bind the server to the Wi-Fi interface.

The `story/`, `print/`, `HANDOFF.md`, `private/`, and `build.mjs` paths are ignored by Git. Do not add them to a public commit.

## Publish

The GitHub Actions workflow in `.github/workflows/pages.yml` uploads only `dist/` to GitHub Pages. It does not run the build on GitHub because the build uses local story sources and rotates the access codes. After creating the repository, set Pages to use GitHub Actions. Push the final local build to `main` to publish it.
