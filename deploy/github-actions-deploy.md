# GitHub Actions Remote Deploy

This repository now includes:

- image build workflow: `.github/workflows/build-images.yml`
- remote deploy workflow: `.github/workflows/deploy-remote.yml`
- server-side pull compose: `deploy/passdock-docker-compose.sqlite.pull.yml`

## 1. How the release flow works

Build flow:

- GitHub Actions builds four images
- images are published to `ghcr.io/<owner>/<repo>-*`

Deploy flow:

- after a successful build on `main` or `master`, the deploy workflow connects to your server over SSH
- it logs in to GHCR on the server
- it pulls the published images
- it starts the stack with `deploy/passdock-docker-compose.sqlite.pull.yml`

The pull compose expects `../passdock.env` to already exist on the server.

## 2. Required GitHub secrets

Configure these repository secrets:

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_APP_PATH`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

What they mean:

- `DEPLOY_HOST`: your server public IP or hostname
- `DEPLOY_PORT`: SSH port, usually `22`
- `DEPLOY_USER`: SSH login user
- `DEPLOY_SSH_KEY`: private key used by GitHub Actions to access the server
- `DEPLOY_APP_PATH`: absolute path of the cloned repo on the server
- `GHCR_USERNAME`: GitHub username or bot account that can read the package
- `GHCR_TOKEN`: GitHub token or PAT with package read access on the server side

## 3. Server prerequisites

Before remote deploy can work, the server should already have:

1. Docker and Docker Compose plugin installed
2. this repository cloned to the path in `DEPLOY_APP_PATH`
3. production `passdock.env` placed at the repo root
4. directories ready for bind mounts:
   - `data`
   - `storage`
   - `newapi-adapter-data`

Recommended first-time setup:

```bash
cd /srv/passdock
mkdir -p data storage newapi-adapter-data
```

## 4. Image names

The workflows publish these images:

- `ghcr.io/<owner>/<repo>-server`
- `ghcr.io/<owner>/<repo>-web`
- `ghcr.io/<owner>/<repo>-okxwatcher`
- `ghcr.io/<owner>/<repo>-newapiadapter`

The remote deploy workflow automatically derives `<owner>/<repo>`.

## 5. Manual deploy

You can also trigger deploy manually from GitHub Actions.

Inputs:

- `git_ref`
- `image_tag`

Examples:

- `git_ref = main`, `image_tag = latest`
- `git_ref = main`, `image_tag = sha-<fullsha>`

## 6. Important notes

- do not commit `passdock.env`
- do not rely on the pull compose for local development
- keep GHCR package visibility and token permissions aligned
- if your server uses a private package, `GHCR_TOKEN` must be able to pull it
