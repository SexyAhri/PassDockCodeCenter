# PassDock 后台系统配置说明

## 文档定位

如果你是第一次用这个系统，建议先看：

- [系统使用教程](./passdock-system-usage-guide.md)

这份文档对应后台“系统中心”页面，目标不是介绍代码结构，而是说明后台每一类系统配置该怎么填、什么时候填、填完会影响哪里。

系统中心负责的是“业务底座配置”，主要覆盖：

- 支付通道
- 上游集成服务与动作模板
- 履约策略
- 交付策略
- Telegram 机器人
- 内部客户端密钥
- 运行参数
- 审计日志

它不直接维护商品本身，但会决定商品是否能正常下单、收款、审核、履约、交付和通知。

## 生效优先级

后台系统配置不是所有模块都遵循同一套优先级，实际规则如下：

### 1. 常规业务配置

适用于支付通道、Provider、Action、履约策略、交付策略、内部客户端。

优先级：

`数据库/后台配置 > 代码默认值`

### 2. Telegram 机器人

优先级：

`数据库 Bot 配置 > 环境变量引导配置`

说明：

- 后台列表会同时展示数据库中的机器人配置和环境变量引导出的配置
- `source = db` 表示来自后台保存
- `source = config` 表示来自环境变量
- 同一个 `botKey` 如果数据库里已经有记录，则以后端库记录为准

### 3. 运行参数

优先级：

`环境变量 > runtime_settings 表记录 > 代码默认值`

说明：

- 后台里看到的“配置值”不一定是最终生效值
- 真正以“生效值 effectiveValue”和“来源 valueSource”为准
- 如果同名环境变量存在，后台表中的值会被覆盖

## 推荐配置顺序

建议按下面顺序配置，能最快形成闭环：

1. 先配 `Telegram 机器人`
2. 再配 `支付通道`
3. 再配 `集成服务`
4. 再配 `集成动作`
5. 再配 `履约策略`
6. 再配 `交付策略`
7. 回到商品中心，给商品绑定 `fulfillment_strategy_key` 和 `delivery_strategy_key`
8. 最后补 `内部客户端` 和 `运行参数`

如果一上来先配商品，不先配这些底层策略，商品能显示，但下单后不一定能真正闭环。

## 系统中心分区总览

当前后台系统中心包含以下分区：

- `paymentChannels` 支付通道
- `providers` 集成服务
- `actions` 集成动作
- `fulfillmentStrategies` 履约策略
- `deliveryStrategies` 交付策略
- `telegramConfigs` Telegram 机器人
- `internalClientKeys` 内部客户端
- `runtimeSettings` 运行参数
- `auditLogs` 审计日志

## 1. 支付通道

支付通道是前台下单时“支付方式”的实际来源。当前系统固定支持 4 种通道类型，后台创建时直接从下拉框选择即可：

- `wechat_qr`
- `alipay_qr`
- `okx_usdt`
- `usdt_qr`

### 适用场景

- `wechat_qr`：微信人工扫码收款
- `alipay_qr`：支付宝人工扫码收款
- `okx_usdt`：OKX USDT 自动监听或自动确认
- `usdt_qr`：普通 USDT 收款码，通常用于人工确认

### 关键字段

