# PassDock

`PassDock` 是一个面向数字商品售卖与自动交付的独立站平台，当前聚焦 AI 网关充值码、订阅激活码等商品场景，主流程已经形成“匿名下单 -> 返回订单号与查单码 -> 支付确认/审核 -> 履约发码 -> 网站/Telegram 交付 -> 后台运营”的完整业务闭环。

## 项目状态

当前代码已经实现的核心闭环：

- 商品前台：商品列表、详情、匿名下单、支付指引、订单详情、支付凭证上传与预览
- 订单访问：通过 `订单号 + order_access_token（查单码）` 查询订单、查看交付结果、上传凭证、提交售后
- 后台管理：仪表盘、商品、订单、支付、履约、Telegram、客户、工单、系统配置
- 支付链路：`okx_usdt` 自动扫单，`wechat_qr` / `alipay_qr` 人工二维码收款，统一支付回调映射
- 履约链路：产品 -> 履约策略 -> 上游 Provider / Action -> 交付策略
- 交付链路：站内交付、Telegram 交付、人工交付待办
- Telegram：Webhook、绑定、商品浏览、快捷下单、支付提醒、凭证上传、订单查询、补发
- 可观测性：`/healthz`、`/readyz`、`/metrics`、统一错误上报接口

需要特别说明：

- 主业务闭环已经完成。
- 当前对外推荐的前台业务流程是不依赖用户注册/登录的匿名下单模式。
- 仓库里仍保留用户注册、登录、账户中心等能力代码，但它们不是当前默认对外主路径。
- Prometheus / Grafana / Sentry 这类平台型组件属于部署侧接入，项目当前内置的是指标端点和错误上报接口，不强绑某一家外部服务。
- 文档中“已实现”表示代码链路和本地构建/测试链路已经打通；微信 / 支付宝 / OKX / Telegram / MinIO / new-api 等外部服务是否 100% 正常，还取决于你上线时填入的真实配置和联调结果。

## 技术栈

- 前端：React + TypeScript + Vite + SCSS + Ant Design
- 后端：Go + Gin + GORM
- 数据库：SQLite / PostgreSQL
- 存储：本地存储 / MinIO
- 交互：Telegram Bot Webhook
- 部署：Docker / Docker Compose

## 目录结构

```text
.
├─ apps/
│  ├─ server/                 后端服务
│  └─ web/                    前端站点与后台控制台
├─ deploy/
│  └─ nginx/                  前端容器 Nginx 反向代理配置
├─ Dockerfile.server          后端镜像构建文件
├─ Dockerfile.web             前端镜像构建文件
├─ passdock.env.example       后端环境变量示例
├─ passdock-docker-compose.sqlite.yml
├─ passdock-docker-compose.postgres.yml
└─ 各类设计 / API / 配置文档
```

## 本地启动

### 1. 后端

将根目录的 `passdock.env.example` 复制为 `.env` 或 `passdock.env`，至少确认以下配置：

- `APP_BASE_URL`
- `DB_DRIVER`
- `SQLITE_PATH` 或 `POSTGRES_DSN`
- `SESSION_SECRET`
- `INTERNAL_SIGN_SECRET`
- `TELEGRAM_*`（如需启用 Telegram）
- `NEW_API_*`（如需接真实上游）

启动后端：

```bash
cd apps/server
go run ./cmd/passdock
```

默认开发环境会自动写入参考数据，并在非严格环境下写入演示业务数据。

### 2. 前端

将 `apps/web/.env.example` 复制为 `apps/web/.env`。

启动前端：

```bash
cd apps/web
npm install
npm run dev
```

默认访问地址：

- 前端开发站点：`http://localhost:5173`
- 后端服务：`http://localhost:8080`

## 默认账号

首次启动参考数据后，会写入默认账号：

### 管理员

- 邮箱：`admin@passdock.local`
- 密码：`Passdock123!`

### 运营账号

- 邮箱：`operator@passdock.local`
- 密码：`Passdock123!`

后台入口：

- `http://localhost:5173/admin/login`
- 镜像部署后通常为 `http://你的域名/admin/login`

## 当前业务能力

### 前台

- 多商品类型展示
- RMB / USDT 双币种价格模板
- `okx_usdt`、`wechat_qr`、`alipay_qr` 三种支付方式
- 下单后返回 `订单号 + 查单码`
- 支付凭证上传、查看、重试
- 通过 `订单号 + 查单码` 查询订单、查看交付结果、提交售后
- 前台固定工作台布局与国际化文案

### 后台

- 商品与价格模板管理
- 订单搜索、筛选、批量操作、详情抽屉
- 支付审核、回调日志、支付凭证预览、扫单记录
- 履约记录、交付记录、补发、人工完成交付
- Telegram Bot、Webhook、绑定关系、测试发送
- 客户与工单运营台
- 运行时配置、Provider / Action、密钥、审计日志

