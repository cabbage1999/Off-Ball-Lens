# Microsoft Agent Framework：配置与本机验证

播放器和预计算 DAS 不需要云端密钥。服务器的 MAF 模式使用一个真正的 Microsoft Agent Framework Agent，通过原生工具调用读取 Node 提供的证据，再由 Node 校验和渲染。完整链路需要 Node.js 22 或以上、Python 3.12，以及本人有权使用的 Azure 推理端点和凭证。

## 1. 当前已经验证到哪里

当前账号的 `azure_check.py` 直接检查已成功请求：

```text
POST https://westus3.api.cognitive.microsoft.com/openai/v1/responses
model: gpt-5-mini
reasoning.effort: minimal
```

此前 `CannotDeployDueToLocalRegulations` 发生在模型部署创建请求。它与上述推理成功是两个不同的事实；不能继续把历史创建失败描述为“任何模型都不能调用”。这次成功只证明测试账号、该端点与该模型参数下的直接推理可用，不推断 Azure 未公开的后台路由，也不保证另一个账号具有相同权限。

**2026年10月27日，完整本机 Node → MAF → Azure 链路已通过真实 smoke 与8项扩展检查。** [单次记录](../artifacts/agent-framework-trace.json)和[扩展记录](../artifacts/agent-framework-suite.json)均为 `mock:false`。扩展检查包含三个场景各自的英文分析师与中文球迷请求，以及局限问题、对抗性问题；记录保存每项的耗时、模型请求、原生工具调用与修复次数。

本次重新认证时，设备码流程被 Security Defaults 拒绝，随后使用常规交互式浏览器 `az login` 成功登录；没有关闭安全设置。既有端点与凭证用于上述检查，没有新建资源。记录证明本机完整工具链实际运行，不说明公网后端已经部署，也不替代人工回答质量或足球合理性评审。

另有内存模拟提供方的本地工程测试覆盖真实 MAF SDK、Python 子进程协议及 Node 校验；这些测试本身不请求 Azure，应与上述真实运行记录区分。

## 2. 试用订阅与费用边界

2026年10月27日已复核当前订阅为 Free Trial，且 `spendingLimit=On`。本次检查没有升级为按量付费、移除支出限制或购买 Marketplace 模型。云端推理并非天然免费：符合订阅条件的用量会消耗试用额度，具体计费以 Azure 记录为准。不要仅因模型出现在目录、存在配额或请求返回成功，就断言该用量免费。

Azure 支出限制对适用服务提供额度保护；额度耗尽后服务可能停用。某些单独计费服务不在同一保护范围内，因此本方案不加入 Marketplace 购买。预算提醒也不等于硬性停机限制。依据：[Azure 支出限制](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit)。

如果使用另一个订阅或端点，先核对该账号的访问资格、配额和计费条件。已有可用端点时无须为了运行本项目重新创建资源。本项目的安装、启动和 smoke 脚本都不会自动创建云资源、升级订阅或购买服务。

## 3. 安装独立的 Python 运行环境

在项目根目录运行：

```sh
npm run setup:agent
npm run test:agent
```

安装脚本查找 Python 3.12，创建 `.venv-maf`，按 `requirements-agent.lock` 安装并检查依赖。当前固定版本为 `agent-framework-core==1.23.0`、`agent-framework-openai==1.17.0`、`openai==3.39.0` 和对应的 `httpx2` 依赖。完整版本以锁文件为准。

若 Python 3.12 不在常用路径，可在当前终端设置 `MAF_BOOTSTRAP_PYTHON` 为其可执行文件后重试。运行时也可通过绝对路径 `MAF_PYTHON` 选择已装好这些依赖的 Python。`.venv-maf` 与数值分析使用的 `.venv-das` 分开；运行 MAF 无须重新计算 DAS。

`test:agent` 使用内存中的模拟提供方，不调用 Azure。安装成功和本地测试通过只说明软件环境与工程约束通过。

## 4. 在本机保存配置

将项目根目录的 `.env.example` 复制为 `.env`。真实 `.env` 被 Git 忽略；密钥只在自己的电脑填写，不放进聊天、前端、GitHub、截图或录像。

当前账号已经直接验证的配置形式为：

```dotenv
AZURE_OPENAI_ENDPOINT=https://westus3.api.cognitive.microsoft.com
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_API_KEY=在本机填入你有权使用的真实密钥
FOUNDRY_ORCHESTRATOR=agent-framework
FOUNDRY_API_STYLE=responses
FOUNDRY_REASONING_EFFORT=minimal
```

服务端会将端点补全为 `/openai/v1/responses`。`AZURE_OPENAI_DEPLOYMENT` 的值作为请求的 `model` 参数传入：当前已验证路由使用 `gpt-5-mini`；使用自己创建的 Azure 模型部署时，应填写该部署接受的名称。不要用控制台网页 URL 替代推理 endpoint，也不要混用不同资源的凭证。

已有资源 endpoint 也可使用 `https://资源名.openai.azure.com` 或 `https://资源名.services.ai.azure.com`，前提是账号和模型支持所需 Responses、function calling 与严格结构化输出。当前代码只额外接受上述已验证的 West US 3 区域地址，没有把所有 `api.cognitive.microsoft.com` 主机开放为通用端点。

