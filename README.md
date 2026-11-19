<div align="center">

![new-api](/web/public/logo.png)

# New API

**An AI gateway for models, applications, and agents**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a><!--
  --><a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://atomgit.com/QuantumNous/new-api" target="_blank">
    <img alt="AtomGit G-Star" src="https://atomgit.com/QuantumNous/new-api/star/badge.svg"/>
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/20180" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/20180" alt="QuantumNous%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a><!--
  -->
  <a href="https://atomgit.com/QuantumNous/new-api" target="_blank">
    <img alt="AtomGit G-Star" src="https://atomgit.com/QuantumNous/new-api/star/new_badge.svg" width="250" height="55" />
  </a>
</p>

<p align="center">
  <a href="#screenshots">Screenshots</a> •
  <a href="#capabilities">Capabilities</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#development">Development</a> •
  <a href="#documentation">Documentation</a>
</p>

</div>

---

## 🔀 本仓库与官方仓库的区别（二次开发说明）

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的二次开发版本，项目名称、版权和许可证（AGPL-3.0）均沿用官方，未做任何改动。下文记录与官方的全部差异，方便以后合并官方新版本或其他二次开发功能。

| 项目 | 内容 |
| --- | --- |
| 基于的官方版本 | `v1.0.0-rc.51`（commit `c9c6da278`） |
| 本仓库版本标签 | `v1.0.0-rc.51-invoice`（发票）、`v1.0.0-rc.51-ticket`（发票 + 工单） |
| 新增功能 | ① 开发票（个人/企业身份认证 + 人工开具增值税普通电子发票）② 工单（纯文字，用户与客服对话） |

### 功能一：开发票

1. **身份认证**：用户先在「发票」页提交个人认证（真实姓名 + 身份证号，校验末位校验码）或企业认证（企业名称 + 统一社会信用代码）。待审核期间页面提供「提交工单」按钮，跳到工单页并预选「发票与认证」分类。每个用户只有一条认证记录，修改资料后重新进入待审核。
2. **开票申请**：认证通过后才能申请（服务端强制校验）。可开票订单为近 12 个月内成功的易支付（人民币）充值订单，不含订阅、Stripe/Creem/Waffo、余额支付。发票抬头固定为认证主体，申请时快照保存。每笔订单同时只能出现在一张有效申请里（数据库唯一索引保证），驳回或作废后订单释放。金额由服务端按「分」汇总。
3. **管理端**：「发票管理」页有两个标签：
   - 开票申请：开具（填发票号 + 上传 PDF，≤10 MB，校验文件头）、驳回（填原因）、作废、下载，显示用户备注。
   - 认证审核：通过、驳回、撤销已通过的认证。
   开具/驳回/作废会给用户发邮件（未配置邮件则跳过）；以上管理操作都写入审计日志。

### 功能二：工单

1. **用户端**（侧边栏「个人 → 工单」）：选择分类、填写标题、可选的关联订单号/请求 ID、问题描述后提交；只支持文字，不能上传文件。工单详情以对话形式展示，用户可以继续回复或关闭。同时未关闭的工单最多 5 张；新建和回复接口限频。
2. **状态**：待处理（等客服）→ 已回复（等用户）→ 已关闭。用户回复会变回待处理；关闭后 7 天内用户回复可以重新打开，超过 7 天需要新建。
3. **管理端**（侧边栏「管理 → 工单管理」）：按状态、分类筛选，待处理的排在最前；侧边栏角标显示待处理数量（每分钟刷新）。客服可以回复、关闭，或写**内部备注**（用户看不到，由服务端过滤）。客服回复后按用户自己的通知设置（邮件 / Webhook / Bark / Gotify）通知用户。回复、关闭写入审计日志。
4. **自动关闭**：主节点每 10 分钟检查一次，客服回复后用户超过设定天数未回应的工单自动关闭。
5. **设置**：「系统设置 → 控制台内容 → 工单」可配置分类（每行一个，最多 20 个）和自动关闭天数（0–90，0 为不自动关闭，默认 7）。默认分类为英文原文，界面按语言翻译；管理员自己填写的分类名原样显示。分类名改动不影响已提交的工单（工单保存分类名快照）。

### 数据库

启动时 `AutoMigrate` 自动新建以下表，不修改任何官方表：

| 表 | 用途 |
| --- | --- |
| `invoice_verifications` | 身份认证，`user_id` 唯一索引；身份证号/信用代码为明文存储 |
| `invoices` | 开票申请，保存抬头快照、备注、发票号、PDF 文件名 |
| `invoice_items` | 申请与充值订单的关联，`top_up_id` 唯一索引防止重复开票 |
| `tickets` | 工单（分类快照、状态、双方最后回复时间、关闭信息） |
| `ticket_messages` | 工单消息，`internal` 标记内部备注 |

