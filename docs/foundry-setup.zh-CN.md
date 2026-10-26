# Microsoft Foundry 开通与本机验证

本项目的 DAS 分析和播放器不需要云端密钥。规划要求的真实 Microsoft 工具调用需要你们自己的可用 Azure 订阅、模型部署与访问权限；配置文件存在不等于调用成功。

## 1. 建立资源与模型部署

1. 登录 [Microsoft Foundry](https://ai.azure.com/)，使用团队有权限的 Azure 订阅创建 Foundry 资源与项目。没有订阅时先按 [微软官方资源创建指南](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources)建立账号和订阅；账号验证、订阅及费用选择由团队完成。
2. 在项目的模型部署入口选择该订阅和区域实际支持的模型。默认接口要求 **Responses API、function calling 和严格结构化输出**；另一种配置支持 **Chat Completions、原生工具调用和 JSON 输出**，见下文。两种方式都必须通过本项目的本地证据校验；这次无需部署自定义足球模型。
3. 部署完成后记录**部署名称**，以及模型推理的 Azure OpenAI 资源 endpoint 和 API key。部署名称可能不同于模型名称。推荐资源 endpoint 形如 `https://资源名.openai.azure.com`；不要把控制台网页 URL 当 endpoint。
4. 如果团队只提供 Foundry 项目 endpoint，使用文末的项目令牌方式。不要混用项目 endpoint 和另一个资源的 key。

### 仅使用试用额度时

保留试用订阅的 `spendingLimit=On`，不要升级为按量付费或移除支出限制。Azure 直销模型与合作伙伴 Marketplace 模型的计费条件不同；不能只凭模型出现在目录或有配额就认定它可以使用赠送额度。不要购买单独计费的 Marketplace 服务。受试用支出限制保护的服务会在额度耗尽时停用，试用期限届满也会影响可用性；预算提醒本身不是硬性停机保护。

目录可见、模型配额、账号部署资格和实际调用成功是不同条件。若创建请求返回 `CannotDeployDueToLocalRegulations`，应请 Microsoft 核实账号是否满足服务资格；修改应用代码不能解除这类限制。免费试用订阅不具备申请增加配额的资格。本项目不会自动升级订阅、购买模型或修改支出限制。

依据：[试用账户支出保护](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit)、[Azure 直销模型部署条件](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/create-model-deployments)、[免费试用配额规则](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#how-to-manage-limits)。

## 2. 在本机保存配置

在项目根目录复制 `.env.example` 为 `.env`，填入前三个值。真实 `.env` 被 Git 忽略；不要把 key 写入前端、GitHub、截图或聊天。

```dotenv
AZURE_OPENAI_ENDPOINT=https://你的资源.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=你的部署名称
AZURE_OPENAI_API_KEY=在本机填入真实密钥
```

默认 `FOUNDRY_API_STYLE=responses`。对于已经成功部署、支持原生工具和 JSON 模式的 Azure 直销模型，可显式选择另一协议：

```dotenv
FOUNDRY_API_STYLE=chat-completions
AZURE_OPENAI_ENDPOINT=https://你的资源.services.ai.azure.com
AZURE_OPENAI_DEPLOYMENT=你的部署名称
AZURE_OPENAI_API_KEY=在本机填入真实密钥
```

这一路径调用资源级 `/openai/v1/chat/completions`，不接受项目 endpoint。模型通过原生 `tool_calls` 请求分析和证据，服务器返回对应工具结果，再校验模型选择的声明与引用。JSON 模式只保证输出形式，不等于提供方严格 Schema；本地仍拒绝伪造引用、遗漏证据、超过长度限制或无效叠加层。默认 Responses 路径保持严格 Schema 请求。

DeepSeek-V3.2 的官方 Azure 能力表列有工具调用与 JSON 输出，因此可以作为有资格、有配额时的候选；这不代表当前订阅已成功部署。新增 Chat 适配已通过模拟协议测试，真实模型兼容性仍需下一节的实际检查。依据：[Azure 直销模型能力](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-direct-others)。

服务器从本机 `.env` 读取配置。只有服务端调用 Microsoft；浏览器不接收密钥。公开 GitHub Pages 只能运行静态回放和本地解释，不能安全承载云端密钥。公开真实 AI 需部署同一 Node 服务并由部署平台注入环境变量。

## 3. 运行和核验

使用 Node.js 22 或以上版本，在项目目录运行 `npm start`，打开 `http://127.0.0.1:4173`。选择一个有效接应时刻，点击解释。界面必须显示 Microsoft 来源及成功的工具记录，单纯的“已配置”不是通过。

运行 `npm run smoke:foundry` 完成真实检查。脚本要求成功的模型调用、`analyze_window` 和 `get_evidence` 工具记录、通过校验的引用，并输出不含 key 的运行记录。没有配置、超时、无权限、模型不支持工具或回退模板都会明确失败；不能用离线测试替代。

目前真实调用仍待可用的模型部署后验证。代码的接口测试使用模拟 HTTP 响应，只证明协议处理、错误处理和事实校验。脱敏记录包含 `apiStyle` 和 `outputMode`，区分两种输出协议；模拟测试通过不能记为真实调用通过。

本机检查通过后，按 [公网部署与 HTTP 验收指引](deployment.zh-CN.md)部署整个 Node 服务。真实 AI 演示需从该服务自己的网址打开；现有 GitHub Pages 保留静态回放入口。

## 4. 常见问题

- `401/403`：核对密钥所属资源、访问权限或令牌有效期。
- `404`：核对 endpoint 路径和部署名称；控制台 URL 不能用于推理。
- `429`：检查部署配额；等待后重试，或在控制台调整可用配额。
- `CannotDeployDueToLocalRegulations`：这是创建模型时的账号资格拒绝，应由 Microsoft 核实；不能把更换模型或 API 格式当作资格豁免。
- 模型输出格式或工具不支持：使用部署页面标示支持这些能力的模型。不要删除事实校验来让检查“通过”。
- `cloud-configured`：仅表示三项配置齐全；完成真实解释后才会成为已验证状态。

## 项目 endpoint 的可选方式

微软也支持 `https://资源名.services.ai.azure.com/api/projects/项目名/openai/v1/responses`。本项目接受 `FOUNDRY_PROJECT_ENDPOINT` 加 `AZURE_FOUNDRY_AUTH_TOKEN`；token 必须来自已授权的 Microsoft Entra 登录，按微软文档使用 `https://ai.azure.com/.default` scope。此类短期 token 需要续期；部署服务应使用平台管理的身份方案。

依据：[Responses API 端点与认证](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/responses)、[Foundry 项目 Responses 指南](https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api)。本项目使用直接 REST 工具调用，不宣称运行了 Microsoft Agent Framework SDK。
