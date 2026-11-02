# Shiro 适配 Mix Space Core v14 改造记录

- **日期**：2026-09-26（2026-10-31 更新，见文末）
- **目标后端**：mx-core v14（本地验证版本 14.14.0，源码位于 `E:\VibeCode\core`）
- **改造范围**：`apps/web`（@shiro/web），共 90+ 文件
- **状态**：`tsc --noEmit` 0 错误；`next build --webpack` 构建成功；改动全部在工作区，**未提交**
- **前置说明**：改造前工作区已存在部分未提交的 v3 适配（`env.ts` 的 `/api/v3`、`shared.ts` 移除 `getDataFromResponse` 透传、`.env.template`、`LexicalContent.tsx` 的 `/api/v3` 路径），本记录覆盖包含这些在内的完整改动集。
- **路径排查**：全仓库 `/api/v2` 残留已清零（含 `Dockerfile` 的 `NEXT_PUBLIC_API_URL` 构建默认值，`docker-compose.yml`、`next.config.mjs` 经核查无残留）。

---

## 一、改造背景

Shiro 原状锁定 `@mx-space/api-client@2.3.0`（v2 API 契约）+ `socket.io-client`（v13 及之前的实时协议），与 Core v14 存在三处硬断层：

| 断层 | 旧（v13-） | 新（v14） |
|------|-----------|-----------|
| API 契约 | `/api/v2` + v2 控制器/包装类型/`$serialized` 解包 | `/api/v3` + V3 统一信封 `{ data, meta? }` + api-client v5 |
| 实时通道 | socket.io 协议，命名空间 `/web` | 原生 WebSocket，端点 `/ws/web`，JSON 信封 `{ v:1, event, payload, id? }` |
| 事件名 | 全大写 `VISITOR_ONLINE` | 点分小写 `visitor.online` |

协议细节逆向自 mx-core 源码（`processors/gateway/ws/*`、`web/events.gateway.ts`），事件枚举核对自 `constants/business-event.constant.ts`。

## 二、依赖变更（apps/web/package.json）

| 操作 | 包 | 说明 |
|------|-----|------|
| 升级 | `@mx-space/api-client` 2.3.0 → **5.12.0** | v5 对应 V3 API 契约 |
| 新增 | `thumbhash` | 替代 blurHash 的图片占位格式（后端迁移 0015_blurhash_to_thumbhash，base64 编码） |
| 移除 | `socket.io-client` | v14 实时通道为原生 WebSocket，不再需要 |

## 三、API 层适配（阶段一）

### 3.1 响应信封与解包

v14 后端 `ResponseInterceptor` 将所有非 passthrough 响应包裹为 `{ data, meta? }`（`response.interceptor.ts`）。

- **控制器调用**：v5 客户端默认解包（`defaultGetDataFromResponse`），全部调用点由 v2 的 `.data` 改为 `.$serialized` 或直接取值（feeds、timeline、friends、projects、series、tags 等约 15 处）。
- **绕过客户端的裸 fetch()**（5 处，手动解包 `json?.data ?? json`）：
  - `app/[locale]/layout.tsx` — `/owner/check_logged`，**修复了 `res.ok` 永远为 false 导致站长恒显示未登录的运行时 bug**
  - `thinking/feed/route.tsx`、`says/feed/route.tsx` — aggregate 聚合数据
  - `components/common/SyncServerTime.tsx` — `/server-time`
  - `components/ui/rich-content/LexicalContent.tsx` — mx-space LinkCard 插件

### 3.2 类型迁移

- **v2 包装类型删除**：`ModelWithLiked`、`ModelWithTranslation`、`NoteWrappedWithLikedAndTranslationPayload`、`NoteWrappedWithLikedPayload`、`PostListItem`、`NoteTopicListItem`
  - `PostWithTranslation`/`NoteWithTranslation` 直接别名到 `PostModel`/`NoteModel`（点赞状态本就基于 cookie `lib/cookie.ts`，翻译字段无消费点）
  - `NoteWrappedWithLikedAndTranslationPayload` → v5 `NoteWrappedPayload`（模型字段提升至顶层，无 `.data` 包裹层）