### 集成能力

- `new-api` 内部适配契约
- Provider / Action 模板化请求渲染
- 健康检查、预览测试、受保护的 live test
- 回调字段映射、成功条件映射、统一平台归一化

## 接口与运维端点

### 业务接口

- 前台与用户接口：`/api/v1`
- 后台接口：`/api/v1/admin`
- 支付回调：`/api/v1/callbacks`
- 内部任务接口：`/internal/v1`

### 运维端点

- `GET /healthz`
  进程存活探针
- `GET /readyz`
  就绪探针，检查数据库与当前上传存储
- `GET /metrics`
  Prometheus 指标端点

## 镜像部署

仓库已经提供：

- `Dockerfile.server`
- `Dockerfile.web`
- `passdock-docker-compose.sqlite.yml`
- `passdock-docker-compose.postgres.yml`

### 1. SQLite 方案

适合单机、快速部署、轻量业务量。

```bash
copy passdock.env.example passdock.env
docker compose -f passdock-docker-compose.sqlite.yml up -d --build
```

默认端口：

- 前端站点：`8080`
- 后端服务：`18080`

说明：

- 对外建议只暴露前端站点端口
- 后端端口建议仅内网或运维访问，用于 `/metrics`、调试或直连排查
- 如需 MinIO，可在 compose 中启用 `minio` profile，并将 `STORAGE_TYPE` 改为 `minio`

### 2. PostgreSQL 方案

适合稳定生产、多运营并发、后续扩展。

```bash
copy passdock.env.example passdock.env
docker compose -f passdock-docker-compose.postgres.yml up -d --build
```

默认包含：

- `web`
- `server`
- `postgres`
- 可选 `minio` profile

### 3. 单独构建镜像

```bash
docker build -f Dockerfile.server -t passdock/server:local .
docker build -f Dockerfile.web -t passdock/web:local .
```

## 部署注意事项

- `APP_BASE_URL` 必须填写最终访问域名，否则 Telegram 链接、上传地址、订单跳转会不正确
- 生产环境建议：
  - `APP_ENV=production`
  - `SEED_SAMPLE_BUSINESS_DATA=false`
  - 使用 PostgreSQL
  - 使用真实 `NEW_API_*` 配置替换默认 mock 目标
- `okx_usdt` 建议启用扫单适配器
- `wechat_qr` / `alipay_qr` 在未接官方 API 时可继续使用人工二维码审核模式
- `/metrics` 不建议直接暴露公网

## 文档阅读顺序

如果你现在觉得文档很多，先按这个顺序看：

### 第 1 份：先看这份使用教程

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

适合：

- 想快速知道“应该先看哪份文档”
- 第一次接手项目
- 想知道后台每个页面怎么用
- 想知道商品、支付、履约、交付应该按什么顺序配置

### 第 2 份：再看系统配置说明

- [后台系统配置说明](./passdock-admin-system-config-guide.md)

适合：

- 想看字段级解释
- 想知道支付通道、Provider、Action、策略这些字段具体怎么填

### 第 3 份：最后看总说明和部署

- [README.md](./README.md)
- [前端说明](./apps/web/README.md)
- [后端环境变量示例](./passdock.env.example)

适合：

- 本地启动
- 镜像部署
- 生产环境准备

### 这些文档按需看

- [总体产品与架构方案](./tg-code-platform-plan.md)
- [接口草案](./passdock-api-draft.md)
- [配置说明](./passdock-config-reference.md)
- [枚举字典](./passdock-enums.md)
- [SQLite 到 PostgreSQL 迁移计划](./passdock-migration-plan.md)
- [闭环任务清单](./passdock-closure-task-list.md)

## 验证建议

完成部署后至少检查以下节点：

1. 前台是否能正常加载商品列表
2. 后台是否能使用默认管理员账号登录
3. 创建订单后是否能看到 `订单号 + 查单码 + 支付指引`
4. 使用 `订单号 + 查单码` 是否能重新查到订单
5. 人工二维码订单能否上传凭证并进入审核
6. `okx_usdt` 订单是否能被扫单确认
7. 履约后是否能在站内和 Telegram 看到交付结果
8. `/healthz`、`/readyz`、`/metrics` 是否正常返回

## 当前验证边界

当前仓库已经完成并实际跑过的验证：

- `apps/web` 已通过 `npm run build`
- `apps/server` 已通过 `go test ./...`
- 前台匿名下单、订单号/查单码查询这条代码链路已经接通
- 后台“标记退款 / 发起原路退款”已拆成独立动作

仍需要你在真实环境完成的联调验证：

- 微信 / 支付宝官方支付与退款接口
- OKX 实盘扫单与退款回执
- Telegram Bot Token、Webhook Secret、真实回调地址
- MinIO 或真实对象存储配置
- `new-api` 生产环境 Provider / Action / 鉴权参数