| 字段 | 是否必填 | 说明 | 推荐写法 |
| --- | --- | --- | --- |
| `channelType` | 是 | 通道类型，固定 4 选 1 | 直接按实际收款方式选择 |
| `channelKey` | 是 | 通道唯一标识，建议稳定不变 | `wechat_qr_main` / `okx_usdt_watch` |
| `channelName` | 是 | 后台识别名称 | `WeChat QR`、`OKX USDT` |
| `displayNameZh` | 否 | 前台中文名称 | `微信收款码` |
| `displayNameEn` | 否 | 前台英文名称 | `WeChat QR` |
| `modeLabelZh` | 否 | 前台中文模式说明 | `人工确认`、`链上监听` |
| `modeLabelEn` | 否 | 前台英文模式说明 | `Manual review`、`On-chain watcher` |
| `providerName` | 是 | 支付通道归属提供方标识 | `manual_qr` / `chain_watcher` |
| `currency` | 是 | 收款币种 | `RMB` 或 `USDT` |
| `settlementMode` | 是 | 结算模式 | `manual` 或 `auto` |
| `enabled` | 是 | 是否启用 | 正在对外收款时开启 |
| `autoFulfill` | 否 | 收款成功后是否自动进入履约 | 自动发码场景建议开启 |
| `autoDeliver` | 否 | 履约成功后是否自动交付 | Telegram/站内自动交付建议开启 |
| `qrValue` | 否 | 收款内容 | 可填二维码文本、地址，或上传后的图片 URL |
| `reference` | 否 | 通道参考号/外部标识 | `WX-PASSDOCK-MAIN` |

### 回调鉴权字段

以下字段用于自动支付回调，不做自动回调时可以留默认或空值：

| 字段 | 说明 |
| --- | --- |
| `callbackAuthType` | 回调鉴权方式：`none`、`static_header`、`hmac_sha256` |
| `callbackSecret` | 回调密钥 |
| `callbackKey` | HMAC 模式下可选的渠道标识键 |
| `callbackHeaderName` | 自定义请求头名称 |
| `callbackSignHeader` | 签名请求头名称 |
| `callbackTimestampHeader` | 时间戳请求头名称 |
| `callbackNonceHeader` | nonce 请求头名称 |
| `callbackSignatureParam` | 如果签名不在 Header，可从 Query 参数取 |
| `callbackTimestampParam` | 如果时间戳不在 Header，可从 Query 参数取 |
| `callbackNonceParam` | 如果 nonce 不在 Header，可从 Query 参数取 |
| `callbackTTLSeconds` | 时间戳验签时间窗，防重放 |
| `callbackSignSource` | 签名源拼接规则 |

### 退款字段

如果你要把“原路退款”接到真实支付接口，而不是只在后台人工改状态，就要继续配置下面 4 个字段：

| 字段 | 是否必填 | 说明 | 推荐写法 |
| --- | --- | --- | --- |
| `refundProviderKey` | 否 | 原路退款调用哪个 Provider | `okx_pay_prod` |
| `refundActionKey` | 否 | 原路退款调用哪个 Action | `refund_order` |
| `refundStatusPath` | 否 | 从退款响应里提取退款状态的路径 | `data.status` |
| `refundReceiptPath` | 否 | 从退款响应里提取退款回执号的路径 | `data.refund_id` |

这 4 个字段的语义是：

- `refundProviderKey + refundActionKey`：决定后台点击“发起原路退款”时实际调用哪个上游接口
- `refundStatusPath`：把渠道返回值归一化成 `succeeded / processing / failed`
- `refundReceiptPath`：把渠道回执号、退款单号或交易回执存下来，方便售后追踪和失败重试

如果这 4 个字段不填：

- 后台仍然可以使用“标记退款”
- 但不能发起“真实原路退款”
- 订单不会调用微信 / 支付宝 / OKX / 其他 Provider 的退款接口

### 后台退款动作怎么理解

后台订单页现在有两个退款动作，语义必须分开理解：

#### 1. 标记退款

适用于：

- 线下已经处理完退款
- 第三方系统外部已经退款完成
- 只是需要把 PassDock 内部订单状态、支付状态和审计日志补齐

效果：

- 立即把订单状态推进到 `refunded`
- 立即把支付记录标记为 `refunded`
- 新增一条 `refund_records` 记录，`refund_type = mark`
- 不会调用任何微信 / 支付宝 / OKX / Provider 的外部退款接口

#### 2. 发起原路退款

适用于：

