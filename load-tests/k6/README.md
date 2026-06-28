# k6 load tests

These scripts are external load tests for the memorial service. They are not run
inside the web app or the admin panel.

## One-click production run

The owner can start the public test from the **External k6** card in the admin
panel. It ramps up to 500 VUs over 30 seconds, holds that load for 45 seconds,
and ramps down over 15 seconds. The test runs on a separate GitHub-hosted
runner while the open admin tab collects server resource diagnostics.

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