- **`NoteWrappedPayload` 结构调整**：全 note 模块约 25 处 `data?.data.xxx` → `data?.xxx`（pageExtra、NoteMetaBar、NoteActionAside、NoteBanner、NoteBottomTopic、NoteFooterNavigation、NoteHideIfSecret、NoteHeadCover、NoteTimeline、NoteTopicDetail、NoteTopicInfo、NoteMarkdown 系列、NotePreview、lib/biz、socket handlers 等）
- **字段重命名**（约 20 处）：
  - `created` → `createdAt`、`modified` → `modifiedAt`（模型层；注意 v5 的 `sortBy` 查询枚举值仍保留 `created`/`modified`，不受影响）
  - `count.read` → `readCount`、`count.like` → `likeCount`（PostMetaBar、NoteMetaBar、ActionAside、socket handlers）
  - `pin` → `pinAt`（PostItem、PostPinIcon 调用处）
  - Pager：`currentPage` → `page`、`totalPage` → `totalPages`（loader、PostPagination、say/hooks、comment/hooks、series、thread.test）
- **方法变更**：`note.getNoteByNid(nid, {...})` → v5 `note.getNoteById(nid: number, ...)`（合并重载）；`post.getPost` 三参 `{lang, prefer}` 在 v5 保留，无需改动
- **可空字段**：v5 大量字段由 `string` 变为 `string | null`（avatar/author/source/subtitle/images 等），统一 `?? undefined` / `?? ''` 收敛（friends、SayModalForm、ProjectList、NoteBottomTopic、mx-space 插件、og/route、Comment 系列）
- **`translationMeta`**：v5 移至响应 meta，模型上不再存在，posts 详情页 metadata 处宽松访问（`(data as any).translationMeta`），后续可改读 `$meta.translation`

### 3.3 被 v14 移除的后端字段/端点及对策

| 项目 | 对策 |
|------|------|
| `AggregateRoot.pageMeta`（页面列表） | `queries/definition/aggregation.ts` 聚合查询时并发拉取 `apiClient.page.getList(1, 100)` 注入 `pageMeta`；`aggregation-data-provider.tsx` atom 与 selector 类型同步扩展 |
| 每篇 `allowComment`（post/note/page） | v14 已删除，评论区按 Shiro 原有「默认开」兜底逻辑处理（`CommentAreaRoot` 对 `undefined` 默认开放），相关 selector 改为常量 `true` |
| 图片 `blurHash` | 改读 `thumbhash`（base64），新增 `lib/image.ts::thumbhashBase64ToDataUrl`（atob/Buffer 双环境兼容），`ZoomedImage` 与 `markdown/renderers/image` 两处占位图由 react-blurhash 替换为解码后的 `<img>` |
| 评论模型 `source` 字段 | 提交 DTO 中移除（后端 zod 自动剥离未知键）；展示处保留可选读取以兼容历史缓存 |

### 3.4 评论模块重构

- **类型基础**（`comment/thread.ts` 重写）：`CommentWithAnchor` 基于 `Omit<CommentModel, 'anchor'>` + v5 `CommentAnchorModel | null`（读取形态，字段全可选）；`source` 保留为可选兼容历史数据；`CommentThreadPage`/`CommentThreadInfiniteData` 同步定义，其余组件（CommentBlockGutter、CommentBlockThread、CommentAnchorHighlight、CommentAnchorPopover、LexicalCommentWrapper、CommentPinButton）统一复用共享类型，删除各自冲突的本地定义。写入形态 `BlockAnchor/RangeAnchor`（来自 @haklex/rich-editor）仅在 DOM 解析处通过 cast 衔接。
- **提交链路**（`CommentBox/hooks.tsx`）对齐 v14 后端路由（`comment.controller.ts` 实测）：
  - 游客评论 `POST /comments/guest/:id` → `apiClient.comment.guestComment`
  - 游客回复 `POST /comments/guest/reply/:id` → `apiClient.comment.guestReply`
  - 登录评论 `POST /comments/reader/:id` → `apiClient.comment.readerComment`（v14 无 owner-comment 路由，owner 走 reader 通道）
  - 站长回复 `POST /comments/owner-reply/:id` → 裸 proxy `apiClient.comment.proxy('owner-reply')`（v5 未封装）
- `thread.test.ts` 测试数据同步 v5 模型与 Pager 结构，测试通过。

### 3.5 认证轨道（核实后无需改动）

- `apiClient.owner.checkTokenValid()`：v5 UserController 存在，返回 `CheckLoggedResult { ok, isGuest }`，与后端 `GET /owner/check_logged` 一致 ✅
- `apiClient.owner.logout()`：v5 UserController 存在 ✅
- better-auth：`GET /auth/session`、`GET /auth/providers` 在 v14 `auth.controller.ts` 保留，与 Shiro 调用逐字吻合 ✅