- 需要由 PassDock 直接调用支付通道退款接口
- 需要保存退款回执号、退款状态、失败原因
- 需要后续支持失败后再次发起

效果：

- 会先创建一条 `refund_records` 记录，`refund_type = original`
- 然后调用 `refundProviderKey + refundActionKey` 指向的真实接口
- 根据返回结果更新退款状态：
  - `succeeded`：订单正式推进到 `refunded`
  - `processing`：仅记录“退款处理中”，订单保持已支付
  - `failed`：仅记录失败原因，订单保持已支付，允许再次发起

推荐做法：

- 微信 / 支付宝未接官方退款接口前，只用“标记退款”
- OKX 或其他已打通退款 API 的通道，再配置 `refundProviderKey / refundActionKey`
- 不建议把“发起原路退款”做成批量运营动作，避免误调用真实退款接口

### 回调鉴权怎么选

#### `callbackAuthType = none`

适用于：

- 人工二维码收款
- 没有真实回调接口的场景

效果：

- 不做验签
- 订单通常靠人工审核或扫单任务推进

#### `callbackAuthType = static_header`

适用于：

- 上游只会带固定 Token/Header 的简单回调

规则：

- 请求头 `callbackHeaderName` 的值必须等于 `callbackSecret`
- 如果没填 `callbackHeaderName`，系统默认使用 `X-PassDock-Callback-Token`

#### `callbackAuthType = hmac_sha256`

适用于：

- 正式支付回调
- 链上监听服务回调
- 自研网关回调

规则：

- 用 `callbackSecret` 做 HMAC-SHA256
- 如果填写了 `callbackKey`，则还会额外校验一个 Key Header
- 默认签名头是 `X-PassDock-Sign`
- 如果签名源需要时间戳，默认时间戳头是 `X-PassDock-Timestamp`
- 如果签名源需要 nonce，默认 nonce 头是 `X-PassDock-Nonce`
- `callbackTTLSeconds` 小于等于 0 时，如果当前签名模式依赖时间戳，会自动按 300 秒处理

### `callbackSignSource` 可选值

| 值 | 说明 | 适用场景 |
| --- | --- | --- |
| `body` | 对原始请求体签名 | 最常见 |
| `body_sha256` | 对请求体 SHA256 后再参与签名 | 一些中间层网关 |
| `timestamp_body` | `timestamp + "\n" + body` | 带时间戳的回调 |
| `method_path_timestamp_nonce_body_sha256` | `METHOD + path + timestamp + nonce + body_sha256` | 要求更严格的回调 |

### 推荐配置组合

#### 微信 / 支付宝人工收款

- `channelType`: `wechat_qr` 或 `alipay_qr`
- `providerName`: `manual_qr`
- `currency`: `RMB`
- `settlementMode`: `manual`
- `callbackAuthType`: `none`
- `qrValue`: 上传收款码图片后的 URL，或直接填二维码内容

适合：

- 还没接微信/支付宝官方接口
- 运营人工审核付款凭证

#### OKX USDT 自动确认

- `channelType`: `okx_usdt`
- `providerName`: `chain_watcher`
- `currency`: `USDT`
- `settlementMode`: `auto`
- `enabled`: `true`

配套要求：

- 运行参数里开启 `OKX_WATCHER_ENABLED`
- 配好 `OKX_WATCHER_INTERVAL_SECONDS`
- 配好 `OKX_WATCHER_BATCH_SIZE`

#### USDT 人工确认

- `channelType`: `usdt_qr`
- `providerName`: `manual_qr`
- `currency`: `USDT`
- `settlementMode`: `manual`
- `callbackAuthType`: `none`

### 配置注意事项

- `channelKey` 一旦被商品价格模板引用，不建议频繁修改
- `qrValue` 现在不仅能放文字，也可以放图片地址
- `wechat_qr` / `alipay_qr` 没接官方 API 时，完全可以走人工审核闭环
- 前台只展示启用且可用的通道

