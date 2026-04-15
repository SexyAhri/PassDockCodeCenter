# PassDock 平台方案

文档分类：

- 类型：架构参考
- 适用场景：理解系统定位、设计目标和模块边界
- 是否建议第一次优先阅读：否

第一次接手项目建议先看：

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

## 1. 项目定位

### 推荐名称

- 英文名：`PassDock`
- 中文名：`PassDock 码中心`

### 核心定位

`PassDock` 是一个独立的数字商品销售与交付平台，负责：

- 商品展示
- 下单与支付
- 支付确认 / 审核
- 对接上游发码
- 网站 / Telegram 交付
- 后台运营与售后

它不是为了替代 `new-api`，而是围绕 `new-api` 或其他上游发码系统构建一层独立销售平台。

## 2. 设计目标

项目从一开始就按“通用数字履约平台”来设计，而不是把代码写死成某一个上游。

推荐抽象链路：

```text
商品 -> 履约策略 -> 上游动作 -> 交付策略
```

而不是：

```text
商品 -> 写死的 new-api 接口 -> 返回一个码
```

## 3. 业务边界

### PassDock 负责

- 商品中心
- 价格模板
- 订单中心
- 支付与支付审核
- Telegram Bot 交互
- 履约触发与交付投递
- 工单与后台运营
- 审计与运行时配置

### 上游系统负责

- 账号体系
- 实际额度或订阅生效
- 充值码 / 激活码的真正消费
- 模型调用与计费

## 4. 目标场景

首发支持：

- 充值码商品
- 订阅激活码商品
- 微信二维码收款
- 支付宝二维码收款
- OKX USDT 收款
- 网站交付
- Telegram 交付

后续仍可扩展：

- License Key
- 文件类数字商品
- Webhook 型履约
- 人工交付类商品

## 5. 技术选型

### 前端

- React
- TypeScript
- Vite
- SCSS
- Ant Design

### 后端

- Go
- Gin
- GORM

### 数据库与存储

- SQLite：单机快速部署
- PostgreSQL：正式生产扩展
- 本地存储 / MinIO：支付凭证与上传文件

### 部署

- Docker
- Docker Compose
- Nginx 反向代理

### 运维

- `/healthz`
- `/readyz`
- `/metrics`
- 可插拔错误上报接口

## 6. 核心模块

### 前台站点

- 商品首页
- 商品详情
- 结算工作台
- 订单详情
- 匿名订单查询中心（订单号 + 查单码）

### 后台控制台

- 仪表盘
- 商品中心
- 订单中心
- 支付中心
- 履约中心
- Telegram 中心
- 客户中心
- 工单中心
- 系统中心

### 后端服务

- 认证与会话
- 商品与价格
- 订单与支付
- 履约与交付
- Telegram Webhook 与命令
- 集成 Provider / Action
- 运行时设置与审计

## 7. 商品模型

### 商品类型

- `recharge`
- `subscription`
- `digital`
- `manual`

### 支付方式

- `wechat_qr`
- `alipay_qr`
- `okx_usdt`

### 交付方式

- `web`
- `telegram`
- `email`
- `manual`

### 履约方式

- `issue_code`
- `issue_subscription`
- `issue_license`
- `credit_account`
- `call_webhook`
- `manual_delivery`

## 8. 关键业务流

### 充值码商品

1. 用户选择商品
2. 创建订单
3. 选择支付方式
4. 支付成功或审核通过
5. PassDock 触发上游发码
6. 存储履约结果
7. 站内或 Telegram 交付
8. 用户去上游系统兑换

### 订阅商品

1. 用户选择订阅商品
2. 创建订单
3. 支付成功
4. PassDock 调用上游订阅激活码接口
5. 记录发码结果
6. 站内 / Telegram 交付
7. 用户到上游系统激活

## 9. 支付策略

### 微信 / 支付宝

当前主策略：

- 前台展示收款码
- 买家上传凭证
- 后台审核确认
- 审核通过后触发履约

扩展策略：

- 聚合支付或官方接口回调
- 通过回调字段映射做统一归一化

### OKX USDT

当前主策略：

- 一单一金额
- 扫单适配器轮询
- 内部确认支付
- 自动触发履约

## 10. Telegram 方案

### 已支持命令方向

- `/start`
- `/shop`
- `/buy`
- `/orders`
- `/pay`
- `/proof`
- `/check`
- `/code`
- `/support`

### Bot 能力

- 绑定账号
- 浏览商品
- 快速下单
- 支付提醒
- 上传支付凭证
- 订单状态查询
- 补发已交付结果