## 四、实时通道重写（阶段二）

### 4.1 `socket/io.worker.ts` —— 整文件重写

socket.io → 原生 WebSocket，协议按 mx-core 源码逆向实现：

- 连接：`new WebSocket('ws(s)://<gateway>/ws/web?socket_session_id=<sid>&lang=<lang>')`
- 信封：双向 JSON `{ v: 1, event, payload?, id? }`
- 上行映射：`updateSid→session.update`、`updateLang→lang.update`、`join→room.join`、`leave→room.leave`
- 下行事件名映射：`visitor.online → VISITOR_ONLINE`（`toUpperCase()` + `.`→`_`），Shiro 全部事件处理器（`socket/handler.ts` 及 handlers/）**零改动**
- 心跳：依赖 WS 协议层 ping/pong（服务端 30s sweep，浏览器自动应答），无需实现
- 重连：关闭后最多 3 次、间隔 3s，支持主线程 `reconnect` 指令
- **保持 worker ↔ 主线程广播协议不变**（connect/disconnect/sid/message），`worker-client.ts` 消费端仅改连接地址

### 4.2 `socket/worker-client.ts`

- 连接地址：`${GATEWAY_URL}/web`（socket.io 命名空间）→ `ws(s)://${GATEWAY_URL}/ws/web`（`http→ws` 协议转换）

### 4.3 事件枚举核对

Shiro 监听的全部事件（`types/events.ts`）在 v14 `BusinessEvents` 中逐一存在（`business-event.constant.ts`），包括 POST/NOTE/SAY/RECENTLY/TRANSLATION/ACTIVITY/ARTICLE_READ_COUNT 系列，无缺失。

## 五、验证结果

| 验证 | 命令 | 结果 |
|------|------|------|
| 类型检查 | `pnpm exec tsc --noEmit` | ✅ 0 错误（改造起点为 259 个错误） |
| 单元测试 | `pnpm test`（vitest） | ✅ **6 个测试文件 / 67 个用例全部通过** |
| 生产构建 | `pnpm exec next build --webpack` | ✅ 成功，全部路由产出 |

### 测试用例（本次新增 3 个测试文件 + 1 个公共模块）

| 文件 | 覆盖点 |
|------|--------|
| `src/socket/protocol.ts`（新增公共模块） | 从 `io.worker.ts` 抽出的 v14 WS 协议纯函数：`mapEventName`、`toEmitEnvelope`、`buildWsUrl`、`toWsScheme`、`parseInboundEnvelope` |
| `src/socket/protocol.test.ts`（31 例） | 全部下行事件名映射（visitor.online→VISITOR_ONLINE 等 22 组）、上行指令映射（updateSid→session.update 等）、未知指令丢弃、ws(s) 协议转换、连接 URL 拼接、信封解析容错 |
| `src/lib/request.shared.test.ts`（5 例） | 新增公共函数 `unwrapV3Envelope`（v14 `{ data, meta? }` 信封解包，已回填 5 处裸 fetch 调用点）：标准信封/数组/原始类型/旧形态/null |
| `src/lib/image.test.ts`（3 例） | `thumbhashBase64ToDataUrl`：与后端同方式生成 thumbhash 做往返验证、非法 base64 容错、解码器宽容行为 |
| `src/components/modules/comment/thread.test.ts`（修复） | 测试数据对齐 v5 CommentModel 与 Pager 结构 |

另：`package.json` 新增 `"test": "vitest run"` 脚本。

**注意**：`tsconfig.json` 显式包含 `.next/types/**`，在构建产物存在时直接跑 `tsc` 可能报 Next 生成类型的既有错误（posts/page 的 `children` props，fork 原有）。`pnpm build` 的 `prebuild` 会先 `rimraf .next`，不受影响。

### 已知问题（既有，非本次引入）

- **Turbopack 构建失败**：`next build`（默认 Turbopack）在解析 `@haklex/rich-editor@0.0.105` 的 `rich-editor.css` 时报 `'highlight' is not recognized as a valid pseudo-element`（CSS Custom Highlight API 的 `::highlight()` 伪元素）。该依赖版本锁定、与本次改动无关。**绕过：`next build --webpack`**。可考虑向上游 @haklex/rich-editor 反馈。