## 2. 集成服务 Providers

Provider 是“上游服务连接配置”，定义了 PassDock 要连哪个系统、用什么方式鉴权、超时和重试怎么处理。

### 典型用途

- 对接 `new-api`
- 对接内部发码服务
- 对接人工审核队列

### 关键字段

| 字段 | 是否必填 | 说明 | 推荐写法 |
| --- | --- | --- | --- |
| `providerKey` | 是 | 服务唯一标识 | `new_api_prod` |
| `providerName` | 是 | 后台展示名称 | `new-api production` |
| `baseUrl` | 是 | 服务基础地址 | `https://example.com` |
| `authType` | 是 | 鉴权类型 | `none` / `hmac_sha256` |
| `authConfig` | 否 | JSON 鉴权配置 | `{"key_id":"...","secret":"..."}` |
| `timeoutMs` | 是 | 请求超时毫秒数 | `10000` |
| `retryTimes` | 是 | 失败重试次数 | `0` 到 `2` 常见 |
| `health` | 是 | 当前健康状态 | `healthy` / `unknown` / `degraded` / `failed` |
| `enabled` | 是 | 是否启用 | 上线前开启 |

### `authConfig` 怎么填

`authConfig` 是 JSON，常见字段包括：

```json
{
  "key_id": "passdock-prod",
  "secret": "请替换为真实密钥",
  "sign_header": "X-PassDock-Sign"
}
```

建议：

- 统一使用 JSON 对象，不要塞拼接字符串
- 密钥类字段只放服务鉴权所需信息
- 业务字段不要混在 `authConfig` 里

### 系统内置引导 Provider

系统默认会引导出几类 Provider：

- `new_api_prod`
- `new_api_staging`
- `manual_review_queue`

说明：

- `new_api_prod` / `new_api_staging` 用于对接 `new-api`
- `manual_review_queue` 是内部人工处理队列型 Provider
- 严格环境下，如果还在使用 mock 地址或默认密钥，健康状态可能显示异常

## 3. 集成动作 Actions

Action 是“具体接口动作模板”，表示对某个 Provider 发起什么请求、请求体长什么样、从响应里提取哪些结果。

可以把 Provider 理解为“服务方”，Action 理解为“这个服务方上的某个 API”。

### 关键字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `providerKey` | 是 | 归属哪个 Provider |
| `actionKey` | 是 | 动作唯一标识 |
| `method` | 是 | HTTP 方法 |
| `pathTemplate` | 是 | 请求路径模板 |
| `successPath` | 是 | 响应成功字段路径 |
| `messagePath` | 否 | 响应消息字段路径 |
| `codeListPath` | 否 | 响应码列表字段路径 |
| `enabled` | 是 | 是否启用 |
| `headerTemplate` | 否 | 请求头模板 JSON |
| `queryTemplate` | 否 | Query 模板 JSON |
| `bodyTemplate` | 否 | Body 模板 JSON |

### 字段含义

- `successPath`：用于判断上游返回是否成功，例如 `success`
- `messagePath`：用于提取提示文案，例如 `message`
- `codeListPath`：用于提取发码结果，例如 `data.codes`
- `pathTemplate`：可拼接动态参数
- `headerTemplate` / `queryTemplate` / `bodyTemplate`：支持 JSON 模板变量

### 常见示例

#### 发码接口

```json
{
  "providerKey": "new_api_prod",
  "actionKey": "issue_redeem_code",
  "method": "POST",
  "pathTemplate": "/api/internal/redemption/issue",
  "successPath": "success",
  "messagePath": "message",
  "codeListPath": "data.codes"
}
```

#### Body 模板示例

```json
{
  "order_no": "{{order_no}}",
  "buyer_ref": "{{buyer_ref}}",
  "product_id": "{{product_id}}"
}
```

## 4. 履约策略 Fulfillment Strategies

