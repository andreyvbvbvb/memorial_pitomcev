# k6 load tests

These scripts are external load tests for the memorial service. They are not run
inside the web app or the admin panel.

## One-click production run

The owner can start three test types from the **External k6** card:

- **Mixed 500 VU** ramps up over 30 seconds, holds for 45 seconds, and ramps
  down over 15 seconds.
- **API + web 1000 VU** runs two isolated tests sequentially. Each ramps up over
  60 seconds, holds for 45 seconds, and ramps down over 30 seconds.
- **Editor assets 1/5/10/50/100 VU** makes every virtual user open `/create`
  once, then downloads one selected 3D scene, the option previews and one marker
  category. This measures the web/CDN path for models and images without
  repeatedly looping the same user flow.

The tests run on a separate GitHub-hosted runner while the open admin tab
collects server resource diagnostics.

One-time setup:

1. Create a fine-grained GitHub personal access token scoped to the
   `andreyvbvbvb/memorial_pitomcev` repository.
2. Grant the token the repository permission **Actions: Read and write**.
3. Add it to the API deployment environment as `GITHUB_WORKFLOW_TOKEN` and
   redeploy.

The admin button dispatches `.github/workflows/k6-production.yml`. Results are
available in GitHub Actions, and the JSON summary is retained as a workflow
artifact for 14 days. The workflow can also be started manually from its
GitHub Actions page without configuring the API token.

## Install

```bash
brew install k6
```

Docker alternative:

```bash
docker run --rm -i \
  -v "$PWD:/work" \
  -w /work \
  grafana/k6 run load-tests/k6/public-browse.js
```

## Environment

- `API_BASE_URL`: API origin. Default: `http://localhost:4000`
- `WEB_BASE_URL`: web origin. Default: `http://localhost:3000`
- `VUS`: virtual users, or the target VUs for the public ramping test.
- `DURATION`: test duration, or hold duration for the public test.
- `RAMP_UP`: public-test ramp-up duration. Default: `30s`.
- `RAMP_DOWN`: public-test ramp-down duration. Default: `15s`.
- `P95_MS`: default p95 threshold in milliseconds. Default: `1200`.
- `ASSET_BATCH_SIZE`: parallel asset requests per virtual user. Default: `2`.
- `MODEL_P95_MS`: model-download p95 threshold. Default: `30000`.
- `IMAGE_P95_MS`: image-download p95 threshold. Default: `15000`.
- `K6_EMAIL`: user email for authenticated/admin scripts.
- `K6_PASSWORD`: user password for authenticated/admin scripts.

## Public browsing

Read-only traffic for public pages, marker list, gift catalog and random public
memorial pages.

```bash
API_BASE_URL=https://api.example.com \
WEB_BASE_URL=https://example.com \
VUS=50 \
DURATION=5m \
pnpm k6:public
```

## Isolated API and web runs

Use these scripts to distinguish API/database saturation from Next.js or
ingress saturation:

```bash
API_BASE_URL=https://api.example.com \
VUS=1000 \
RAMP_UP=60s \
DURATION=45s \
RAMP_DOWN=30s \
pnpm k6:api

API_BASE_URL=https://api.example.com \
WEB_BASE_URL=https://example.com \
VUS=1000 \
RAMP_UP=60s \
DURATION=45s \
RAMP_DOWN=30s \
pnpm k6:web
```

## Authenticated user

Read-only traffic for `/my-pets`, profile, wallet history, user gifts and owned
memorial reads. Use a dedicated test account.

```bash
API_BASE_URL=https://api.example.com \
WEB_BASE_URL=https://example.com \
K6_EMAIL=test@example.com \
K6_PASSWORD='password' \
VUS=20 \
DURATION=5m \
pnpm k6:auth
```

## Editor models and images

Simulates simultaneous first-time editor loads. Each virtual user performs one
iteration, so `VUS` is the exact number of users opening the editor:

```bash
WEB_BASE_URL=https://example.com \
VUS=10 \
pnpm k6:assets
```

Use `VUS=1`, `5`, `10`, `50`, then `100`. This test downloads real GLB and PNG
files and can generate significant traffic. It measures HTTP delivery, not GLB
parsing, WebGL rendering, device CPU, RAM or GPU.

## Admin DB probe

External version of the admin panel DB probe. Use only with an admin or owner
test account.

```bash
API_BASE_URL=https://api.example.com \
K6_EMAIL=admin@example.com \
K6_PASSWORD='password' \
RATE=20 \
DURATION=2m \
pnpm k6:admin
```

## Notes

- Run serious tests from a separate machine, not from the production server.
- Start with low `VUS` or `RATE`, then raise gradually.
- These scripts deliberately avoid creating pets, gifts, payments or drafts.
- WebGL rendering is not measured by these scripts because k6 HTTP tests do not
  execute the browser's 3D scene.