新增设置项（存在官方 `options` 表）：`ticket_setting.categories`、`ticket_setting.auto_close_days`。回滚到官方镜像时这些表和设置会保留在库里，不影响官方版本运行。

### 部署相关

- 发票 PDF 存在本地目录：默认 `./invoices`（Docker 镜像工作目录为 `/data`，即 `/data/invoices`），可用环境变量 `INVOICE_DIR` 修改。多实例部署时需要指向所有节点共享的目录。
- 工单自动关闭只在主节点运行（与官方其他定时任务一致）。
- 构建方式与官方完全一致：`docker build -t new-api:v1.0.0-rc.51-ticket .`

### 新增 / 修改的文件

**新增文件**（官方没有，合并时不会冲突）：

- 发票：`model/invoice.go`、`model/invoice_verification.go`、`model/invoice_test.go`、`controller/invoice.go`、`service/invoice.go`、`web/src/features/invoices/`、`web/src/routes/_authenticated/invoices/`、`web/src/routes/_authenticated/invoice-management/`
- 工单：`model/ticket.go`、`model/ticket_test.go`、`controller/ticket.go`、`service/ticket.go`、`setting/ticket_setting/`、`web/src/features/tickets/`、`web/src/features/system-settings/content/ticket-settings-section.tsx`、`web/src/routes/_authenticated/tickets/`、`web/src/routes/_authenticated/ticket-management/`

**修改的官方文件**（合并官方新版本时需要留意，括号内为改动内容）：

| 文件 | 改动 |
| --- | --- |
| `main.go` | 启动工单自动关闭任务 |
| `model/main.go` | `AutoMigrate` 列表加入发票和工单模型 |
| `model/option.go` | 保存设置前校验工单设置项 |
| `router/api-router.go` | 注册 `/api/user/invoice*`、`/api/user/ticket*` 路由 |
| `middleware/access_token_routes.go` | 为新路由声明访问令牌权限（缺少会导致 `router` 测试失败） |
| `middleware/audit.go` | 管理操作的审计动作名 |
| `model/task_cas_test.go` | 测试数据库迁移和清理列表加入新表 |
| `i18n/keys.go`、`i18n/locales/*.yaml` | 发票、工单邮件文案 |
| `common/log_text.zh-CN.json` | 新增日志的中文 |
| `web/src/hooks/use-sidebar-data.ts`、`use-sidebar-config.ts`、`use-sidebar-view.ts`、`web/src/components/layout/types.ts` | 侧边栏「发票」「工单」「发票管理」「工单管理」入口与待处理角标；「发票」跟随充值模块开关 |
| `web/src/features/wallet/index.tsx` | 钱包页「发票」按钮 |
| `web/src/features/system-settings/content/index.tsx`、`section-registry.tsx`、`web/src/features/system-settings/types.ts` | 「控制台内容 → 工单」设置页 |
| `web/src/features/usage-logs/lib/format.ts` | 审计日志动作文案 |
| `web/src/i18n/locales/*.json`、`web/src/i18n/static-keys.ts` | 7 种语言翻译 |
| `web/src/routeTree.gen.ts` | 自动生成文件，加入四个新路由 |
| `web/src/hooks/__tests__/sidebar-config.test.tsx` | 侧边栏测试加入「发票」「工单」 |
| `.gitignore` | 忽略 `/invoices/` |

### 合并官方新版本

```bash
git remote add upstream https://github.com/QuantumNous/new-api.git   # 只需一次
git fetch upstream --tags
git checkout main
git merge v1.0.0-rc.52   # 换成要合并的官方版本标签
```

冲突处理建议：

- `web/src/i18n/locales/*.json`、`common/log_text.zh-CN.json`、`i18n/locales/*.yaml`：都是键值对，冲突时**两边都保留**，注意不要出现重复的键。
- `web/src/routeTree.gen.ts`：可直接采用官方版本，然后执行 `cd web && bun run build` 重新生成。
- `router/api-router.go`、`middleware/access_token_routes.go`、`model/main.go`、`main.go`：保留官方改动，再把上表中的发票、工单条目加回去。
- 合并后运行以下检查：

```bash
go test ./model/ ./router/ ./i18n/ ./service/
cd web && bun install && bun run typecheck && bun x vitest run src/features/invoices src/features/tickets src/hooks/__tests__/sidebar-config.test.tsx
```

