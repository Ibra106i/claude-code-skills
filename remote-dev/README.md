# remote-dev

Remote development workflow for OpenCode. Edit code on your local machine, run and preview it on a remote machine, and take screenshots to see the result — all from within the agent.

## How It Works

```
Local Machine (Windows)          Remote Machine (Linux)
┌─────────────────────┐          ┌─────────────────────┐
│ OpenCode            │   SSH    │ Node.js / Bun       │
│ Edits files         │ ───────> │ Dev server          │
│ Views screenshots   │ <─────── │ Puppeteer           │
└─────────────────────┘          └─────────────────────┘
```

## Prerequisites

- OpenCode installed locally
- SSH access to a remote Linux machine
- Node.js and Bun installed on the remote machine
- Puppeteer installed on the remote machine (for screenshots)

## Setup

### 1. Configure SSH

Add your remote host to `~/.ssh/config`:

```
Host remote-dev
    HostName 192.168.1.100
    User myuser
    IdentityFile ~/.ssh/id_ed25519
```

### 2. Install Dependencies on Remote Machine

```bash
# Install Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Puppeteer (for screenshots)
mkdir -p ~/screenshot-tool
cd ~/screenshot-tool
bun init -y
bun add puppeteer
```

### 3. Create Screenshot Tool

Save this as `~/screenshot-tool/screenshot.mjs` on the remote machine:

```javascript
import puppeteer from "puppeteer";

const url = process.argv[2] || "http://localhost:5173";
const outputPath = process.argv[3] || "/tmp/screenshot.png";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.screenshot({ path: outputPath, fullPage: false });

await browser.close();
console.log(`Screenshot saved to ${outputPath}`);
```

### 4. Configure OpenCode

Add to your `opencode.jsonc`:

```jsonc
{
  "plugin": ["laptop-tools"],
  "permission": {
    "ssh": { "*": "allow" }
  }
}
```

### 5. Configure the Plugin

Edit `laptop-tools.ts` and update the constants at the top:

```typescript
const LAPTOP = "myuser@192.168.1.100";  // Your remote host
const SSH_KEY = "C:/Users/me/.ssh/id_ed25519";  // Your SSH key path
```

## Usage

| Tool | Description | Example |
|------|-------------|---------|
| `laptop_sync` | Copy project files to remote | `laptop_sync()` |
| `laptop_run` | Run a command on remote | `laptop_run({ command: "ls -la" })` |
| `laptop_dev` | Start dev server | `laptop_dev()` |
| `laptop_stop` | Stop dev server | `laptop_stop()` |
| `laptop_screenshot` | Take screenshot | `laptop_screenshot({ url: "http://localhost:5173" })` |
| `laptop_fetch` | Fetch page HTML | `laptop_fetch({ url: "http://localhost:5173" })` |
| `laptop_status` | Check server status | `laptop_status()` |

## Customization

- **Project path**: Update the `sync-to-laptop.ps1` script with your local project path
- **Dev server port**: Change the port in `laptop_dev` and `laptop_status` tools
- **Screenshot viewport**: Modify `page.setViewport()` in `screenshot.mjs`

## Troubleshooting

### SSH connection fails
- Verify your SSH key and host are correct
- Test manually: `ssh -i /path/to/key user@host "echo ok"`

### Screenshot timeout
- Increase timeout in `screenshot.mjs` (default: 60s)
- Check if the dev server is actually running: `laptop_status()`

### Sync fails
- Ensure the remote directory exists
- Check SSH permissions on the remote machine
