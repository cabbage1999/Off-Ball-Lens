# 将完整 Demo 部署到公网

当前 GitHub Pages 提供静态回放、预计算 DAS 和确定性解释，没有公开的 MAF 后端。2026年10月27日，本机完整 Node → MAF → Azure 链路已通过[单次 smoke](../artifacts/agent-framework-trace.json)和[8项扩展检查](../artifacts/agent-framework-suite.json)，均为真实调用、`mock:false`。公网版本仍需另行部署与验收，不能将本机通过当作公开服务已上线。

## 1. 区分静态回放和完整服务

| 地址 | 能验证什么 |
| --- | --- |
| `https://cabbage1999.github.io/Off-Ball-Lens/` | 预计算 DAS、完整回放、本地事实解释和工程预览录像 |
| 团队另行部署的同源服务网址 | 同一套回放，加上 Node、Python MAF 与 Azure 的完整解释链路；需实际部署后验证 |

前端请求相对路径 `./api/explain`，服务端只接受同源浏览器请求。应从部署后的服务网址打开整个作品。单独创建 API 后端不会让现有 GitHub Pages 自动连接它，密钥也不应进入网页。

## 2. 准备双运行时部署环境

MAF 版本要求目标环境同时提供 **Node.js 22或以上、Python 3.12**，并允许 Node 创建 Python 子进程。构建阶段在目标环境运行：

```sh
npm run setup:agent
npm run test:agent
npm test
```

`setup:agent` 按 `requirements-agent.lock` 安装 `.venv-maf`。不要直接复制另一台电脑的虚拟环境；解释器路径和平台依赖应在目标环境重新建立。已有完整依赖环境时，可设置绝对路径 `MAF_PYTHON`。预计算分析已经随仓库提供，无须在部署时安装 `.venv-das` 或重新计算 DAS。

采用 Azure App Service 时，应选择实际提供这两个运行时的环境。例如可按[官方自定义容器指南](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container)准备镜像，并在镜像内安装固定依赖。仅在门户选择 Node.js 内置运行时，不代表 Python 3.12 与 MAF 已安装。镜像、构建和公网启动需要在选定托管环境中实际验收；本仓库尚未提供已通过公网验证的 MAF 服务。

保留 `FOUNDRY_ORCHESTRATOR=native` 的旧版服务只需 Node 即可运行；它不是 MAF 验收结果。Node 运行时与启动配置可参考[官方 Node.js 配置文档](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs)。

10月27日已复核当前订阅为 Free Trial、`spendingLimit=On`；本机检查没有新建资源、升级订阅或购买 Marketplace。公开托管和模型推理的适用费用需分别核对；模型请求不是天然免费，符合条件的用量会消耗试用额度。

## 3. 配置进程、凭证和外部来源

在托管平台的服务端环境设置中配置：

```dotenv
HOST=0.0.0.0
NODE_ENV=production
FOUNDRY_ORCHESTRATOR=agent-framework
FOUNDRY_API_STYLE=responses
FOUNDRY_REASONING_EFFORT=minimal
AZURE_OPENAI_ENDPOINT=你已验证并有权使用的推理端点
AZURE_OPENAI_DEPLOYMENT=该端点接受的模型或部署名称
AZURE_OPENAI_API_KEY=通过平台服务端设置注入
```

使用 `npm run start:agent` 启动，也可在上述环境变量已配置时运行 `node server.mjs`。按平台要求提供监听端口；平台已注入 `PORT` 时保留该值，不要照抄本机的 `4173`。自定义容器的公开端口还须按平台规则配置。应用设置的注入方式参见[官方说明](https://learn.microsoft.com/en-us/azure/app-service/configure-common)。

若 HTTPS 在反向代理处终止，Node 内部收到的是 HTTP，请显式指定外部页面的来源：

```dotenv
PUBLIC_ORIGIN=https://你的应用.azurewebsites.net
```

值只包含协议、主机及必要端口，不带路径、凭证、查询或片段。未设置时，服务端按直接连接来源进行校验；任意转发头不会自动放宽同源限制。`PUBLIC_ORIGIN` 也不会为任意其他网站打开跨域访问。

凭证只由平台服务端环境注入。不要上传本机 `.env`，也不要将密钥写入镜像、GitHub 工作流、前端或录像。Python worker 只接收当前选定的凭证和显式配置。模型仅能调用两个证据工具，没有文件系统或 shell 工具；子进程本身不是操作系统级安全隔离。

采用 ZIP 部署时，压缩包第一层应直接包含 `package.json`、`server.mjs`、`agent_runtime/` 等项目文件，不多包一层仓库目录。目标环境仍须完成 Python 依赖安装；ZIP 文件本身不会补齐运行时。参见[官方 ZIP 部署说明](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip)。

## 4. 验收实际服务网址

先访问实际 HTTPS 地址，检查页面、三段回放及 `/api/health`。在保存当前仓库的本机运行：

```sh
npm run smoke:deployment -- --url https://你的应用.azurewebsites.net
```

检查通过真实 HTTP 路由核对页面与数据版本、服务状态、解释请求和规范证据。默认要求有效的 Microsoft 来源、工具记录、正确事实和已验证状态；配置存在、HTTP 200、模板回退或静态页面可打开，都不能单独使其通过。记录写入 `artifacts/deployment-check.json`。MAF 部署还应确认返回的 `orchestrator` 为 `microsoft-agent-framework`，并保留对应运行版本及原生响应/调用标识。

`npm run smoke:agent` 和可选 `--suite` 启动的是本机服务，不会自动检查已部署网址。部署 HTTP 检查也不能独立鉴证后台 Azure 身份，应结合真实提供方脱敏记录和 Azure 侧调用记录。缺少配置时，工程链路可按以下方式单独测试：

```sh
npm start
```

另开一个终端：

```sh
npm run smoke:deployment -- --url http://127.0.0.1:4173 --offline
```

`--offline` 仅用于未配置云端的本地/离线服务，不能完成云端验收。内存模拟提供方的通过也不等于真实 Microsoft 调用通过。

## 5. 浏览器与评审期间检查

在实际服务网址分别以球迷、分析师模式提问，切换语言、球员和时间。检查证据按钮跳到对应帧，取消后的旧解释不会覆盖新画面，失败时明确标注本地回退。`/api/health` 的 `cloud-configured` 只表示配置齐全；当前配置下的真实解释通过校验后，当前服务进程才显示 `cloud-verified`。

当前服务最多同时处理两项解释请求，并有限流。MAF 每次请求新建子进程，不使用解释结果缓存；旧版 native 模式保留短时成功缓存。MAF 的40秒总时限、6次模型请求、10次工具调用和最多一次修复也适用于公网请求。应实测代理超时、进程清理、休眠、配额和多实例状态，本机通过不等于托管环境通过。

本机真实 MAF 验证已完成；最终英文 MAF 演示、人工评审和公网服务仍待完成。部署后更新提交中的服务地址，并保持评审期间可访问。按本次规划，服务应至少保持到北京时间 **2026年11月11日15:59**；提交前再核对[官方规则](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)。已发布的108秒录像仍是明确标注的离线工程预览。
