# PassDock 接口草案

文档分类：

- 类型：技术对接参考
- 适用场景：前后端联调、二开、外部系统接入
- 是否建议第一次优先阅读：否

第一次接手项目建议先看：

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

## 1. 概述

`PassDock` 是一个数字商品销售与自动交付平台，当前重点支持：

- AI 充值码商品
- 订阅激活码商品
- Telegram 交付
- 微信二维码、支付宝二维码、OKX USDT 收款
- 可配置上游集成

本文档用于沉淀当前项目的接口边界、路径设计、认证方式和关键响应结构。

## 2. 统一约定

### 路径前缀

- 前台 / 用户接口：`/api/v1`
- 后台接口：`/api/v1/admin`
- 支付回调：`/api/v1/callbacks`
- 内部接口：`/internal/v1`

### 认证方式

- 前台商品浏览与下单：默认不要求用户登录
- 前台订单访问：当前推荐通过 `订单号 + X-PassDock-Order-Token`
- 用户账号接口：`Authorization: Bearer <session-token>`
- 后台接口：`Authorization: Bearer <session-token>` 或 `ADMIN_BEARER_TOKEN`
- 回调接口：按支付通道配置校验
- 内部接口：HMAC 签名

当前前台匿名订单访问头：

- `X-PassDock-Order-Token`

当前内部接口签名头：

- `X-PassDock-Key`
- `X-PassDock-Timestamp`
- `X-PassDock-Nonce`
- `X-PassDock-Sign`

### 幂等建议

以下写接口应带 `X-Idempotency-Key`：

- 创建订单
- 确认支付
- 触发履约
- 重试履约
- 重试交付
- 退款

### 统一响应包