`router` 测试会检查每个接口都声明了访问令牌权限，官方新增或改名的接口如果和这里的路由冲突，这里会报出来。

### 验证情况

- 已通过：gofmt、go vet；`model`（含发票和工单测试）、`router`、`i18n`、`service`、`setting` 包测试；前端类型检查、改动文件的 lint 与格式检查、相关 vitest、生产构建；本机 SQLite 启动、建表，并重复启动验证迁移幂等。
- 未完成：MySQL 和 PostgreSQL 上的迁移尚未实测；Docker 镜像尚未在 Linux 上实际启动过。上线前请在测试环境验证。
- 以上功能的代码由 AI（Claude）辅助编写。

---


## 📝 Project Description

New API is a self-hosted AI gateway for applications, agents, and teams. Connect upstream model services, expose a consistent API to your clients, and manage routing, access, usage, and costs in one place.

Use it to share authorized model access across a team, switch providers without configuring every client again, or operate a private multi-model service with a web console. Upstreams include OpenAI, Anthropic, Google Gemini, Azure OpenAI, AWS Bedrock, Vertex AI, DeepSeek, Qwen, and other compatible services.

> [!IMPORTANT]
> - This project is intended solely for lawful and authorized AI API gateway, organization-level authentication, multi-model management, usage analytics, cost accounting, and private deployment scenarios.
> - Users must lawfully obtain upstream API keys, accounts, model services, and interface permissions, and must comply with upstream terms of service and applicable laws and regulations.
> - Users should ensure their use complies with upstream terms of service and applicable laws and regulations.
> - When providing generative AI services to the public, users should comply with applicable regulatory requirements and fulfill all filing, licensing, content safety, real-name verification, log retention, tax, and upstream authorization obligations required by their jurisdiction.

<!-- -->

> [!WARNING]
> When operating this project as a public generative AI service or API resale service, users should first complete all required filing, licensing, content safety, real-name verification, log retention, tax, payment, and upstream authorization obligations.

---

<a id="screenshots"></a>

## Screenshots

Accounts, channels, plugin installation states, usage, prices, and costs shown below are simulated data. The marketplace displays the official plugin catalog. Click an image to view it at full size.

| Usage dashboard | Plugin marketplace |
| --- | --- |
| [![Usage dashboard with simulated requests, costs, and performance metrics](assets/screenshots/dashboard.en.jpg)](assets/screenshots/dashboard.en.jpg) | [![Official plugin marketplace with simulated installation status](assets/screenshots/plugin-marketplace.en.jpg)](assets/screenshots/plugin-marketplace.en.jpg) |
| **Model square** | **Usage logs** |
| [![Model square with simulated model pricing and availability](assets/screenshots/models.en.jpg)](assets/screenshots/models.en.jpg) | [![Usage logs with simulated tokens, costs, and response times](assets/screenshots/usage-logs.en.jpg)](assets/screenshots/usage-logs.en.jpg) |

---

## 🤝 Trusted Partners

<p align="center">
  <em>No particular order</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a><!--
  --><a href="https://github.com/iOfficeAI/AionUi/" target="_blank">
    <img src="./docs/images/aionui.png" alt="Aion UI" height="80" />
  </a><!--
  --><a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="Peking University" height="80" />
  </a><!--
  --><a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="80" />
  </a><!--
  --><a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 Special Thanks

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong>Thanks to <a href="https://www.jetbrains.com/?from=new-api">JetBrains</a> for providing free open-source development license for this project</strong>
</p>

---

<a id="capabilities"></a>

## Capabilities

| Area | What you can do |
| --- | --- |
| Model access | Use OpenAI Chat Completions, Responses, Anthropic Messages, and Gemini APIs; stream responses and use tools, reasoning, and multimodal inputs where supported |
| Routing | Configure model mappings, channel priorities and weights, retries, channel affinity, and multiple upstream keys |
| Usage and costs | Manage quotas, subscriptions, usage logs, cache accounting, and expression-based pricing for different usage tiers |
| Access control | Manage users, groups, fine-grained permissions, and API key restrictions; use OAuth/OIDC, passkeys, two-factor authentication, and login session management |
| Asynchronous tasks | Extend image, video, and other task APIs with JavaScript plugins, including task status and output retrieval |
| Web console | Configure channels and models, inspect usage and audit logs, and try models in the playground; available in English, Simplified Chinese, Traditional Chinese, French, Japanese, Russian, and Vietnamese |

### Protocols and endpoints

