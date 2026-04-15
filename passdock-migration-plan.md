# PassDock 数据迁移计划

文档分类：

- 类型：技术运维参考
- 适用场景：SQLite 迁移 PostgreSQL、生产切库、数据校验
- 是否建议第一次优先阅读：否

第一次接手项目建议先看：

- [文档索引](./passdock-docs-index.md)
- [系统使用教程](./passdock-system-usage-guide.md)

## 目标

本文件描述 `PassDock` 从 `SQLite` 部署迁移到 `PostgreSQL` 部署时的推荐做法。

推荐迁移路径：

```text
SQLite -> PostgreSQL
```

## 何时需要迁移

出现以下一个或多个信号时，应开始规划迁移：

- 异步任务明显增多
- 支付回调和扫单量明显上升
- Telegram 交付与后台操作并发增加
- 需要多实例部署
- 需要更强的并发和长期运营能力

## 迁移原则

### 1. 切换时只保留一个可写库

- 正式切换时只能有一个数据库接受写入
- 不建议长期双写

### 2. 业务主键必须保持稳定

以下值迁移前后不能变化：

- `order_no`
- `external_ref`
- `ticket_no`
- `client_key`
- `provider_key`
- `strategy_key`

### 3. 幂等实体必须可去重

以下实体迁移后仍需保持幂等安全：

- 订单
- 支付记录
- 履约记录
- 交付记录
- 工单

## 推荐迁移步骤

### 阶段 1：冻结结构

- 停止引入破坏性 Schema 变更
- 冻结枚举值
- 冻结状态流转
- 确认导出字段

### 阶段 2：导出 SQLite 数据

建议导出以下表：

1. `users`
2. `telegram_bindings`
3. `payment_channels`
4. `integration_providers`
5. `integration_actions`
6. `fulfillment_strategies`
7. `delivery_strategies`
8. `products`
9. `product_prices`
10. `orders`
11. `order_items`
12. `order_events`
13. `payment_records`
14. `payment_proofs`
15. `fulfillment_records`
16. `code_issue_records`
17. `delivery_records`
18. `support_tickets`
19. `internal_client_keys`
20. `admin_operation_logs`

推荐格式：

- JSON Lines
- 或 CSV + 保留 JSON 字段原文

### 阶段 3：导入 PostgreSQL

- 先创建 PostgreSQL Schema
- 按依赖顺序导入
- 导入后重置序列
- 核对数据量

推荐导入顺序：

1. `users`
2. `telegram_bindings`
3. `payment_channels`
4. `integration_providers`
5. `integration_actions`
6. `fulfillment_strategies`
7. `delivery_strategies`
8. `products`
9. `product_prices`
10. `orders`
11. `order_items`
12. `order_events`
13. `payment_records`
14. `payment_proofs`
15. `fulfillment_records`
16. `code_issue_records`
17. `delivery_records`
18. `support_tickets`
19. `internal_client_keys`
20. `admin_operation_logs`

### 阶段 4：校验

至少检查：

- 总记录数是否一致
- 唯一键是否冲突
- 随机订单明细是否正确
- 支付记录外键是否正确
- 履约 / 交付记录是否正确关联
- 工单与用户、订单关系是否完整

### 阶段 5：切换

1. 开启维护模式
2. 停止写流量
3. 做最后一次增量导出
4. 导入 PostgreSQL
5. 切换 `DB_DRIVER=postgres`
6. 重启应用
7. 检查健康状态与订单读取
8. 关闭维护模式

## 回滚策略

在确认切换成功前，必须保留回滚路径：

1. 最终切换前保留原始 SQLite 文件
2. PostgreSQL 开流量前做快照
3. 如果校验失败，立即切回 SQLite
4. 修复后重新执行导入

## 数据校验清单

- `orders.order_no` 唯一
- `orders.external_ref` 在非空时唯一
- `support_tickets.ticket_no` 唯一
- `internal_client_keys.client_key` 唯一
- 所有外键仍然有效
- JSON 字段仍可正常解析

## PostgreSQL 序列重置

导入显式 ID 后，需要为所有自增表重置序列。

示例：

```sql
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), true) FROM users;
```

## 工具建议

推荐方案：

- 编写专用 Go 迁移工具

可选方案：

- `sqlite3` 导出 + 自定义转换脚本
- 使用 Go / Python 写 ETL

推荐使用 Go 的原因：

- 字段映射清晰
- 易于测试
- 更适合处理 JSON 字段、状态修正和幂等逻辑

## 不建议做的事

- 长期双写
- 迁移过程中修改枚举
- 迁移时改订单号格式
- 校验结束前删除旧 SQLite 备份
