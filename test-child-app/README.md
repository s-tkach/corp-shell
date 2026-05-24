# test-child-app

A Corp shell child app.

## Development

```bash
pnpm install
pnpm serve   # starts webpack-dev-server on port 3001
```

## Build

```bash
pnpm build   # outputs dist/remoteEntry.js
```

## Registration

After deploying, register this app in the Corp Admin Panel:

1. Go to **Admin → Application Registry → Register App**
2. Fill in:
   - **Name**: `test-child-app`
   - **Remote URL**: the base URL where `remoteEntry.js` is served (e.g. `https://cdn.example.com/test-child-app`)
   - **Route Prefix**: the path the shell mounts this app at (e.g. `/test-child-app`)
   - **Health Check URL**: `{remoteUrl}/mf-manifest.json`
3. Click **Validate & Fetch Manifest** — the panel will confirm the manifest shape
4. Map routes to menu items and click **Save**

## Required GitHub Actions secrets

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Auto-provided — used to install `@corp/shell-sdk` from GitHub Packages |
| `S3_BUCKET` | S3 bucket name for static assets |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate after deploy |
| `AWS_ACCESS_KEY_ID` | AWS deploy credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS deploy credentials |
| `AWS_REGION` | AWS region |
