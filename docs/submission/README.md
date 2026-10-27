# Hackathon submission package

**Project:** Off-Ball Lens  
**Team:** College of Engineering Football  
**Representative:** Jingbang Yang  
**Entry:** [Innovation Studio project 126816](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/project/126816)

This directory contains the entry text and testing instructions for the current v3 replay. Preparation and publication of these files are not proof that the competition entry is complete; the video URL and full Agent testing access must also be checked on the project page.

## Entry materials

| Material | Location / status |
| --- | --- |
| English pitch and project description | [Project description](project-description.md) |
| Public code | [cabbage1999/Off-Ball-Lens](https://github.com/cabbage1999/Off-Ball-Lens) |
| Free interactive replay | [GitHub Pages](https://cabbage1999.github.io/Off-Ball-Lens/); precomputed analysis and local explanations |
| Testing and reproduction instructions | [Testing guide](testing-guide.md) |
| Current implementation and verification | [V3 record](../replay-v3.md) and [real MAF receipts](../../artifacts/agent-framework-suite.json) |
| Current-version demonstration video | In preparation; the historical v2 preview is not the final submission video |
| Full Agent access for judges | Real local execution verified; a free hosted service or equivalent access arrangement remains outstanding |
| Submission receipt | Not yet recorded |

## Official delivery requirements

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), checked on 27 October 2026, direct entrants to complete their project page in Innovation Studio. There is no requirement to submit a pull request to the rules repository.

- Submission closes **27 October 2026, 23:59 Pacific Daylight Time**, equivalent to **28 October 2026, 14:59 Beijing time (UTC+8)**.
- Include an English pitch/description identifying the project, problem, functionality, and Microsoft/Azure technologies.
- Include an actual functioning demonstration video **shorter than 120 seconds**, with a public URL on **YouTube, Vimeo, Facebook Video, or Youku**. A repository-hosted video alone does not meet the listed video-host requirement.
- Provide a **public GitHub repository** and access to a working website, demo, or test build, with instructions and any necessary credentials.
- Testing must be free and available through **10 November 2026, 23:59 Pacific Standard Time**, equivalent to **11 November 2026, 15:59 Beijing time**.
- Use synthetic football-realistic data, preserve required third-party attribution, and provide English materials or English translations.

The static replay requires no account or key. The reproduction instructions for the local cloud Agent require authorized Azure access and do not by themselves establish free access for judges. The project implements **one** Microsoft Agent Framework Agent; development-time collaboration is not a multi-agent runtime feature.

## Repository organization

The source baseline is commit [`63e3dfe`](https://github.com/cabbage1999/Off-Ball-Lens/commit/63e3dfe5bf15b61e837fd6fdee67529b1236bd80). All 113 published files were matched against local Git blob hashes before preparation. The application, numerical code, scenarios, precomputed analysis, tests, and dependencies are preserved. Only repository navigation, submission materials, new demonstration assets, and historical-document organization are in scope.

Three unreferenced historical files were moved byte-for-byte to [the v2 archive](../archive/README.md). Existing historical acceptance reports and video paths remain available. Tests and source files with older names remain in place wherever the current application still uses them. Local environment files, credentials, caches, and private working records are excluded from publication.
