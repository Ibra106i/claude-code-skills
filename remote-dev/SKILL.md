---
name: remote-dev
description: Remote development workflow. Edit code locally, run and preview on a remote machine, screenshot the result. Triggers on: "run on remote", "test on remote", "show me the design", "screenshot the app", "deploy to remote", "sync to remote", or any request to execute code remotely.
---

# Remote Development

A remote Linux machine serves as the execution environment. Code is edited locally and synced to the remote machine for building, testing, and previewing.

## Architecture

```
Local (Windows)                   Remote (Linux)
┌─────────────────┐              ┌─────────────────┐
│ OpenCode        │     SSH      │ Node.js 22      │
│ Edits files     │ ───────────> │ Bun 1.4         │
│ Runs agent      │              │ Puppeteer       │
│ Views screenshots│ <────────── │ Vite dev server │
└─────────────────┘              └─────────────────┘
```

## Available Tools

| Tool | Description | Usage |
|------|-------------|-------|
| `laptop_sync` | Copy project files to remote | Run after editing files locally |
| `laptop_run` | Execute any command on the remote | `{ command: "ls -la" }` |
| `laptop_exec` | Execute command with extended timeout | `{ command: "bun run build", timeout: 120000 }` |
| `laptop_dev` | Start dev server on remote | No args needed |
| `laptop_stop` | Stop dev server | No args needed |
| `laptop_screenshot` | Take screenshot of running app | `{ url: "http://localhost:5173" }` |
| `laptop_browser` | Take screenshots of multiple pages | `{ url: "http://localhost:5173", pages: ["/", "/about"] }` |
| `laptop_fetch` | Fetch webpage HTML | `{ url: "http://localhost:5173" }` |
| `laptop_status` | Check server status | No args needed |
| `laptop_logs` | Tail dev server logs | `{ lines: 100 }` |
| `laptop_tunnel` | SSH port forwarding | `{ localPort: 8080, remotePort: 3000 }` |
| `laptop_perf` | Run Lighthouse audit | `{ url: "http://localhost:3000" }` |
| `laptop_docker` | Docker compose operations | `{ action: "up", service: "web" }` |

## Workflow

### Standard Development Loop

1. **Edit files** locally using `read`/`write`/`edit` tools
2. **Sync to remote** using `laptop_sync`
3. **Start dev server** using `laptop_dev` (if not running)
4. **Take screenshot** using `laptop_screenshot` to see the result
5. **Analyze screenshot** — describe what you see, identify issues
6. **Fix code** based on analysis
7. **Repeat** from step 2

### Quick Preview

When the user says "show me the design" or "how does it look":

1. Ensure dev server is running: `laptop_status`
2. If not running: `laptop_dev`
3. Take screenshot: `laptop_screenshot` with `url: "http://localhost:5173"`
4. Read and analyze the screenshot image
5. Describe what you see

### Testing

When the user says "test the app" or "check for bugs":

1. Sync latest code: `laptop_sync`
2. Restart dev server if needed: `laptop_stop` then `laptop_dev`
3. Take screenshot of main page
4. Navigate to different routes by changing the URL
5. Look for visual bugs, layout issues, broken components
6. Report findings and fix any issues

## Commands Reference

### Sync Project
```bash
# Local side (PowerShell)
powershell -ExecutionPolicy Bypass -File ~/scripts/sync-to-laptop.ps1
```

### Run Commands on Remote
```bash
# Via SSH
ssh -i /path/to/key user@remote "command here"

# Via tool
laptop_run: { command: "cd ~/project && bun run build" }
```

### Take Screenshot
```bash
# Via tool (recommended)
laptop_screenshot: { url: "http://localhost:5173" }

# Via SSH
ssh user@remote 'export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run screenshot.mjs http://localhost:5173 /tmp/screenshot.png'
scp user@remote:/tmp/screenshot.png ./screenshot.png
```

## Additional Usage

### View Logs
```bash
# Via tool
laptop_logs: { lines: 100 }
```

### SSH Tunnel
```bash
# Access remote port 3000 locally as port 8080
laptop_tunnel: { localPort: 8080, remotePort: 3000 }
```

### Multi-page Screenshots
```bash
# Screenshot multiple pages at once
laptop_browser: { url: "http://localhost:5173", pages: ["/", "/about", "/contact"] }
```

### Performance Audit
```bash
# Run Lighthouse
laptop_perf: { url: "http://localhost:3000" }
```

### Docker Operations
```bash
# Start containers
laptop_docker: { action: "up" }

# Start specific service
laptop_docker: { action: "up", service: "web" }

# Check status
laptop_docker: { action: "status" }

# View logs
laptop_docker: { action: "logs", service: "api" }
```

## Troubleshooting

### Dev server returns 404
- Check if Cloudflare plugin is disabled in config files
- Kill existing processes: `pkill -f vite`
- Restart: `laptop_dev`

### Screenshot timeout
- Increase timeout in `~/screenshot-tool/screenshot.mjs`
- Check if dev server is actually running: `laptop_status`
- Try `domcontentloaded` instead of `networkidle0`

### SSH connection issues
- Verify key: `ssh -i /path/to/key user@remote "echo ok"`
- Check remote machine is powered on and connected to network

### Sync fails
- Ensure remote directory exists
- Check SSH permissions on the remote machine

### Lighthouse fails
- Ensure Chrome is installed on remote: `which google-chrome`
- May need to install: `apt install google-chrome-stable`

### Docker errors
- Ensure Docker is installed and running on remote
- Check user permissions: `docker ps` should work without sudo
