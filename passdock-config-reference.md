# PassDock 配置参考

文档分类：

- 类型：技术部署参考
- 适用场景：查环境变量、查运行配置项
- 是否建议第一次优先阅读：否

第一次接手项目建议先看：

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

## 1. 配置层级

当前项目有四层配置来源：

1. 环境变量：基础设施、密钥、启动期引导配置
2. 数据库记录：后台可维护的业务配置
3. 数据库运行时覆盖：部分运行时设置
4. 代码默认值：兜底值

本文件只记录当前代码中已经真实接线的配置项。

## 2. 环境变量

### 应用基础

- `APP_NAME`
- `APP_ENV`
- `APP_PORT`
- `APP_BASE_URL`
- `APP_TIMEZONE`
- `APP_LOG_LEVEL`
- `BOOTSTRAP_REFERENCE_DATA`
- `SEED_SAMPLE_BUSINESS_DATA`

启动期种子规则：

- `BOOTSTRAP_REFERENCE_DATA` 控制是否初始化管理员、运行时设置、支付通道、商品、策略、Provider 等参考数据
- `SEED_SAMPLE_BUSINESS_DATA` 控制是否初始化演示订单、支付凭证、工单和退款样例
- 默认行为：
  - `development` / `test`：初始化参考数据 + 演示业务数据
  - `staging` / `production`：只初始化参考数据

### 数据库

- `DB_DRIVER`
- `SQLITE_PATH`
- `POSTGRES_DSN`

### 认证

- `SESSION_SECRET`
- `ADMIN_BEARER_TOKEN`

说明：

- `SESSION_SECRET` 用于会话令牌与本地加密派生
- `ADMIN_BEARER_TOKEN` 可直接访问后台 API，适合作为运维兜底口令

### 内部接口引导客户端

- `INTERNAL_SIGN_KEY`
- `INTERNAL_SIGN_SECRET`

内部接口认证优先级：

```text
数据库 internal client key > 环境变量引导 key > 拒绝请求
```

### Telegram 引导配置

- `TELEGRAM_ENABLED`
- `TELEGRAM_BOT_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`
- `TELEGRAM_WEBHOOK_IP_ADDRESS`
- `TELEGRAM_WEBHOOK_ALLOWED_UPDATES`
- `TELEGRAM_WEBHOOK_MAX_CONNECTIONS`
- `TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES`
- `TELEGRAM_BOT_USERNAME`

运行时规则：

- 先读数据库中的 Telegram Bot 配置
- 找不到同 `bot_key` 时回退到环境变量
- 当 `TELEGRAM_WEBHOOK_URL` 为空时，系统会自动拼出：

```text
APP_BASE_URL + /api/v1/bots/{bot_key}/telegram/webhook
```

### 存储

- `STORAGE_TYPE`
- `STORAGE_LOCAL_PATH`
- `STORAGE_PUBLIC_PATH`
- `UPLOAD_MAX_FILE_SIZE_MB`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `MINIO_REGION`
- `MINIO_USE_SSL`

支持的存储后端：

- `local`
- `minio`

MinIO 对应关系：

- `MINIO_ENDPOINT`：S3 兼容地址，格式为 `host:port`
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`：访问密钥
- `MINIO_BUCKET`：对象桶名
- `MINIO_REGION`：区域
- `MINIO_USE_SSL=true`：走 HTTPS

当前项目仍通过自身 API 代理上传和下载，不依赖对象存储公网直链。

### 运行时业务设置

- `CORS_ALLOW_ORIGINS`
- `ORDER_EXPIRE_MINUTES`
- `PAYMENT_REVIEW_TIMEOUT_MINUTES`
- `ORDER_SWEEP_INTERVAL_SECONDS`
- `ASYNC_CONCURRENCY`
- `ASYNC_POLL_INTERVAL_SECONDS`
- `DELIVERY_RETRY_MAX_RETRIES`
- `DELIVERY_RETRY_DELAY_SECONDS`
- `OKX_WATCHER_ENABLED`
- `OKX_WATCHER_API_URL`
- `OKX_WATCHER_API_TOKEN`
- `OKX_WATCHER_TIMEOUT_MS`
- `OKX_WATCHER_INTERVAL_SECONDS`
- `OKX_WATCHER_BATCH_SIZE`

### new-api 引导配置

- `NEW_API_PROD_BASE_URL`
- `NEW_API_PROD_KEY_ID`
- `NEW_API_PROD_SECRET`
- `NEW_API_PROD_TIMEOUT_MS`
- `NEW_API_PROD_RETRY_TIMES`
- `NEW_API_STAGING_BASE_URL`
- `NEW_API_STAGING_KEY_ID`
- `NEW_API_STAGING_SECRET`
- `NEW_API_STAGING_TIMEOUT_MS`
- `NEW_API_STAGING_RETRY_TIMES`

规则：

- 启动期参考数据会用这些值覆盖内建 `new_api_prod` / `new_api_staging`
- 如果 `*_BASE_URL` 为空，则保持 `mock://...` 引导目标
- 在 `staging` / `production` 中：
  - 不能继续使用 `mock://...`
  - 不能继续使用默认引导密钥
  - 否则 Provider 校验会直接阻止上线