## 六、待实机联调事项

1. 配置 `.env`（`NEXT_PUBLIC_API_URL=https://<后端>/api/v3`、`NEXT_PUBLIC_GATEWAY_URL=<后端域名>`），注意 dev 模式后端无 `/api/v3` 前缀
2. 重点回归：文章/手记详情页、评论区（含 anchor 高亮、提交/回复/置顶）、在线人数与实时推送（文章发布/更新 toast、已读计数回推）、站长登录态（SSR `check_logged` + better-auth session）、页面列表（pageMeta 菜单与翻页）、图片 thumbhash 占位
3. **唯一需部署实测项**：`/fn/shiro/status`（serverless 函数，框架路由 `/fn/*` 在 v14 保留，函数本体为 DB 中 snippet 数据，其运行时 SDK 兼容性需实测）
4. 反向代理：Nginx 需将 `/ws/` 按 WebSocket 升级头代理到后端（官方文档已给出配置），不再需要 `/socket.io`

## 七、合规提示

本项目为 AGPLv3 + 附加条款（禁止未经授权的商用）。按 AGPL §13，改造版本公网部署时须向访问者提供完整源码获取途径（如公开 fork 并在站点页脚挂 Source 链接）。

---

## 八、2026-10-31 增量更新

### 8.1 Turbopack `::highlight` 兼容已修复（pnpm patch）

- 新增 `patches/@haklex__rich-editor@0.0.105.patch`（从 `dist/rich-editor.css` 剥离两条 `::highlight()` 规则），并注册到根 `package.json` 的 `pnpm.patchedDependencies`。
- 已核实 node_modules 生效：补丁后 `rich-editor/dist/rich-editor.css` 中 `::highlight` 出现 0 次；`rich-kit-shiro/src/style.css` 仅 `@import` 转发，不含该规则。此前 `dev-server.log` 中的 `GET / 500` 为打补丁前的旧记录。
- **Turbopack `next dev` / `next build` 的复验未完成**：本机 IDE 会话 shell 中 node/pnpm 无法穿透任何 NTFS junction（含新建链接，报 `UNKNOWN` / `untrusted mount point`），构建链路全部依赖 junction，无法在本会话运行。需在用户正常终端执行 `pnpm -C apps/web build` 与 `pnpm dev:turbo` 复验。9-26 当日 `next dev` 可正常运行，说明该限制为环境策略后置变化，与本仓库代码无关。

### 8.2 调试遗留物清理

- 已删除：根目录 0 字节 `_tmp_14832_*`、`apps/web/home.html`、`apps/web/dev-server.log`；`.gitignore` 增加 `*.log` 与 `apps/web/*.html`。
- 遗留：诊断用的空 junction `E:\VibeCode\Shiro\.junction_test`（安全删除守卫拒绝删除），可在用户终端 `rmdir .junction_test` 移除。

### 8.3 `translationMeta` 宽松访问重构（对应 3.2 遗留项）

- 后端契约（核对 mx-core 源码）：详情接口响应 meta 为 `translation: Record<entryId, { article: { isTranslated, sourceLang, targetLang, translatedAt, model, availableTranslations } }>`（`post.controller.ts` / `note.controller.ts` 均 `metaBuilder.translation(translationMap)`）。
- 前端改动：
  - `queries/definition/post.ts`、`note.ts`：查询结果改为 `{ post|note, translation? }`（`$meta.translation` 透传），新增 `PostDetailQueryResult` / `NoteDetailQueryResult`。
  - `lib/seo/hreflang.ts`：新增 `extractArticleTranslationMeta(translation, entryId)`，兼容 `Record` 与单 `EntryTranslation` 两种形态。
  - posts/notes 详情页 `generateMetadata`：`(data as any).translationMeta` 宽松访问 → `extractArticleTranslationMeta(translation, data.id)`，hreflang 的 `sourceLang` / `availableTranslations` 从此真正生效。
  - 消费点适配（共 6 处）：posts `api.tsx`/`pageExtra.tsx`/`PostPreview.tsx`，notes `api.tsx`/`pageExtra.tsx`/`NotePreview.tsx`，`CurrentNoteDataProvider.tsx`。
- 全仓库 `(data as any).translationMeta` 残留清零；IDE 诊断 0 错误（完整 `tsc`/构建复验同 8.1 受阻）。

### 8.4 版本勘误