```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

### 常用错误码语义

- `INVALID_PARAMS`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `ORDER_NOT_FOUND`
- `ORDER_STATUS_INVALID`
- `PAYMENT_NOT_CONFIRMED`
- `FULFILLMENT_FAILED`
- `DELIVERY_FAILED`
- `UPSTREAM_REQUEST_FAILED`
- `IDEMPOTENCY_CONFLICT`

## 3. 核心领域模型

### 商品

一个商品会绑定：

- 一个履约策略
- 一个交付策略

### 履约

履约是平台策略，不写死为某一种行为。

支持类型：

- `issue_code`
- `issue_subscription`
- `issue_license`
- `credit_account`
- `call_webhook`
- `manual_delivery`

### 交付

交付独立于履约结果，可单独重试。

支持通道：

- `web`
- `telegram`
- `email`
- `manual`

## 4. 前台公开接口

### 4.1 获取商品列表

- 方法：`GET`
- 路径：`/api/v1/public/products`

查询参数：

- `product_type`
- `currency`
- `enabled`

### 4.2 获取商品详情

- 方法：`GET`
- 路径：`/api/v1/public/products/{productId}`

### 4.3 获取支付通道列表

- 方法：`GET`
- 路径：`/api/v1/public/payment-channels`

查询参数：

- `currency`
- `product_id`

### 4.4 创建订单

- 方法：`POST`
- 路径：`/api/v1/orders`

请求示例：

```json
{
  "product_id": 1001,
  "payment_method": "wechat_qr",
  "source_channel": "web",
  "buyer_ref": "tg:123456789",
  "quantity": 1,
  "currency": "RMB"
}
```

响应重点字段：

- `order_no`
- `order_access_token`
- `status`
- `payment_status`
- `payment_instruction`

### 4.5 获取订单详情

- 方法：`GET`
- 路径：`/api/v1/orders/{orderNo}`

说明：

- 未登录买家可通过订单访问令牌读取
- 当前推荐访问方式：`订单号 + X-PassDock-Order-Token`
- 前台支付凭证预览也依赖该访问令牌

### 4.6 上传支付凭证

- 方法：`POST`
- 路径：`/api/v1/orders/{orderNo}/payment-proofs`

### 4.7 买家标记“我已支付”

- 方法：`POST`
- 路径：`/api/v1/orders/{orderNo}/mark-paid`

适用场景：

- 微信 / 支付宝人工二维码
- 买家提交转账凭证后进入待审核

### 4.8 取消订单

- 方法：`POST`
- 路径：`/api/v1/orders/{orderNo}/cancel`

### 4.9 查看交付结果

- 方法：`GET`
- 路径：`/api/v1/orders/{orderNo}/delivery`

## 5. 用户账号接口

说明：

- 用户账号接口仍然保留
- 但当前默认对外主流程不是“先注册/登录再下单”
- 当前前台主流程更推荐匿名下单 + `订单号 + 查单码`

### 5.1 注册

- `POST /api/v1/auth/register`

### 5.2 登录

- `POST /api/v1/auth/login`

### 5.3 登出

- `POST /api/v1/auth/logout`

### 5.4 当前用户信息

- `GET /api/v1/me`

### 5.5 我的订单

- `GET /api/v1/me/orders`

查询参数：

- `status`
- `payment_status`
- `delivery_status`
- `page`
- `page_size`

### 5.6 我的订单详情

- `GET /api/v1/me/orders/{orderNo}`

### 5.7 我的工单

- `GET /api/v1/me/tickets`

### 5.8 创建工单

- `POST /api/v1/me/tickets`

## 6. Telegram 接口

### 6.1 Telegram Webhook

- `POST /api/v1/bots/{botKey}/telegram/webhook`

### 6.2 Telegram 绑定确认

- `POST /api/v1/bots/{botKey}/telegram/bind`

### 6.3 Telegram 交付重试

- `POST /api/v1/bots/{botKey}/telegram/deliveries/{deliveryRecordId}/retry`

### 6.4 后台测试发送

- `POST /api/v1/admin/bots/{botKey}/telegram/test-send`

### 6.5 后台模拟 Webhook

- `POST /api/v1/admin/bots/{botKey}/telegram/simulate-webhook`

## 7. 支付回调接口

### 7.1 通用支付回调

- 方法：`POST`
- 路径：`/api/v1/callbacks/payments/{channelKey}`

行为：

- 校验回调签名 / 鉴权
- 按支付通道配置映射第三方字段
- 归一化为平台支付确认输入
- 自动推进支付状态
- 根据通道配置触发自动履约 / 自动交付

### 7.2 OKX / 链上内部确认

- 方法：`POST`
- 路径：`/internal/v1/payments/onchain/confirm`

请求示例：

```json
{
  "order_no": "PD202604120001",
  "chain_tx_hash": "0x123",
  "amount": "10.00",
  "currency": "USDT"
}
```

## 8. 后台商品接口

### 8.1 商品列表

- `GET /api/v1/admin/products`

### 8.2 创建商品

- `POST /api/v1/admin/products`

### 8.3 商品详情

- `GET /api/v1/admin/products/{productId}`

### 8.4 更新商品

- `PUT /api/v1/admin/products/{productId}`

### 8.5 删除商品

- `DELETE /api/v1/admin/products/{productId}`

### 8.6 商品价格列表

- `GET /api/v1/admin/products/{productId}/prices`

### 8.7 创建 / 更新商品价格

- `POST /api/v1/admin/products/{productId}/prices`

## 9. 后台支付通道接口

### 9.1 通道列表

- `GET /api/v1/admin/payment-channels`

### 9.2 创建通道

- `POST /api/v1/admin/payment-channels`

### 9.3 更新通道

- `PUT /api/v1/admin/payment-channels/{channelId}`

### 9.4 删除通道

- `DELETE /api/v1/admin/payment-channels/{channelId}`

## 10. 后台集成中心接口

### 10.1 Provider 列表

- `GET /api/v1/admin/integrations/providers`

### 10.2 创建 Provider

- `POST /api/v1/admin/integrations/providers`

### 10.3 更新 Provider

- `PUT /api/v1/admin/integrations/providers/{providerId}`

### 10.4 删除 Provider

- `DELETE /api/v1/admin/integrations/providers/{providerId}`

### 10.5 Provider 健康检查

- `POST /api/v1/admin/integrations/providers/{providerId}/health-check`

当前状态映射：

- `mock://...` => `unknown`
- `internal://...` => `healthy`
- 上游 `2xx / 3xx` => `healthy`
- 上游 `4xx` => `degraded`
- 上游 `5xx / 网络错误` => `failed`

### 10.6 Action 列表

- `GET /api/v1/admin/integrations/providers/{providerId}/actions`

### 10.7 创建 Action

- `POST /api/v1/admin/integrations/providers/{providerId}/actions`

### 10.8 更新 Action

- `PUT /api/v1/admin/integrations/actions/{actionId}`

### 10.9 删除 Action

- `DELETE /api/v1/admin/integrations/actions/{actionId}`

### 10.10 Action 测试

- `POST /api/v1/admin/integrations/actions/{actionId}/test`

支持模式：

- `auto`
- `preview`
- `live`

模式说明：

- `preview`：只渲染模板，不发请求
- `auto`：内部 / mock Provider 可真实执行，外部 Provider 仅预览
- `live`：仅在安全条件下允许执行真实请求

## 11. 后台履约策略接口

### 11.1 策略列表

- `GET /api/v1/admin/fulfillment-strategies`

### 11.2 创建策略

- `POST /api/v1/admin/fulfillment-strategies`

### 11.3 更新策略

- `PUT /api/v1/admin/fulfillment-strategies/{strategyId}`

### 11.4 删除策略

- `DELETE /api/v1/admin/fulfillment-strategies/{strategyId}`

### 11.5 渲染预览

- `POST /api/v1/admin/fulfillment-strategies/{strategyId}/preview`

## 12. 后台交付策略接口

### 12.1 列表

- `GET /api/v1/admin/delivery-strategies`

### 12.2 创建

- `POST /api/v1/admin/delivery-strategies`