## 3. 数据库可维护配置

这些模块由后台维护并存入数据库：

- 支付通道
- 商品
- 商品价格模板
- 集成 Provider
- 集成 Action
- 履约策略
- 交付策略
- Telegram Bot 配置
- Internal Client Key
- 运行时设置

## 4. 配置优先级

### 基础设施与密钥

```text
环境变量 > 代码默认值
```

适用：

- 数据库连接
- Session Secret
- 管理员 Bearer Token
- 存储后端

### Telegram 运行时配置

```text
数据库 Bot 配置 > 环境变量引导配置 > 空配置
```

### Internal API 鉴权

```text
数据库 internal client key > 环境变量引导 key > 拒绝请求
```

### 业务数据

```text
数据库 / 后台配置 > 代码默认值
```

适用：

- 支付通道行为
- 支付回调验证与自动履约 / 自动交付开关
- 商品目录
- 集成路由
- 履约与交付策略绑定

## 5. 运行时设置说明

`runtime_settings` 表已经部分接入真实业务逻辑。

当前有效优先级：

```text
环境变量 > runtime_settings 记录 > 代码默认值
```

当前已真实生效的设置：

- `ORDER_EXPIRE_MINUTES`
  控制订单创建后的过期时间
- `PAYMENT_REVIEW_TIMEOUT_MINUTES`
  控制支付待审核超时时间
- `ORDER_SWEEP_INTERVAL_SECONDS`
  控制自动扫过期订单和超时审核订单的频率

说明：

- 后台可以继续以通用方式维护其他 `runtime_settings`
- 但只有明确接线的名称才会影响真实行为

## 6. 当前未内建的旧规划项

以下历史规划项目前没有内建成完整配置开关：

- Redis 配置
- JWT Secret
- Prometheus 开关
- Sentry DSN
- 通用 rate-limit 环境变量
- trust-proxy 开关

说明：

- Prometheus 指标端点已经内建为 `/metrics`
- 错误上报接口已经内建为 `service.ErrorReporter`
- 但项目没有强绑某个第三方平台的环境变量接线

## 7. 运维端点

项目已内建以下端点：

### `GET /healthz`

- 轻量级存活检查
- 只表示 HTTP 进程可响应

### `GET /readyz`

- 就绪检查
- 当前会检查：
  - 数据库连通性
  - 当前上传存储是否可用

### `GET /metrics`

- Prometheus 文本格式指标输出
- 包含 Go 运行时指标与 PassDock 自身的 HTTP 请求指标

上线建议：

- `/metrics` 只开放给内网、采集网关或白名单

## 8. 外部集成说明

### Telegram

项目与官方 Telegram Bot API 的 Webhook 参数保持一致：

- `url`
- `secret_token`
- `ip_address`
- `allowed_updates`
- `max_connections`
- `drop_pending_updates`

后台运维接口：

- `GET /api/v1/admin/telegram-configs/:botKey/webhook`
- `GET /api/v1/admin/telegram-configs/:botKey/webhook-info`
- `POST /api/v1/admin/telegram-configs/:botKey/webhook-sync`
- `DELETE /api/v1/admin/telegram-configs/:botKey/webhook-sync`

### new-api

推荐正式生产路径：

- 让 PassDock 对接 `new-api` 的内部适配接口
- 不直接把 `new-api` 的管理 API 暴露到发码主链路

当前项目默认内置的契约是：

- `POST /api/internal/redemption/issue`
- `POST /api/internal/subscription_code/issue`
- `GET /api/internal/code_issue/:order_no`

原因：

- 更适合订单号幂等
- 更容易做签名鉴权
- 更适合订单履约重试
- 不受上游管理 API 变动直接影响

项目同时也支持把官方管理 API 作为可选 Provider 接入，但不建议默认走该路径。

### 支付回调

支付回调已经支持按通道配置进行字段映射：

- `callback_payload_mapping`
- `callback_success_field`
- `callback_success_values`

这使得微信、支付宝或聚合支付通道都可以通过配置完成归一化，不需要为每一家写死代码。
