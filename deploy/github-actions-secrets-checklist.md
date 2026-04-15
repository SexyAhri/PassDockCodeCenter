# GitHub Actions Secrets Checklist

Use this checklist when configuring the repository secrets for:

- `.github/workflows/build-images.yml`
- `.github/workflows/deploy-remote.yml`

## 1. Build workflow

The image build workflow pushes to GHCR with the repository `GITHUB_TOKEN`.

Usually you do not need to add extra secrets for image publishing if:

- the workflow runs in the same repository
- GHCR package publishing is allowed for the repository

## 2. Deploy workflow secrets

Configure these repository secrets in GitHub:

### `DEPLOY_HOST`

- Your server public IP or hostname
- Example: `203.0.113.10`
- Example: `deploy.shop.cyanyi.com`

### `DEPLOY_PORT`

- SSH port
- Usually: `22`

### `DEPLOY_USER`

- SSH login user on the server
- Example: `root`
- Example: `ubuntu`

### `DEPLOY_SSH_KEY`

- The private SSH key used by GitHub Actions
- This should match the public key already added to `~/.ssh/authorized_keys` on the server
- Paste the full private key content, including:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### `DEPLOY_APP_PATH`

- Absolute path of the cloned repository on the server
- Example: `/srv/passdock`

### `GHCR_USERNAME`

- GitHub username or bot account used to pull private GHCR images on the server
- Example: `SexyAhri`

### `GHCR_TOKEN`

- GitHub token or personal access token with package read permission
- If the GHCR package is private, this secret is required on the server deploy step

Recommended scopes for a classic PAT:

- `read:packages`
- optionally `repo` if your package visibility setup requires it

## 3. Server-side production file

These are not GitHub Secrets.

They must exist on the server inside the repository root:

- `passdock.env`
- `data/`
- `storage/`
- `newapi-adapter-data/`

## 4. Quick validation before first deploy

Before triggering the deploy workflow, confirm:

1. the repo has been cloned to `DEPLOY_APP_PATH`
2. `passdock.env` exists at `DEPLOY_APP_PATH/passdock.env`
3. Docker is installed on the server
4. `docker compose version` works on the server
5. GHCR credentials can pull the package manually on the server
