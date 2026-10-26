# 将完整 Demo 部署到公网

这一步在本机 Foundry 调用通过之后进行。当前 GitHub Pages 已提供可用的静态回放；包含真实模型解释的演示需要由同一个 Node 服务提供网页与 API。目前没有运行中的 App Service 部署，也尚未验证真实云端解释。

## 1. 先明确两个地址

| 地址 | 能验证什么 |
| --- | --- |
| `https://cabbage1999.github.io/Off-Ball-Lens/` | 预计算 DAS、完整回放、本地事实解释和工程预览录像 |
| 团队创建的 App Service 网址 | 同一套回放，加上服务端实际 Foundry 工具调用；需部署后验证 |

前端请求的是相对路径 `./api/explain`，服务器只接受同源请求。因此请从部署后的 Node 服务网址打开整个作品。仅创建一个 API 后端，并不会让现有 GitHub Pages 自动使用它；本方案无需改跨域设置或把密钥放进网页。

## 2. 创建并部署 Node 服务

1. 先完成 [Foundry 开通与本机配置](foundry-setup.zh-CN.md)，确认 `npm run smoke:foundry` 实际通过并生成脱敏记录。
2. 在团队 Azure 订阅内创建 **App Service / Web App**，使用代码部署、Linux 和当前可用的 Node.js LTS 运行时。本项目要求 Node.js 22 或更高，现有 CI 使用 Node.js 22。订阅、区域和套餐由团队按预算与评审期间可用性选择。
3. 在 Deployment Center 连接 `cabbage1999/Off-Ball-Lens` 的 `main` 分支，按门户流程授权 GitHub 部署。仓库根目录已包含 `package.json`、`server.mjs` 和完整预计算数据；无需在服务启动时安装 Python 或重新计算 DAS。
4. 将启动命令设置为 `node server.mjs`。在应用设置中添加 `HOST=0.0.0.0` 和 `NODE_ENV=production`。保留平台提供的 `PORT`，不要照抄本机 `.env` 中的 `PORT=4173`。
5. 在服务端应用设置中添加同一部署的 `AZURE_OPENAI_ENDPOINT`、`AZURE_OPENAI_DEPLOYMENT` 和 `AZURE_OPENAI_API_KEY`。应用设置由平台注入进程环境；不要上传本机 `.env`，也不要把这些值写入 GitHub 工作流或前端文件。
6. 部署完成后，用浏览器访问门户提供的 HTTPS 地址。检查页面、三段回放以及 `/api/health`。若应用启动失败，查看部署日志和运行日志，先核对运行时、启动命令、`HOST` 和 `PORT`。

Node 运行时、平台端口和启动方式依据 [Microsoft App Service Node.js 配置文档](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs)；创建与部署入口参见 [Node.js Web App 快速入门](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs)。应用设置的注入方式参见 [官方配置说明](https://learn.microsoft.com/en-us/azure/app-service/configure-common)。

如果选择 ZIP 部署，压缩包第一层必须直接是 `package.json`、`server.mjs` 等项目文件，不能多包一层仓库目录；GitHub 的 Download ZIP 需要先解压再按此要求打包。参见 [官方 ZIP 部署说明](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip)。

## 3. 验收指定服务地址

在保存了当前仓库的本机运行，把示例地址替换为实际 App Service 的 HTTPS 根地址：

```sh
npm run smoke:deployment -- --url https://你的应用.azurewebsites.net
```

这项检查走真实 HTTP 路由，核对页面/数据版本、服务状态、同源解释请求和证据。默认要求有效的 Microsoft 来源、工具执行记录、正确事实和服务端已验证状态；配置存在、HTTP 200、模板回退或静态页面可打开都不能单独使它通过。脱敏结果写入 `artifacts/deployment-check.json`。

在本机尚无 Azure 配置时，可以先验工程链路：

```sh
npm start
```

另开一个终端：

```sh
npm run smoke:deployment -- --url http://127.0.0.1:4173 --offline
```

`--offline` 只检查本地/离线 HTTP 体验，不能完成真实云端验收。本机模拟云协议也不能记为真实 Microsoft 调用。服务器自行返回的状态不是外部平台的独立认证；真实验收还应核对 Azure 控制台调用记录与脱敏响应标识。

## 4. 浏览器和评审期间检查

在实际 App Service 网址分别以球迷、分析师模式提问，并切换语言、球员与时间。验证证据按钮跳到对应帧，取消旧请求后旧解释不会覆盖新画面，超时会明确回退。`/api/health` 的 `cloud-configured` 只表示配置齐全；真实解释通过校验后才会在当前服务进程内显示 `cloud-verified`。

当前服务最多同时处理两项解释请求，并带有限流和短时缓存，适合小规模演示。代理转发、休眠、配额和多实例状态都应在实际托管环境中检查；本机结果不等于生产可用性保证。

将真实 Microsoft 解释片段录入最终英文演示，更新提交中的服务地址，并保持评审期内可免费测试。按本次规划，服务应至少保持到北京时间 **2026 年 11 月 11 日 15:59**；提交前再核对[官方规则](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)。已经发布的 108 秒录像仍是如实标注的离线工程预览。
