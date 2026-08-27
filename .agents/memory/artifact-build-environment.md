---
name: Artifact build environment
description: Environment variables required when validating Vite artifact builds outside managed workflows
---

Direct Vite builds for the workspace's routed artifacts require both `PORT` and `BASE_PATH`; managed Replit workflows provide them automatically.

**Why:** Running a package build without those variables fails while loading the Vite config, which can look like an application build regression even when the source is valid.

**How to apply:** When validating an artifact package directly, provide the same routing environment as its workflow before treating a config-load failure as a code issue.