# Deploying to Railway: Guide and Lessons

This document covers everything that had to change to make the monorepo (Generator + Next.js app) run on Railway’s containers.

---

## Final Production Flow

1. `turbo build` (root) → builds both workspaces.
2. `pnpm --filter=generator build` – compiles the Solidity <-> TypeScript code-gen.
3. `pnpm --filter=app build` – runs `next build` which outputs a **standalone** bundle.
4. `pnpm --filter=app postbuild` – copies `public` and `./.next/static` into `./.next/standalone/app` so that `server.js` can serve them.
5. Railway launches `npm start` (root), which resolves to `pnpm --filter app start` and ultimately executes `node .next/standalone/app/server.js`.

The result is a single process listening on `$PORT` (injected by Railway) that serves the whole application.

---

## Code Changes

The Neynar SDK is highly opinionated and required a number of changes to properly build a farcaster app in a monorepo environment. The included build script is interactive and meant to walk devs through going from local dev to prod, but caused deployments to fail in a way that wasn't apparent at first

while extremely helpful in showing how frames v2 (mini-apps) differ from v1 (it's a lot) and showing how to implement the various features Neynar provides, in the future I wouldn't start a mini-app with it as there's too much fluff

the following are the main changes required from my original structure (`foundry` + `canvas` + `neynar-sdk`) in order to get the app deployed

| Area                         | Change                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generator build              | Added `pnpm --filter=generator build` to root `buildCommand` (see `vercel.json`) and `package.json` `build:production` script.                                      |
| Non-interactive Neynar build | Replaced interactive prompts with default flags so CI doesn’t hang.                                                                                                 |
| External native deps         | Added `imagescript` and `generator` to `next.config.ts → serverExternalPackages` and pushed `imagescript` to `webpack.externals` to avoid bundling native bindings. |
| Exclude contracts directory  | Manually excluded `contracts` directory as including Foundry caused build problems.                                                                                 |
| Standalone output            | Set `output: 'standalone'` in `next.config.ts`. This generates `app/.next/standalone` including `server.js`.                                                        |
| Post-build asset copy        | Added the `postbuild` script (see below) to relocate `public` and static chunks under `.../standalone/app` – the path expected by `server.js`.                      |
| Start script                 | `"start": "node .next/standalone/app/server.js"` inside `app/package.json`.                                                                                         |

### Final scripts

While for most apps, railway would likely simply work I ran into some trouble with the monorepo structure, originally with the generator package not being built properly beforehand and later with the static assets not being placed in the correct directory. I ended up using `turborepo` to orchestrate a production build script, building the `generator/` package first, and add a `postbuild` script to ensure the assets where available.

```json
"build": "next build",
"postbuild": "mkdir -p .next/standalone/app && cp -r public .next/standalone/app/ && mkdir -p .next/standalone/app/.next && cp -r .next/static .next/standalone/app/.next/"
```

I also originally had a post-build script that checked the ABI file from `app` against the most recent `contracts` ABI to make sure my development environment was only running with the latest contract version but since including the foundry project in the build caused it to fail and the production contract wouldn't be changing, I removed it, though if this were a project that used upgradeable contracts it would be a helpful script that I would want to set up correctly

---

## Railway config

| Variable   | Value                         | Why                                         |
| ---------- | ----------------------------- | ------------------------------------------- |
| `PORT`     | `3000` (Railway auto-injects) | Next standalone server reads it.            |
| `HOSTNAME` | `0.0.0.0`                     | Ensures the server binds on all interfaces. |

the only other variables required were app-specific logic (neynar API/project ID, contract addresses, etc.). Without defining the `PORT` and `HOSTNAME`, the build would complete and deploy but the healthcheck endpoint couldn't be reached for railway to ensure the app was running. The endpoint `app/api/health/` simply returns a 200 code if it's available, and provides the status of the Redis store.

---

## Full deploy commands (CI or local)

```bash
# From project root
pnpm install --frozen-lockfile
pnpm run build:production   # runs generator + app builds
cd app
pnpm run start              # starts the standalone server (uses $PORT)
```

In Railway the **Start Command** is simply `pnpm start` at the repo root, matching the root `package.json` script which delegates to the app.

---

## Trial-and-error

- **Make Neynar build script non-interactive**  
   CI initially hung waiting for prompts – switched to a flag-based build.
- **Make ImageScript external to webpack**  
   Native canvas bindings broke the bundle; declaring it external fixed it. There were additional problems before switching to `imagescript`. I was originally using `canvas` which wasn't suited for serverless functions, then switched to `sharp` when I encountered trouble getting it set up in the proper linux environment on production. This led me to switch to `docker`, which I ended up dropping as railway's native build tools did the job and already used `docker` internally, and `imagescript` was a minimal solution that did exactly what I needed it to do: put some image layers together without as many dependencies.
- **Use standalone server and point `start` to it**  
   The default `next start` didn't work in Railway’s minimal container, so standalone avoids the need for the full repo at runtime.
- **Set `PORT` and `HOSTNAME` env vars in Railway**  
   Without `HOSTNAME=0.0.0.0` the server bound to localhost only.
- **Add the current `postbuild` script**  
   Static assets were 404-ing until we copied them into the location expected by `server.js`, which would have been fine outside of a monorepo.

## Vercel v Railway

after switching from vercel to railway, I went back to vercel to delete the project so I only had one deployment URL and what do you know... vercel is working just fine and it doesn't have any of the environment variables that I had to set for railway to work!

so now that I have more experience with monorepo deployments, I know that vercel works out of the box better than railway does. Vercel automatically exposes the correct `HOSTNAME` and `PORT` and it provides better logging. But railway has a much better UI and makes provisioning services a lot easier. Had I known what I know now, I would have set everything up on vercel as having all of my code contained in my monorepo and only needing a KV store there's not much need for all of the extra things that railway provides. For larger projects, or non-next.js fullstack apps I would 100% go with railway again.

| Monorepo Support                | Vercel | Railway |
| ------------------------------- | ------ | ------- |
| **auso-assigning ports**        | ✅     | ❌      |
| **audo-assigning hostname**     | ✅     | ❌      |
| **proper output dirs**          | ❌     | ❌      |
| **ease of connecting services** | ❌     | ✅      |
| **container support**           | ❌     | ✅      |

---

## 6. Troubleshooting

- `/_next/static/*` 404? → Verify `postbuild` copied `static` into `standalone/app/.next/` to match monorepo structure.
- Blank page? → Check browser console for failed network requests (usually the same static path issue).
- Container crashes? → Ensure `server.js` exists and `start` script points to it.
- Port binding errors? → Confirm Railway `PORT` env var is respected and not overridden.

---