- 实际安装的 `@mx-space/api-client` 为 **5.13.0**（文档原记 5.12.0）。

### 8.5 部署期问题排查记录（2026-11-01）

- **Dockerfile**：deps 阶段锁定 `pnpm@10.27.0`——pnpm v12 起全局包入口从 `bin/pnpm.cjs` 移到包根，builder 阶段复用软链会断链（`pnpm: not found`）；builder 软链改绝对路径并加自检。
- **CI**：新增 `.github/workflows/docker-build.yml`（GitHub Actions → 阿里云 ACR 个人实例），含推送权限预检（hello-world 探测）、`provenance: false`（ACR 不接受 OCI attestation 的 empty JSON manifest）、registry/namespace 改用仓库 Variables（日志可见）。GHA 层缓存复用 apk/pnpm/字体层。
- **Dockerfile runner 阶段**：补充 `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_GATEWAY_URL` 运行时环境变量——SSR 侧 Next 在运行时读取 `process.env.NEXT_PUBLIC_*`（仅客户端包是构建期内联），缺失导致服务端 fetch 相对路径报 `ERR_INVALID_URL`。
- **nginx 站点配置**（`/etc/nginx/sites-enabled/voidink.tech`）：`location /` 改指前端 2323；新增 `/api/v3`（透传前缀）与 `/ws/`（原生 WebSocket 升级头，v14 已无 socket.io）；备份为 `voidink.tech.bak-*`。
- **mx-core 空站行为（上游设计）**：站点不存在任何可见手记时，`GET /api/v3/aggregate` 因 `note.service.getLatestNoteId` 抛 `NOT_FOUND` 而整体 404，导致 Shiro 首页聚合拉取失败——发布一篇手记即恢复，非适配问题。
- **首页 500（`Cannot read properties of undefined (reading 'webUrl')`）**：`app/[locale]/api.tsx` 的 `fetchAggregationData` 用裸 `$fetch` 直取聚合接口但**漏做 V3 信封解包**（5+1 处裸 fetch 补丁中的漏网之鱼），layout 拿到 `{data:{...}}` 信封后解构 `url` 为 undefined。已补 `unwrapV3Envelope`——这是最后一个遗留解包点。
- **最终验证（全部通过）**：首页 200（HTML 渲染）、`/api/v3/aggregate/site` 200（V3 信封）、`/ws/web` 101 升级成功。

### 8.6 部署期问题排查记录（2026-11-02）

- **`/api/v3/fn/shiro/status` 404（FUNCTION_NOT_FOUND，预期行为）**：前端 header 的 `OwnerStatus` 组件（头像右下角状态 emoji）在每次页面激活时 `GET fn/shiro/status`，该端点是 **serverless 云函数片段**，需在后台「集成 → 代码片段」手动创建（官方 extra 文档部署项）：名称 `status`、引用 `shiro`、类型 `Function`、请求方式 `ALL`、Secret 键 `key`（自定义复杂密钥），函数体取官方仓库 `mx-space/snippets` 的 `shiro/functions/status.ts`。不部署不影响核心功能，仅登录后头像状态设置不可用（未登录访客无感知）。
- **`/timeline` 等 loading 路由整页报「客户端组件渲染时报错」**：根因是 `loading_default` / `comment_placeholders` 消息值为**字符串数组**（上游 Shiro 同步引入的形态），而 next-intl 4.8.3 生产 format 路径（`format-message/index.js`）对数组消息直接 `throw new IntlError(INVALID_MESSAGE)`（无 originalMessage，与 SSR 日志 `Error: INVALID_MESSAGE` 完全吻合）。触发链：`definePrerenderPage` fetcher 挂起 → 路由级 `loading.tsx` → `FullPageLoading` → `t('loading_default')` → 抛错被 `ErrorBoundary` 捕获。所有带 `loading.tsx` 的路由（timeline/friends/notes/posts/projects/says/thinking…）均受影响。修复（7df4abd7）：三个语言包的数组消息压平为 `|` 分隔字符串；`Loading` 组件改为客户端挂载后随机（SSR 固定第一条，避免 hydration mismatch）；`getRandomPlaceholder` 适配分隔格式（调用方本就传 `t.raw`，raw 对数组不抛错、但压平后统一走普通路径更稳）。本地 production build + `next start` 实测 `/timeline` 200，Loading 文案/手记内容/统计文案均正常渲染。
