# PassDock Web 前端说明

这是 `PassDock` 的前端工程，负责：

- 商品前台展示与下单
- 匿名下单、订单号 + 查单码查询、支付凭证查看
- 后台管理登录与运营工作台
- 与后端真实 API 对接

## 技术栈

- React
- TypeScript
- Vite
- SCSS
- Ant Design

## 本地开发

```bash
cd apps/web
npm install
npm run dev
```

常用命令：

```bash
npm run lint
npm run build
npm run preview
```

## 环境变量

先将 `apps/web/.env.example` 复制为 `apps/web/.env`。

支持的变量：

- `VITE_API_BASE_URL`
  生产环境接口根地址。留空时，前端默认走同源 `/api` 与 `/uploads`。
- `VITE_API_PROXY_TARGET`
  Vite 开发代理目标，默认 `http://localhost:8080`。
- `VITE_LOCAL_DEMO_MODE`
  是否启用本地演示数据。默认 `false`，建议始终走真实后端。
- `VITE_ADMIN_BEARER_TOKEN`
  调试后台接口时可选使用的 Bearer Token。

## 路由说明

- 前台首页：`/`
- 商品详情 / 下单页：`/products/:sku`
- 订单查询中心：`/orders`
- 管理后台登录：`/admin/login`
- 管理后台首页：`/admin`

## 说明

- 当前前台主流程不要求用户注册登录。
- 下单成功后，前端会保存并展示：
  - `orderNo`
  - `order_access_token`，用户侧文案可理解为“查单码”
- 后续查单、看交付结果、上传支付凭证、提交售后，统一通过 `订单号 + 查单码` 完成。
- 仓库中仍保留 `account` 相关页面与能力代码，但不是当前默认业务主路径。
- 详细项目说明、部署方式、默认账号和完整文档索引请查看仓库根目录的 `README.md`。