### 交付规则

- 用户未启动 Bot 时，自动回退到站内交付
- 交付任务以 `order_no` 为核心做幂等
- 敏感结果在运营视图中做脱敏

## 11. 集成中心设计

### Provider

Provider 负责描述上游：

- `provider_key`
- `provider_name`
- `base_url`
- `auth_type`
- `auth_config`
- `timeout_ms`
- `retry_times`
- `enabled`

### Action

Action 负责描述动作：

- `action_key`
- `http_method`
- `path_template`
- `header_template`
- `body_template`
- `success_path`
- `message_path`
- `code_list_path`

### 履约策略

履约策略负责把商品与上游动作真正串起来：

- `strategy_key`
- `fulfillment_type`
- `provider_key`
- `action_key`
- `request_template`
- `result_schema`
- `delivery_template`
- `retry_policy`

## 12. 鉴权与安全

### 内部接口签名

推荐使用 HMAC-SHA256：

- `X-PassDock-Key`
- `X-PassDock-Timestamp`
- `X-PassDock-Nonce`
- `X-PassDock-Sign`

签名源串：

```text
METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + BODY_SHA256
```

### 关键安全规则

- 时间戳漂移限制
- Nonce 去重
- 请求体哈希校验
- Internal Client Key 按 scope 控制
- 支付凭证文件只允许前台订单令牌或管理员访问
- 运营视图不同时展示完整支付凭证与完整码内容

## 13. 数据模型重点

核心表：

- `users`
- `payment_channels`
- `integration_providers`
- `integration_actions`
- `fulfillment_strategies`
- `delivery_strategies`
- `products`
- `product_prices`
- `orders`
- `payment_records`
- `payment_proofs`
- `fulfillment_records`
- `code_issue_records`
- `delivery_records`
- `support_tickets`
- `runtime_settings`
- `internal_client_keys`
- `admin_operation_logs`

## 14. 状态机建议

### 订单状态

```text
created
  -> awaiting_payment
  -> paid_pending_review
  -> payment_confirmed
  -> issuing
  -> issued
  -> delivery_pending
  -> delivered
  -> completed
```

异常路径：

```text
awaiting_payment -> expired
awaiting_payment -> cancelled
paid_pending_review -> failed
issuing -> failed
delivered -> refunded
```

### 支付状态

- `unpaid`
- `pending_review`
- `paid`
- `failed`
- `refunded`

### 交付状态

- `pending`
- `sending`
- `sent`
- `failed`

## 15. 后台功能矩阵

### 商品中心

- 商品 CRUD
- 价格模板管理
- 上下架
- 履约策略绑定

### 订单中心

- 搜索、筛选、详情
- 确认支付
- 驳回支付
- 触发 / 重试履约
- 触发 / 重试交付
- 人工完成交付
- 取消与退款

### 支付中心

- 支付记录
- 凭证审核
- 回调日志
- OKX 扫单记录

### 履约中心

- 履约记录
- 发码记录
- 交付记录
- 失败诊断

### Telegram 中心

- Bot 配置
- Webhook 信息
- Webhook 同步 / 删除
- 绑定记录
- 测试发送
- 交付重试

### 系统中心

- Provider 管理
- Action 管理
- 支付通道管理
- 履约策略管理
- 交付策略管理
- Internal Client Key
- Runtime Settings
- 审计日志

## 16. 上线建议

### 单机快速上线

- SQLite
- 本地存储
- 人工二维码审核
- OKX 扫单

### 正式生产

- PostgreSQL
- 按需启用 MinIO
- 真实 `new-api` 内部适配器
- Telegram Webhook 正式地址
- `/metrics` 接入采集系统

## 17. 已实现状态说明

当前仓库代码已经覆盖：

- 前台 / 后台核心页面
- 订单与支付主链路
- OKX 扫单
- 微信 / 支付宝人工二维码审核
- Telegram 交互与交付
- Provider / Action / Strategy 真实表单和编辑流
- 支付凭证安全访问
- 就绪检查与指标端点

仍由部署侧决定的内容：

- 是否接入外部 Prometheus / Grafana
- 是否将错误上报接口接到 Sentry
- 是否启用 MinIO 作为对象存储

## 18. 相关文档

- [项目总 README](./README.md)
- [接口草案](./passdock-api-draft.md)
- [配置参考](./passdock-config-reference.md)
- [枚举字典](./passdock-enums.md)
- [迁移计划](./passdock-migration-plan.md)
- [闭环清单](./passdock-closure-task-list.md)