履约策略是把“商品 -> 上游接口 -> 发码结果 -> 交付数据”串起来的关键层。

如果没有履约策略，商品虽然能卖，但支付成功后不会自动发码。

### 关键字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `strategyKey` | 是 | 履约策略唯一标识 |
| `strategyName` | 是 | 履约策略名称 |
| `fulfillmentType` | 是 | 履约类型 |
| `providerKey` | 是 | 调用哪个 Provider |
| `actionKey` | 是 | 调用哪个 Action |
| `enabled` | 是 | 是否启用 |
| `requestTemplate` | 否 | 实际请求映射模板 |
| `resultSchema` | 否 | 响应结果提取规则 |
| `deliveryTemplate` | 否 | 交付内容模板 |
| `retryPolicy` | 否 | 履约重试策略 |

### 怎么理解

- `requestTemplate`：把订单字段转换成上游接口真正需要的请求结构
- `resultSchema`：告诉系统从哪里提取 `codes`
- `deliveryTemplate`：把提取出的结果转成最终可交付内容
- `retryPolicy`：定义履约失败后的自动重试策略

### 典型示例

#### 请求模板

```json
{
  "order_no": "{{order_no}}",
  "buyer_ref": "{{buyer_ref}}"
}
```

#### 结果结构

```json
{
  "code_list_path": "data.codes",
  "mask_policy": "show_last_6"
}
```

#### 交付模板

```json
{
  "title": "充值码",
  "content": "卡密：{{codes[0]}}"
}
```

#### 重试策略

```json
{
  "max_retries": 2,
  "backoff_seconds": [5, 30]
}
```

### 与商品的关系

商品中心最终会引用：

- `fulfillment_strategy_key`

也就是说，商品能否自动发货，核心看这里，而不是只看商品本身。

## 5. 交付策略 Delivery Strategies

交付策略决定“履约结果最终通过什么方式发给用户”。

### 关键字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `strategyKey` | 是 | 交付策略唯一标识 |
| `strategyName` | 是 | 交付策略名称 |
| `channelType` | 是 | 交付渠道 |
| `maskPolicy` | 是 | 脱敏策略 |
| `resendAllowed` | 否 | 是否允许补发 |
| `enabled` | 是 | 是否启用 |
| `messageTemplate` | 否 | 交付消息模板 |

### 常见 `channelType`

- `web`
- `telegram`
- `manual`
- 其他已接入的交付通道

### 常见 `maskPolicy`

- `show_last_6`
- `masked_full`
- 空或自定义策略名

### 消息模板示例

```json
{
  "title": "Telegram 交付",
  "content": "您的卡密是 {{codes[0]}}"
}
```

### 与商品的关系

商品中心最终会引用：

- `delivery_strategy_key`

推荐理解方式：

- 履约策略负责“拿到结果”
- 交付策略负责“怎么发出去”

## 6. Telegram 机器人

Telegram 配置决定消息通知、订单查询、Bot 交付、Webhook 回调等能力是否正常。

### 关键字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `botKey` | 是 | 机器人唯一标识 |
| `botUsername` | 否 | 机器人用户名 |
| `botToken` | 是 | Bot Token |
| `webhookSecret` | 否 | Telegram Webhook 密钥 |
| `webhookUrl` | 否 | 自定义回调地址 |
| `webhookIP` | 否 | 对应 Telegram `setWebhook` 的 `ip_address` |
| `allowedUpdates` | 否 | 允许的更新类型 |
| `maxConnections` | 否 | 最大连接数 |
| `dropPendingUpdates` | 否 | 是否清理积压消息 |
| `enabled` | 是 | 是否启用 |

### 实际生效规则

- Telegram 配置保存在 `runtime_settings`
- `module` 固定为 `telegram_bot_configs`
- 列表里会把数据库配置和环境变量引导配置同时展示
- 当 `webhookUrl` 留空时，系统会自动拼出：

