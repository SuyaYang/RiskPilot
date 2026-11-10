# 本地 PayPal Sandbox 配置

本分支：`feature/checkout-mvp`。需要 Node.js 20.6+；当前本地使用 Node.js 22。

## 1. 登录并选择 Sandbox

打开 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)，完成登录。
在 Apps & Credentials 中选择 **Sandbox**，检查已有 App；需要时创建 `RiskPilot Sandbox` 商家 App，关联 Sandbox Business 商家账号。

在 Testing Tools → Sandbox Accounts 检查两个测试账号：

- Business：收款商家，与 App 关联。
- Personal：测试买家，付款时使用这个账号。

这两个都是 Sandbox 测试账号。Developer Dashboard 的真实登录账号与测试买家账号用途不同。

## 2. 写入本地凭据

在项目目录运行：

```bash
bash scripts/set-keys.sh paypal
```

依次输入同一个 Sandbox App 的 Client ID 和 Secret。脚本隐藏输入，将 Client ID 同时写入
`PAYPAL_CLIENT_ID` 和 `NEXT_PUBLIC_PAYPAL_CLIENT_ID`，将 Secret 写入 `PAYPAL_CLIENT_SECRET`。
`.env` 已创建并被 Git 忽略；不要把 Secret 发到聊天、截图或提交到 Git。

当前本地设置：

```dotenv
APP_ORIGIN=http://localhost:3100
RISKPILOT_ORIGIN=http://localhost:3100
MERCHANT_ORIGIN=http://localhost:3200
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

## 3. 启动并走通商家流程

如果已单独启动开发服务，先在对应终端用 Ctrl+C 停止它，让下面的启动器加载新凭据。

```bash
npm run demo -- --no-open
```

打开 <http://localhost:3200>，按以下顺序测试：

1. Northstar 店铺 → PayPal Sandbox checkout。
2. 使用 Personal 测试买家登录，选择付款方式，点击 Continue / Review Order。
3. 返回 RiskPilot，检查现金、缓冲金与目标影响。
4. 点击 Confirm and pay 后才会执行 Sandbox capture，随后返回商家收据。

仅预览时停在第 3 步。需要保留启动器终端；Ctrl+C 会停止它启动的服务。

`npm run demo -- --check` 可检查两个服务和凭据是否已配置，但不证明凭据有效。
有效性需要成功获取 Sandbox OAuth token 或实际创建 Sandbox 订单来验证。

## 4. Webhook 与 AI

本地同步下单及 capture 可以先不配置 webhook。需要验证异步事件时，提供公网 HTTPS 地址，
在同一个 Sandbox App 注册 `https://你的域名/api/webhooks/paypal`，把 Webhook ID 写入
`PAYPAL_WEBHOOK_ID`，并订阅：

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DECLINED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Gemini 可通过 `bash scripts/set-keys.sh gemini` 配置；留空时项目使用回退逻辑，
不能据此声称在线 AI 集成已验证。

比赛要求项目实质使用 PayPal 和 AI，并提供能运行的演示或完整启动说明。
官方页面列出的截止时间为 **2026 年 11 月 12 日 15:00（纽约时间）**。

参考：[PayPal REST 入门](https://developer.paypal.com/api/rest/)、
[PayPal Checkout](https://developer.paypal.com/studio/checkout/standard/getstarted)、
[比赛要求](https://paypalaihackathon.devpost.com/)。
