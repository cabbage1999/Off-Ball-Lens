# Azure deployment

The complete application is available at **[offball-lens-hackathon-2026.azurewebsites.net](https://offball-lens-hackathon-2026.azurewebsites.net/)**. Judges can open it and request an explanation without signing in or supplying an Azure key.

## Verified deployment

On 28 October 2026 Beijing time, the public application passed two real MAF checks: after initial deployment and after an App Service restart. Each compared 14 frontend and scene/analysis files against the local source, then obtained a fresh `cloud-verified` explanation from one Microsoft Agent Framework Agent using Azure `gpt-5-mini`. Each run made three model requests and two native evidence-tool calls, with no repair; measured Agent times were 11.171 and 16.068 seconds. These are observations, not a latency guarantee.

[verification.json](verification.json) records the file hashes, runtime versions, native-call identifier hashes, and Azure Monitor counts. The deployed application uses the existing runtime, numerical model, and data without edits. Azure-side aggregate request counts align with the test windows; aggregate metrics are not a per-response-ID attestation.

## Runtime and hosting

The site uses an Azure App Service **F1 Free** plan in West US 3, the official Python 3.12 runtime, and a checksum-verified Node.js 22.23.4 Linux executable. Startup observed Python 3.12.15. The [startup script](azure-startup.sh) installs the unchanged pinned `requirements-agent.lock` into a persistent virtual environment, then runs the existing Node server. It does not regenerate tracking or AS/DAS.

The Azure subscription retains its existing trial spending limit. Hosting is on the free tier; Azure model inference can consume trial credit. No subscription upgrade, Marketplace purchase, or spending-limit change was made. Server credentials are injected through App Service settings and are excluded from the deployment archive. The site uses HTTPS and an explicit same-origin setting.

The free plan has no Always On setting enabled and may sleep when idle. A cold visit can take longer. The existing application accepts at most two simultaneous explanation requests and 20 requests per minute per server-observed address. An Agent request has a 40-second total limit, at most six model requests, ten native tool calls, and one repair. Exhausted hosting/provider quotas or trial credit can interrupt availability. The deployment is left running for judging; this record does not guarantee future uptime.

## Rebuild the deployment package

Download `node-v22.23.4-linux-x64.tar.xz` from the [official Node.js distribution](https://nodejs.org/dist/v22.23.4/). The package helper checks its SHA-256 against the official release checksum before reading the binary:

```sh
python3 deploy/package-azure.py /path/to/node-v22.23.4-linux-x64.tar.xz
```

The [package helper](package-azure.py) writes an archive and source-hash manifest under the ignored `artifacts/private/` directory. It includes the application and public documentation from an explicit list, plus the Node executable and its license. Local virtual environments, caches, `.env`, and private deployment records are excluded. Apply the server-only Azure settings separately; never add them to the archive.

The App Service configuration uses `PYTHON|3.12`, startup command `bash deploy/azure-startup.sh`, port `8000`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, and `PUBLIC_ORIGIN` set to the deployed HTTPS origin. The startup script installs the locked MAF dependencies itself. Use the existing [deployment checker](../scripts/smoke-deployment.mjs) to verify a new deployment; its normal command writes `artifacts/deployment-check.json`, so preserve previous receipts before rerunning it.

The maintained resources are the resource group `rg-offball-lens-20261028`, App Service plan `plan-offball-lens-free`, and web app `offball-lens-hackathon-2026`. Existing Foundry resources are preserved. Account-specific balance and credential records remain private.