`APP_BASE_URL + /api/v1/bots/{botKey}/telegram/webhook`

### `webhookSecret` 规则

- 可留空
- 如果填写，必须是 1 到 256 位
- 只允许字母、数字、下划线、短横线

### `allowedUpdates` 推荐值

常用填法：

- `message,callback_query`

如果需要更完整交互，也可以按需追加其他 Telegram update 类型。

### 配置建议

- 生产环境建议每个业务 Bot 使用独立 `botKey`
- `botToken` 和 `webhookSecret` 视为密钥，避免暴露
- 后台“同步回调”操作可用于把当前配置推送到 Telegram

## 7. 内部客户端

内部客户端用于内部任务、签名调用和跨服务通信，不是给普通运营人员使用的账号。

### 关键字段

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `clientKey` | 是 | 客户端唯一标识 |
| `clientName` | 是 | 客户端名称 |
| `clientSecret` | 创建必填 | 客户端密钥 |
| `scopes` | 否 | 权限范围 |
| `allowedIPs` | 否 | 允许来源 IP |
| `status` | 是 | 当前状态 |

### 特别说明

- `clientSecret` 创建时必须填写
- 编辑已有记录时，如果留空，表示保留原密钥，不会清空
- `scopes` 支持逗号、换行、分号，系统保存时会自动去重并规范化
- `allowedIPs` 支持单 IP 和 CIDR

### 常见 Scope

- `orders.fulfillment`
- `orders.delivery`
- `orders.read`
- `payments.confirm`
- `integrations.execute`

### `status` 可选值

- `active`
- `disabled`
- `revoked`

建议：

- 调试环境使用最小权限 Scope
- 生产环境尽量限制 `allowedIPs`
- 被泄露的客户端直接改成 `revoked`

## 8. 运行参数 Runtime Settings

运行参数用于覆盖业务运行时的一些阈值和轮询频率，不需要改代码就能调整行为。

### 后台字段含义

| 字段 | 说明 |
| --- | --- |
| `module` | 配置所属模块 |
| `name` | 配置名，建议与环境变量名保持一致 |
| `value` | 后台配置值 |
| `scope` | 记录来源属性，通常填 `db` |
| `effectiveValue` | 实际生效值 |
| `valueSource` | 生效来源：`env` / `db` / `default` |
| `appliesLive` | 是否实时生效 |

### 必须知道的规则

- 真正优先级是 `env > db > default`
- `scope` 更像一项记录属性，不代表一定最终生效
- 判断当前线上到底用的是谁，必须看：
  - `effectiveValue`
  - `valueSource`

### 当前已接线参数

| 模块 | 名称 | 默认值 | 说明 | 是否实时生效 |
| --- | --- | --- | --- | --- |
| `orders` | `ORDER_EXPIRE_MINUTES` | `30` | 待支付订单超时分钟数 | 是 |
| `payments` | `PAYMENT_REVIEW_TIMEOUT_MINUTES` | `60` | 待审核支付超时分钟数 | 是 |
| `orders` | `ORDER_SWEEP_INTERVAL_SECONDS` | `30` | 自动扫单与超时推进的轮询间隔 | 是 |
| `queue` | `ASYNC_CONCURRENCY` | `10` | 异步重试任务并发数 | 是 |
| `queue` | `ASYNC_POLL_INTERVAL_SECONDS` | `10` | 异步队列轮询间隔 | 是 |
| `queue` | `DELIVERY_RETRY_MAX_RETRIES` | `2` | 自动补发最大重试次数 | 是 |
| `queue` | `DELIVERY_RETRY_DELAY_SECONDS` | `60` | 自动补发间隔秒数 | 是 |
| `payments` | `OKX_WATCHER_ENABLED` | `false` | 是否启用 OKX 监听任务 | 是 |
| `payments` | `OKX_WATCHER_INTERVAL_SECONDS` | `60` | OKX 扫单轮询间隔 | 是 |
| `payments` | `OKX_WATCHER_BATCH_SIZE` | `50` | 单次扫单检查的订单数 | 是 |

