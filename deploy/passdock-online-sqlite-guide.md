# PassDock SQLite Online Deployment Guide

This guide is for a single-node online deployment that uses:

- `SQLite` as the database
- local disk for uploads
- `new-api` upstream integration
- `OKX USDT` watcher integration
- `Telegram Bot` webhook delivery

It matches the files added in this repo:

- `Dockerfile.okxwatcher`
- `Dockerfile.newapiadapter`
- `passdock-docker-compose.sqlite.production.yml`
- `passdock.env.sqlite.production.example`

## 1. What this scheme is good for

Use this layout when you want the fastest production path on one server with light traffic.

Do not use this layout for:

- multi-node deployment
- active-active failover
- heavy concurrent write traffic

If your order volume grows, switch to PostgreSQL later.

## 2. Before you start

Prepare these four things first:

1. A public HTTPS domain such as `https://passdock.example.com`
2. A Telegram bot token
3. A real `new-api` instance
4. A TRON USDT receiving address for the bundled OKX watcher
5. A TronGrid API key
6. A New API access token

Important:

- `APP_BASE_URL` must be the final HTTPS domain
- Telegram webhook resolution depends on `APP_BASE_URL`
- upload URLs and order jump links also depend on `APP_BASE_URL`

## 3. Environment file

Copy the production template:

```powershell
Copy-Item passdock.env.sqlite.production.example passdock.env
```

Then replace every `replace_with_*` placeholder in `passdock.env`.

The keys you must fill correctly are:

- `APP_BASE_URL`
- `SESSION_SECRET`
- `INTERNAL_SIGN_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `OKX_WATCHER_API_URL`
- `OKX_WATCHER_API_TOKEN`
- `OKX_ADAPTER_RECEIVE_ADDRESS`
- `OKX_ADAPTER_TRONGRID_API_KEY`
- `NEW_API_UPSTREAM_BASE_URL`
- `NEW_API_UPSTREAM_ACCESS_TOKEN`
- `NEW_API_PROD_KEY_ID`
- `NEW_API_PROD_SECRET`
- `NEW_API_STAGING_KEY_ID`
- `NEW_API_STAGING_SECRET`

Important:

- the current production startup validation checks both `new_api_prod` and `new_api_staging`
- this repo now points both providers to the bundled `new-api-adapter`
- if you leave either provider secret on the bootstrap placeholder, the server will fail to start in `production`

## 4. Start the stack

Run:

```powershell
docker compose -f passdock-docker-compose.sqlite.production.yml up -d --build
```

What this compose does:

- exposes only the web container to the host
- keeps the Go server internal to the compose network
- stores SQLite data in `./data`
- stores uploaded files in `./storage`

Optional:

- if you want MinIO later, start with `--profile minio` and switch storage env vars accordingly

## 5. First login

After the stack is healthy, open:

- `https://your-domain/admin/login`

Default seeded accounts:

- admin: `admin@passdock.local` / `Passdock123!`
- operator: `operator@passdock.local` / `Passdock123!`

Do this immediately after login:

1. change the admin password
2. confirm products and payment channels were seeded
3. confirm `new_api_prod` is pointing to your real upstream

## 6. Upstream integration

The repository still bootstraps these provider keys:

- `new_api_prod`
- `new_api_staging`

The default fulfillment strategies still point to `new_api_prod`, but the production compose now routes that provider to the bundled `new-api-adapter`.

Current path:

- `PassDock -> new-api-adapter -> your real new-api`

The adapter currently supports:

- `POST /api/internal/redemption/issue`
- `POST /api/internal/subscription_code/issue`
- `GET /api/internal/code_issue/:order_no`

How it maps upstream calls:

- recharge code issuance -> New API redemption code API
- subscription code issuance -> New API token API
- issue query -> local adapter store

## 7. OKX USDT integration

This repo now includes a bundled watcher sidecar that the production compose starts automatically.

Current behavior:

- PassDock periodically polls `http://okx-watcher:8090/api/scan`
- the bundled watcher queries TronGrid for inbound TRC20 USDT transfers
- the watcher matches incoming transfers against pending `okx_usdt` orders
- PassDock then calls its internal payment confirmation flow automatically

Current scope:

- chain: TRON mainnet
- asset: USDT TRC20
- required inputs: your receiving address and a TronGrid API key

You still need to fill these watcher env values:

- `OKX_WATCHER_API_TOKEN`
- `OKX_ADAPTER_RECEIVE_ADDRESS`
- `OKX_ADAPTER_TRONGRID_API_KEY`

Recommended checks:

1. create an `okx_usdt` order
2. confirm `passdock-okx-watcher` is healthy
3. confirm the watcher receives the pending order payload from PassDock
4. confirm the watcher returns a `matched` item with `chain_tx_hash`
5. confirm the order moves to paid or manual review in PassDock

## 8. Telegram Bot integration

If `TELEGRAM_WEBHOOK_URL` is empty, PassDock resolves the webhook as:

```text
APP_BASE_URL + /api/v1/bots/default/telegram/webhook
```

Recommended sequence:

1. set `APP_BASE_URL` to the final HTTPS domain
2. set `TELEGRAM_BOT_TOKEN`
3. set `TELEGRAM_WEBHOOK_SECRET`
4. boot the stack
5. log into admin
6. open the Telegram config page
7. run the webhook sync action

Useful runtime API endpoints already built into the project:

- `GET /api/v1/admin/telegram-configs/:botKey/webhook`
- `GET /api/v1/admin/telegram-configs/:botKey/webhook-info`
- `POST /api/v1/admin/telegram-configs/:botKey/webhook-sync`
- `DELETE /api/v1/admin/telegram-configs/:botKey/webhook-sync`

## 9. Deployment checklist

Before going live, verify:

1. `/healthz` returns success through the web container
2. `/readyz` returns success through the web container
3. the storefront can load product data
4. admin login works
5. an order can be created
6. `okx_usdt` can be confirmed by the watcher adapter
7. upstream issuance succeeds for a paid order
8. Telegram can receive delivery or notification messages
9. uploaded proofs are visible from the public site

## 10. Backup advice

For this SQLite deployment, back up both directories together:

- `./data`
- `./storage`

If you restore only the database or only the upload files, payment proofs and delivery assets may become inconsistent.