### 12.3 更新

- `PUT /api/v1/admin/delivery-strategies/{strategyId}`

### 12.4 删除

- `DELETE /api/v1/admin/delivery-strategies/{strategyId}`

### 12.5 测试

- `POST /api/v1/admin/delivery-strategies/{strategyId}/test`

## 13. 后台订单操作接口

### 13.1 订单列表

- `GET /api/v1/admin/orders`

### 13.2 订单详情

- `GET /api/v1/admin/orders/{orderNo}`

### 13.3 确认支付

- `POST /api/v1/admin/orders/{orderNo}/confirm-payment`

### 13.4 驳回支付

- `POST /api/v1/admin/orders/{orderNo}/reject-payment`

### 13.5 触发履约

- `POST /api/v1/admin/orders/{orderNo}/fulfill`

### 13.6 重试履约

- `POST /api/v1/admin/orders/{orderNo}/retry-fulfillment`

### 13.7 触发交付

- `POST /api/v1/admin/orders/{orderNo}/deliver`

### 13.8 重试交付

- `POST /api/v1/admin/orders/{orderNo}/retry-delivery`

### 13.9 完成人工交付

- `POST /api/v1/admin/orders/{orderNo}/complete-delivery`

### 13.10 取消订单

- `POST /api/v1/admin/orders/{orderNo}/cancel`

### 13.11 退款

- `POST /api/v1/admin/orders/{orderNo}/refund`

### 13.12 补发结果

- `POST /api/v1/admin/orders/{orderNo}/resend`

## 14. 后台履约 / 交付查询接口

### 14.1 履约记录列表

- `GET /api/v1/admin/fulfillment-records`

### 14.2 履约记录详情

- `GET /api/v1/admin/fulfillment-records/{recordId}`

### 14.3 发码记录列表

- `GET /api/v1/admin/code-issue-records`

### 14.4 发码记录详情

- `GET /api/v1/admin/code-issue-records/{recordId}`

### 14.5 交付记录列表

- `GET /api/v1/admin/delivery-records`

### 14.6 交付记录详情

- `GET /api/v1/admin/delivery-records/{recordId}`

## 15. 后台客服接口

### 15.1 工单列表

- `GET /api/v1/admin/tickets`

### 15.2 工单详情

- `GET /api/v1/admin/tickets/{ticketNo}`

### 15.3 指派工单

- `POST /api/v1/admin/tickets/{ticketNo}/assign`

### 15.4 解决工单

- `POST /api/v1/admin/tickets/{ticketNo}/resolve`

## 16. 内部任务接口

当前内部作用域映射：

- `orders.fulfillment` -> `/internal/v1/orders/{orderNo}/fulfillment-jobs`
- `orders.delivery` -> `/internal/v1/orders/{orderNo}/delivery-jobs`
- `orders.expire` -> `/internal/v1/orders/{orderNo}/expire`
- `orders.read` -> `/internal/v1/orders/{orderNo}/sync`
- `integrations.execute` -> `/internal/v1/integrations/{providerKey}/actions/{actionKey}/execute`
- `payments.confirm` -> `/internal/v1/payments/onchain/confirm`

### 16.1 执行履约任务

- `POST /internal/v1/orders/{orderNo}/fulfillment-jobs`

### 16.2 执行交付任务

- `POST /internal/v1/orders/{orderNo}/delivery-jobs`

### 16.3 过期订单处理

- `POST /internal/v1/orders/{orderNo}/expire`

### 16.4 同步订单状态

- `POST /internal/v1/orders/{orderNo}/sync`

### 16.5 通用上游动作执行

- `POST /internal/v1/integrations/{providerKey}/actions/{actionKey}/execute`

## 17. 运维端点

### 17.1 存活检查

- `GET /healthz`

返回：

```json
{
  "status": "ok"
}
```

### 17.2 就绪检查

- `GET /readyz`

当前检查：

- 数据库连通性
- 上传存储可用性

失败时返回 `503 Service Unavailable`。

### 17.3 Prometheus 指标

- `GET /metrics`

当前包含：

- Go 运行时指标
- PassDock HTTP 请求计数
- PassDock HTTP 请求耗时直方图

## 18. 状态约束建议

### 订单状态

- 未确认支付前不能进入 `issuing`
- 履约成功前不能进入 `delivered`
- 退款不能重复执行
- 同一订单不能在无幂等保护下重复发码

### 履约约束

- 同一 `order_no + fulfillment_type` 只应有一个最终结果
- 同一 `external_ref` 不能绑定到多个订单
- 重试前应先查历史履约记录

### 交付约束

- 交付可以重试
- 同一结果应尽量避免重复向用户可见地发送
- 交付失败不能覆盖已存在的履约结果

## 19. 后续建议

建议下一步基于本草案产出：

1. `openapi.yaml`
2. 稳定的枚举常量定义
3. 前后端共享的字段契约
4. 更细粒度的模块测试用例