MAF 使用 `OpenAIChatClient` 的 Responses 实现；它与 Chat Completions 客户端不同。API key 以 `api-key` 请求头发送；如果配置了 `AZURE_FOUNDRY_AUTH_TOKEN`，则使用对应的 Bearer token。运行时只使用显式传入的配置和凭证，不自动发现其他账号或切换提供方。

## 5. 启动、工具边界与真实检查

```sh
npm run start:agent
```

打开 `http://127.0.0.1:4173`，选择一个有效接应时刻并请求解释。每项请求由 Node 启动一个 Python 子进程，单个 MAF Agent 负责模型与工具的循环。它只注册两个工具：

| 工具 | 能读取什么 | Node 保留的约束 |
| --- | --- | --- |
| `analyze_window` | 所选球员在指定过去窗口内的既有 AS/DAS 与候选证据 | 同一球员、同一场景、有限时间范围，不取未来帧 |
| `get_evidence` | 最近一次成功分析对应的声明和帧引用 | 必须先分析，只接受已存在的证据 ID |

模型最终仅返回 `claim_ids`、`evidence_ids`、`overlay_type`。Node 独立校验已取回的引用及其相互关系，按规范事实生成中英文解释。Python 不读取或重新计算足球分析文件；模型没有文件系统或 shell 工具。这是工具能力限制，不是操作系统级文件访问隔离。当前没有第二个审查 Agent 或 MAF Workflow。

每项请求共享 40 秒总时限、最多6次模型请求和10次原生工具调用；提供方和工具的单次等待最多12秒。候选计划被拒绝后，最多在同一会话、同一剩余预算内修复一次。SDK自动重试关闭。客户端取消会终止对应子进程；无效结果、超时或提供方故障显示明确的本地回退。Node 在候选校验、原生调用标识核对、`done` 消息和正常子进程退出均成立后才返回成功。

以下命令会产生**真实 Azure 推理用量**：

```sh
npm run smoke:agent
```

它通过本机 Node HTTP 服务运行实际 MAF worker，核对响应 ID、原生工具调用 ID、所选证据、规范数值和子进程退出，并写入 `artifacts/agent-framework-trace.json`。缺少配置时显示 **NOT RUN**，不发起模型请求；回退、超时、无权限或证据不符都不能算通过。

需要扩展检查时可运行：

```sh
npm run smoke:agent -- --suite
```

这会增加三个场景的中英文请求，以及局限问题和试图改变时限/索取凭证的问题，生成 `artifacts/agent-framework-suite.json`，比单次 smoke 使用更多云端额度。脱敏记录保存框架/提供方版本、原生标识、工具和事实，不保存密钥。

`cloud-configured` 只表示配置齐全。成功的真实解释通过校验后，当前服务进程才会对当前配置显示 `cloud-verified`。本机通过后，再按[公网部署说明](deployment.zh-CN.md)验证实际服务；GitHub Pages 仍只有静态回放和确定性解释，没有公开 MAF 后端。

## 6. 保留的 native 模式

原有 Node 原生协议实现仍可显式选择：

```dotenv
FOUNDRY_ORCHESTRATOR=native
FOUNDRY_API_STYLE=responses
```

然后使用 `npm start` 和 `npm run smoke:foundry`；该检查按所配置的编排方式工作，记录写入 `artifacts/foundry-trace.json`。MAF 专项验收应使用前述 `smoke:agent`。

只有 native 模式支持 `FOUNDRY_API_STYLE=chat-completions`，调用资源级 `/openai/v1/chat/completions`。它需要模型支持原生 `tool_calls` 和 JSON 输出，不接受项目 endpoint。JSON 模式不是提供方强制 Schema，本地仍会拒绝伪造引用、缺少证据和无效叠加层。某个模型的能力表列出工具调用不等于当前账号已完成部署和真实检查。

## 7. 常见问题与项目端点

- `401/403`：核对凭证所属端点、访问权限和有效期；需要交互登录时由账号持有人完成。
- `404`：核对推理 endpoint 与 `model` 参数，避免使用门户网页地址。
- `429`：检查配额和当前用量。MAF SDK不自动重试；处理原因后可发起一次新请求。
- `CannotDeployDueToLocalRegulations`：这是历史部署创建阶段的账号资格拒绝。应由 Microsoft 核实该创建请求；更换协议不会解除账号限制，也不能据此否定另一个端点已经观测到的推理成功。
- `framework_unavailable` 或运行时缺失：运行 `npm run setup:agent`，核对 Python 3.12 和 `MAF_PYTHON`；不要把确定性回退当作安装成功。
- 模型格式或工具不支持：核对模型能力，并保留事实校验。完整 MAF 路径只使用 Responses。

项目 endpoint 的可选形式是 `https://资源名.services.ai.azure.com/api/projects/项目名/openai/v1/responses`。代码接受 `FOUNDRY_PROJECT_ENDPOINT` 加显式 `AZURE_FOUNDRY_AUTH_TOKEN`；项目路由不使用资源 API key。按 Microsoft 文档获取已授权的 Microsoft Entra token，使用 `https://ai.azure.com/.default` scope，并在到期后更新。当前 worker 不实现自动登录或令牌续期。

依据：[Responses API 端点与认证](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/responses)、[Foundry 项目 Responses 指南](https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api)。
