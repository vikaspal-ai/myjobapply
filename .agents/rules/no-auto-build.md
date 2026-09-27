---
name: No Auto-Build
description: Prevents agents from automatically generating dist/ folders or running build commands unless explicitly requested by the user.
---

# Rule: No Auto-Build

## Context
The project contains `dist/` folders for both the frontend (Vite build output) and the backend (tsc build output). The user prefers to keep the workspace clean and manage the build process manually.

## Instructions
1. **Never run build scripts automatically**: Do NOT run commands like `npm run build`, `npm run build:server`, `tsc`, or `vite build` on your own initiative.
2. **Never generate `dist/` directories**: Do not compile code to `dist/` or similar output directories unless the user explicitly asks you to "build the project", "create a production build", or "compile the code".
3. **Use dev commands instead**: For running tests, type-checking, or development servers, use in-memory or dev-oriented tools (like `tsx`, `vite dev`, `vitest`) that do not output to the file system, instead of full build commands.
