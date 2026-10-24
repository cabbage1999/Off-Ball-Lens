# Microsoft Foundry 开通与本机验证

本项目的 DAS 分析和播放器不需要云端密钥。规划要求的真实 Microsoft 工具调用需要你们自己的可用 Azure 订阅、模型部署与访问权限；配置文件存在不等于调用成功。

## 1. 建立资源与模型部署

1. 登录 [Microsoft Foundry](https://ai.azure.com/)，使用团队有权限的 Azure 订阅创建 Foundry 资源与项目。没有订阅时先按 [微软官方资源创建指南](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources)建立账号和订阅；账号验证、订阅及费用选择由团队完成。
2. 在项目的模型部署入口选择该订阅和区域实际支持的模型。选择支持 **Responses API、function calling 和 structured outputs** 的模型；这次无需部署自定义足球模型。
3. 部署完成后记录**部署名称**，以及模型推理的 Azure OpenAI 资源 endpoint 和 API key。部署名称可能不同于模型名称。推荐资源 endpoint 形如 `https://资源名.openai.azure.com`；不要把控制台网页 URL 当 endpoint。
4. 如果团队只提供 Foundry 项目 endpoint，使用文末的项目令牌方式。不要混用项目 endpoint 和另一个资源的 key。

## 2. 在本机保存配置

在项目根目录复制 `.env.example` 为 `.env`，填入前三个值。真实 `.env` 被 Git 忽略；不要把 key 写入前端、GitHub、截图或聊天。

```dotenv
AZURE_OPENAI_ENDPOINT=https://你的资源.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=你的部署名称
AZURE_OPENAI_API_KEY=在本机填入真实密钥
```

服务器从本机 `.env` 读取配置。只有服务端调用 Microsoft；浏览器不接收密钥。公开 GitHub Pages 只能运行静态回放和本地解释，不能安全承载云端密钥。公开真实 AI 需部署同一 Node 服务并由部署平台注入环境变量。

## 3. 运行和核验

使用 Node.js 22 或以上版本，在项目目录运行 `npm start`，打开 `http://127.0.0.1:4173`。选择一个有效接应时刻，点击解释。界面必须显示 Microsoft 来源及成功的工具记录，单纯的“已配置”不是通过。

运行 `npm run smoke:foundry` 完成真实检查。脚本要求成功的模型调用、`analyze_window` 和 `get_evidence` 工具记录、通过校验的引用，并输出不含 key 的运行记录。没有配置、超时、无权限、模型不支持工具或回退模板都会明确失败；不能用离线测试替代。

目前真实调用仍待团队提供部署后验证。代码的接口测试使用模拟 HTTP 响应，只证明错误处理和事实校验。

本机检查通过后，按 [公网部署与 HTTP 验收指引](deployment.zh-CN.md)部署整个 Node 服务。真实 AI 演示需从该服务自己的网址打开；现有 GitHub Pages 保留静态回放入口。

## 4. 常见问题

- `401/403`：核对密钥所属资源、访问权限或令牌有效期。
- `404`：核对 endpoint 路径和部署名称；控制台 URL 不能用于推理。
- `429`：检查部署配额；等待后重试，或在控制台调整可用配额。
- 模型输出格式或工具不支持：使用部署页面标示支持这些能力的模型。不要删除事实校验来让检查“通过”。
- `cloud-configured`：仅表示三项配置齐全；完成真实解释后才会成为已验证状态。

## 项目 endpoint 的可选方式

微软也支持 `https://资源名.services.ai.azure.com/api/projects/项目名/openai/v1/responses`。本项目接受 `FOUNDRY_PROJECT_ENDPOINT` 加 `AZURE_FOUNDRY_AUTH_TOKEN`；token 必须来自已授权的 Microsoft Entra 登录，按微软文档使用 `https://ai.azure.com/.default` scope。此类短期 token 需要续期；部署服务应使用平台管理的身份方案。

依据：[Responses API 端点与认证](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/responses)、[Foundry 项目 Responses 指南](https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api)。本项目使用直接 REST 工具调用，不宣称运行了 Microsoft Agent Framework SDK。
