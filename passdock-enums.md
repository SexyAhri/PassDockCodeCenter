# PassDock 枚举字典

文档分类：

- 类型：技术字典参考
- 适用场景：查状态值、字段枚举、联调时对值
- 是否建议第一次优先阅读：否

第一次接手项目建议先看：

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

## 说明

本文件定义项目中需要保持一致的核心枚举值，适用范围包括：

- 数据库字段
- 后端 API
- 前端管理台
- 异步任务与内部流程
- Telegram 与交付逻辑

约束规则：

- 枚举值统一使用小写下划线风格
- 数据库与 API 保持同一套值
- 枚举本身不做本地化
- 前端只对显示文案做翻译

## 应用与数据库

### `db_driver`

- `sqlite`
- `postgres`

### `app_env`

- `development`
- `staging`
- `production`

## 商品

### `product_type`

- `recharge`
- `subscription`
- `digital`
- `manual`

## 支付

### `payment_method`

- `wechat_qr`
- `alipay_qr`
- `okx_usdt`

### `payment_channel_type`

- `wechat_qr`
- `alipay_qr`
- `okx_usdt`
- `manual_bank`
- `custom`

### `payment_status`

- `unpaid`
- `pending_review`
- `paid`
- `failed`
- `refunded`

## 订单

### `order_status`

- `created`
- `awaiting_payment`
- `paid_pending_review`
- `payment_confirmed`
- `issuing`
- `issued`
- `delivery_pending`
- `delivered`
- `completed`
- `cancelled`
- `expired`
- `failed`
- `refunded`

### `source_channel`

- `web`
- `telegram`
- `admin`
- `api`

## 履约

### `fulfillment_type`

- `issue_code`
- `issue_subscription`
- `issue_license`
- `credit_account`
- `call_webhook`
- `manual_delivery`

### `fulfillment_status`

- `pending`
- `running`
- `success`
- `failed`
- `cancelled`

### `code_type`

- `redemption`
- `subscription_code`

## 交付

### `delivery_channel`

- `web`
- `telegram`
- `email`
- `manual`

### `delivery_status`

- `pending`
- `sending`
- `sent`
- `failed`
- `cancelled`

## 客服

### `ticket_status`

- `open`
- `processing`
- `resolved`
- `closed`

### `ticket_priority`

- `low`
- `normal`
- `high`
- `urgent`

## 集成

### `auth_type`

- `none`
- `bearer_token`
- `static_header`
- `hmac_sha256`
- `query_signature`

### `integration_health_status`

- `unknown`
- `healthy`
- `degraded`
- `failed`

### `http_method`

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

## 用户与权限

### `user_role`

- `user`
- `admin`
- `operator`

### `user_status`

- `active`
- `disabled`
- `pending`

## 内部客户端密钥

### `client_key_status`

- `active`
- `disabled`
- `expired`