| Interface | Common endpoints |
| --- | --- |
| OpenAI Chat / Responses | `POST /v1/chat/completions`, `POST /v1/responses` |
| Anthropic Messages | `POST /v1/messages` |
| Gemini | `POST /v1beta/models/{model}:generateContent`, `POST /v1beta/models/{model}:streamGenerateContent` |
| Realtime / Responses WebSocket | `GET /v1/realtime`, `GET /v1/responses` (WebSocket upgrade) |
| Images / audio | `/v1/images/generations`, `/v1/images/edits`, `/v1/audio/speech`, `/v1/audio/transcriptions`, `/v1/audio/translations` |
| Embeddings / rerank | `POST /v1/embeddings`, `POST /v1/rerank` |
| Task plugins | `POST /v1/tasks/{pluginKey}`, `GET /v1/tasks/{taskId}`, plus routes declared by each plugin |

[RelayKit](./relaykit/README.md) provides request, response, and streaming conversion between the four text protocols. Available features depend on the channel, upstream model, and conversion path; protocol-specific tools and fields may not map exactly. WebSocket support also requires a compatible upstream and channel configuration.

This README describes the current source tree. Check the release notes for the version you deploy.

<a id="quick-start"></a>

## Quick start

### Try locally with Docker

This starts a single instance with SQLite and binds it to localhost:

```bash
mkdir -p data
docker run --name new-api -d --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard to create the administrator account. The `data` directory persists the SQLite database across container replacements.

### Make your first request

1. Add a channel with your upstream API key, available models, and group assignment; run a channel test.
2. Configure model pricing and ensure the user has quota or a valid subscription.
3. Create an API key in the console with access to the same group and models.
4. Set your client's base URL to `http://localhost:3000/v1` for OpenAI-compatible clients and use the **New API-issued key**.

Set `NEW_API_KEY` in your shell to that key. List the models accessible to it:

```bash
curl --fail-with-body http://localhost:3000/v1/models \
  -H "Authorization: Bearer ${NEW_API_KEY}"
```

Then call Responses, replacing `your-enabled-model` with an enabled model that supports this interface:

```bash
curl --fail-with-body http://localhost:3000/v1/responses \
  -H "Authorization: Bearer ${NEW_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"your-enabled-model","input":"Hello!"}'
```

<a id="deployment"></a>

## Deployment

### Docker Compose

The repository's [Compose configuration](./docker-compose.yml) starts **New API + PostgreSQL + Redis** by default. It also contains examples for MySQL and a separate ClickHouse log database.

```bash
git clone https://github.com/QuantumNous/new-api.git
cd new-api
```

Before starting, edit `docker-compose.yml`: replace the database and Redis example passwords in both the services and connection strings, and set a persistent random `SESSION_SECRET` (generate one with `openssl rand -hex 32`). For an HTTPS console, configure `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_TRUSTED_URL` with its exact public HTTPS origin.

```bash
docker compose up -d
docker compose logs -f new-api
```

### Storage and configuration

| Component | Options |
| --- | --- |
| Main database | SQLite, MySQL ≥ 5.7.8, or PostgreSQL ≥ 9.6 |
| Separate log database | Configure with `LOG_SQL_DSN`; also supports ClickHouse |
| Cache | Optional Redis plus in-memory caching; use shared Redis when application nodes need shared rate limits |
| Container platforms | Linux amd64 / arm64 |

| Variable | Purpose |
| --- | --- |
| `SQL_DSN` | Main database connection; unset uses SQLite |
| `LOG_SQL_DSN` | Optional separate log database connection |
| `REDIS_CONN_STRING` | Redis connection string |
| `SESSION_SECRET` | Persistent authentication secret; all nodes must use the same value |
| `CRYPTO_SECRET` | Defaults to `SESSION_SECRET`; nodes sharing Redis must use the same effective value |
| `SESSION_COOKIE_SECURE` | Set to `true` for an HTTPS console; enables Secure refresh cookies and strict refresh/logout origin checks |
| `SESSION_COOKIE_TRUSTED_URL` | Required in Secure mode: comma-separated exact HTTPS origins, without paths or wildcards; leave unset for local HTTP |
| `TRUSTED_PROXIES` | Trusted reverse-proxy IPs/CIDRs, or `none`; explicitly configure for your network |