### 填写建议

- 后台新增时，`name` 最好直接使用系统已有名称
- 不要自己随意造一个新名字，除非后端已经接线
- 对整数类配置：
  - 大多要求大于 0
  - `DELIVERY_RETRY_MAX_RETRIES` 和 `DELIVERY_RETRY_DELAY_SECONDS` 可以为 0
- 对布尔类配置：
  - `OKX_WATCHER_ENABLED` 推荐使用 `true` / `false`

## 9. 审计日志

审计日志是系统中心里唯一明显偏只读的区域，用来追踪后台改动。

### 常见字段

| 字段 | 说明 |
| --- | --- |
| `operator` | 谁操作的 |
| `module` | 操作模块 |
| `action` | 操作类型 |
| `target_id` | 影响的对象标识 |
| `request_ip` | 请求来源 IP |
| `request_payload` | 提交的参数快照 |
| `created_at` | 操作时间 |

### 主要用途

- 排查是谁改了支付通道
- 排查是谁删了策略
- 排查某次测试调用用了什么参数

## 常见配置组合

### 1. 最小人工收款方案

适合：

- 刚开始上线
- 先跑通人工审核闭环

配置方式：

- 支付通道开 `wechat_qr`
- 支付通道开 `alipay_qr`
- `providerName = manual_qr`
- `settlementMode = manual`
- 上传收款码图片，把图片地址写入 `qrValue`
- 运营在后台审核支付凭证

### 2. OKX 自动确认方案

适合：

- USDT 是主支付链路
- 希望自动确认到账

配置方式：

- 支付通道使用 `okx_usdt`
- `providerName = chain_watcher`
- `currency = USDT`
- `settlementMode = auto`
- 在运行参数里开启 `OKX_WATCHER_ENABLED = true`

### 3. 上游自动发码方案

适合：

- 对接 `new-api`
- 对接自有发码系统

配置顺序：

1. 建 `Provider`
2. 建 `Action`
3. 建 `Fulfillment Strategy`
4. 商品绑定 `fulfillment_strategy_key`

### 4. Telegram 自动交付方案

适合：

- 用户主要通过 Telegram 收货

配置顺序：

1. 配 `Telegram 机器人`
2. 建 `Delivery Strategy`
3. `channelType = telegram`
4. 商品绑定 `delivery_strategy_key`

## 推荐的完整闭环做法

如果你的站点当前以 `OKX + 微信/支付宝人工收款 + Telegram 交付 + 上游自动发码` 为主，推荐按下面方式配置：

1. 开 `okx_usdt` 作为主自动收款通道
2. 保留 `wechat_qr`、`alipay_qr` 作为人工兜底通道
3. 配好 `new_api_prod` 对接真实上游
4. 给每种商品绑定明确的履约策略
5. 给每种商品绑定明确的交付策略
6. 配好 Telegram Bot，用于通知、交付和用户查询
7. 最后通过运行参数调整超时、扫单和重试节奏

这样配置后，业务链路会形成：

前台下单 -> 支付确认/审核 -> 自动或人工履约 -> 网站/Telegram 交付 -> 后台审计留痕

## 维护建议

- 系统中心字段大多会被商品、订单、任务调度直接依赖，改动前先确认是否已有在线订单在使用
- `channelKey`、`providerKey`、`actionKey`、`strategyKey` 这类标识一旦投入使用，不建议随意重命名
- 密钥类字段修改后，最好立即做一次测试调用或联调验证
- 运行参数有环境变量覆盖时，后台改值可能看起来“没生效”，先检查 `valueSource`

## 相关文档

- [配置说明](./passdock-config-reference.md)
- [总体产品与架构方案](./tg-code-platform-plan.md)
- [接口草案](./passdock-api-draft.md)