See the [environment example](./.env.example), [environment reference](https://docs.newapi.ai/en/docs/installation/config-maintenance/environment-variables), and [authentication and session guide](./docs/authentication.md) for full configuration. Configure container variables in Compose's `environment` or `env_file`; copying `.env.example` alone does not inject variables into the container.

For production, put the console behind HTTPS and configure your reverse proxy for streaming and WebSocket upgrades. Persist and back up the database and mounted data. Multi-node deployments must share the main database and authentication secrets; separate Redis instances or in-memory rate limiters count limits independently per node. The session guide describes propagation behavior for each topology.

Pin an image version from [Releases](https://github.com/QuantumNous/new-api/releases), review its upgrade notes, and back up before upgrading. The `latest` tag follows published builds and can change; migrations and compatibility must be assessed for your existing installation.

<a id="development"></a>

## Development and extensions

The backend uses Go and Gin. The web console uses React 19, TypeScript, Rsbuild, TanStack, and Tailwind CSS 4. Use Bun for frontend dependencies and scripts; see [go.mod](./go.mod) for the Go language baseline and [Dockerfile](./Dockerfile) for the container build toolchain.

Build the frontend before starting the backend, which embeds `web/dist`:

```bash
# Repository root
cd web
bun install --frozen-lockfile
bun run build
cd ..
go run .
```

In a second terminal, start the frontend development server:

```bash
cd web
bun run dev -- --port 5173
```

Open [http://localhost:5173](http://localhost:5173); the development server proxies API requests to the backend on port 3000. For a containerized development backend, see [docker-compose.dev.yml](./docker-compose.dev.yml) and the `make dev` target in [makefile](./makefile).

| Location | Responsibility |
| --- | --- |
| `router/`, `middleware/`, `controller/` | HTTP routes, access checks, and API handlers |
| `relay/` | Upstream adapters and request routing |
| `service/`, `model/` | Business logic and persistence |
| [relaykit/](./relaykit/README.md) | Independently buildable Go module for protocol DTOs and conversions |
| [plugins/tasks/](./plugins/tasks/) | JavaScript task plugins; see [Task Plugin API v1](./docs/plugin-api/v1.md) for authoring and host boundaries |
| `web/` | Web console; see [frontend conventions](./web/AGENTS.md) |
| [electron/](./electron/README.md) | Desktop wrapper and packaging |

Read [AGENTS.md](./AGENTS.md) before contributing. Run checks appropriate to your change, including `make test` for the Go modules and `bun check -b`, `bun run lint`, `bun run test`, and `bun run build` in `web/` for frontend changes. Changes to RelayKit must also pass `GOWORK=off go build ./...` from `relaykit/`.

<a id="documentation"></a>

## Documentation and community

| Resource | Link |
| --- | --- |
| Official documentation | [Guides](https://docs.newapi.ai/en/docs) · [Installation](https://docs.newapi.ai/en/docs/installation) · [API reference](https://docs.newapi.ai/en/docs/api) |
| Project exploration | [DeepWiki](https://deepwiki.com/QuantumNous/new-api) |
| Questions and discussion | [FAQ](https://docs.newapi.ai/en/docs/support/faq) · [Community](https://docs.newapi.ai/en/docs/support/community-interaction) |
| Bugs and feature requests | [GitHub Issues](https://github.com/QuantumNous/new-api/issues) |
| Security reports | Follow the [security policy](./.github/SECURITY.md) for private reporting |

For bug reports, include the version, deployment method, reproduction steps, and redacted logs. Documentation, translations, provider integrations, and focused regression tests are all welcome contributions.

---

## 🔗 Related Projects

### Upstream Projects

| Project | Description |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | Original project base |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Midjourney interface support |

### Supporting Tools

| Project | Description |
|------|------|
| [new-api-key-tool](https://github.com/Calcium-Ion/new-api-key-tool) | Key quota query tool |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | New API high-performance optimized version |

---

## 📜 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Additional terms under AGPLv3 Section 7 apply. Modified versions must preserve
the author attribution notice `Frontend design and development by New API
contributors.` in the appropriate legal notices and in any prominent about,
legal, footer, or attribution location presented by the user interface.

Modified versions that present a user interface must also preserve a visible
link to the original project: <https://github.com/QuantumNous/new-api>.

This is an open-source project developed based on [One API](https://github.com/songquanpeng/one-api) (MIT License).

If your organization's policies do not permit the use of AGPLv3-licensed software, or if you wish to avoid the open-source obligations of AGPLv3, please contact us at: [support@quantumnous.com](mailto:support@quantumnous.com)

See [NOTICE](./NOTICE) and [third-party licenses](./THIRD-PARTY-LICENSES.md) for attribution and dependency notices.

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 Thank you for using New API

If this project is helpful to you, welcome to give us a ⭐️ Star！

**[Official Documentation](https://docs.newapi.ai/en/docs)** • **[Issue Feedback](https://github.com/Calcium-Ion/new-api/issues)** • **[Latest Release](https://github.com/Calcium-Ion/new-api/releases)**

<sub>Built with ❤️ by QuantumNous</sub>

</div>
