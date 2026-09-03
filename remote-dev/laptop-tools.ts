import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

// ============================================================
// Configure these for your environment
// ============================================================
const REMOTE_HOST = "user@192.168.1.100";       // Your remote host
const SSH_KEY = "C:/Users/me/.ssh/id_ed25519";   // Your SSH key path
const PROJECT_DIR = "C:/Users/me/project";       // Local project path
const REMOTE_DIR = "~/project";                  // Remote project path
const DEV_PORT = 5173;                           // Dev server port
// ============================================================

const SSH_OPTS = `-i ${SSH_KEY} -o StrictHostKeyChecking=no`;

function ssh(cmd: string): string {
  return execSync(`ssh ${SSH_OPTS} ${REMOTE_HOST} "${cmd}"`, {
    encoding: "utf-8",
    timeout: 30000,
  });
}

function scp(remote: string, local: string): void {
  execSync(`scp ${SSH_OPTS} ${REMOTE_HOST}:${remote} ${local}`, {
    encoding: "utf-8",
  });
}

export const LaptopTools = async (ctx: any) => {
  return {
    tools: {
      laptop_sync: {
        description:
          "Sync project files from local to remote. Run after editing files.",
        execute: async () => {
          try {
            execSync(
              `rsync -avz --delete --exclude node_modules --exclude .git --exclude dist ${PROJECT_DIR}/ ${REMOTE_HOST}:${REMOTE_DIR}/`,
              { encoding: "utf-8", timeout: 60000 }
            );
            return "Project synced to remote successfully";
          } catch (e: any) {
            return `Sync failed: ${e.message}`;
          }
        },
      },

      laptop_run: {
        description:
          "Run a command on the remote machine. Example: { command: 'cd ~/project && bun run dev' }",
        execute: async ({ command }: { command: string }) => {
          try {
            const output = ssh(
              `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && export PATH="$HOME/.bun/bin:$PATH" && ${command}`
            );
            return output;
          } catch (e: any) {
            return `Command failed: ${e.stderr || e.message}`;
          }
        },
      },

      laptop_fetch: {
        description:
          "Fetch a webpage from the remote machine and save HTML locally. Example: { url: 'http://localhost:5173' }",
        execute: async ({ url }: { url: string }) => {
          try {
            ssh(
              `export PATH="$HOME/.local/bin:$PATH" && lightpanda fetch --dump html ${url} > /tmp/fetched-page.html 2>/dev/null`
            );
            const timestamp = Date.now();
            const localPath = `./fetched-page-${timestamp}.html`;
            scp("/tmp/fetched-page.html", localPath);
            return `Page saved as ${localPath}`;
          } catch (e: any) {
            return `Fetch failed: ${e.message}`;
          }
        },
      },

      laptop_dev: {
        description:
          "Start the dev server on the remote machine in background",
        execute: async () => {
          try {
            ssh(
              `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && export PATH="$HOME/.bun/bin:$PATH" && cd ${REMOTE_DIR} && bun install && nohup bun run dev --host 0.0.0.0 > /tmp/dev-server.log 2>&1 &`
            );
            // Wait for server to start
            await new Promise((r) => setTimeout(r, 3000));
            const status = ssh(
              `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_PORT} || echo "not ready"`
            );
            return `Dev server started on http://${REMOTE_HOST.split("@")[1]}:${DEV_PORT} (status: ${status})`;
          } catch (e: any) {
            return `Failed to start dev server: ${e.message}`;
          }
        },
      },

      laptop_stop: {
        description: "Stop the dev server on the remote machine",
        execute: async () => {
          try {
            ssh("pkill -f 'vite' 2>/dev/null || true");
            return "Dev server stopped";
          } catch (e: any) {
            return `Stop failed: ${e.message}`;
          }
        },
      },

      laptop_status: {
        description: "Check if the dev server is running on the remote machine",
        execute: async () => {
          try {
            const status = ssh(
              `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_PORT} 2>/dev/null || echo "not running"`
            );
            const hostname = ssh("hostname");
            const uptime = ssh("uptime -p");
            return `Host: ${hostname.trim()}\nUptime: ${uptime.trim()}\nDev server: ${status.trim() === "200" ? "running" : "not running"}`;
          } catch (e: any) {
            return `Status check failed: ${e.message}`;
          }
        },
      },

      laptop_screenshot: {
        description:
          "Take a screenshot of the running app on the remote machine. Returns the local path to the screenshot image. Example: { url: 'http://localhost:5173' }",
        execute: async ({ url }: { url: string }) => {
          try {
            const timestamp = Date.now();
            const remotePath = `/tmp/screenshot-${timestamp}.png`;
            const localPath = `./screenshot-${timestamp}.png`;

            ssh(
              `export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run screenshot.mjs ${url} ${remotePath}`
            );
            scp(remotePath, localPath);

            return `Screenshot saved as ${localPath}`;
          } catch (e: any) {
            return `Screenshot failed: ${e.message}`;
          }
        },
      },

      laptop_logs: {
        description:
          "Tail the dev server logs on the remote machine. Example: { lines: 100 }",
        execute: async ({ lines = 50 }: { lines?: number }) => {
          try {
            const output = ssh(
              `tail -${lines} /tmp/dev-server.log 2>/dev/null || echo "No logs found"`
            );
            return output;
          } catch (e: any) {
            return `Failed to fetch logs: ${e.message}`;
          }
        },
      },

      laptop_tunnel: {
        description:
          "Create SSH tunnel to access a remote port locally. Example: { localPort: 8080, remotePort: 3000 }",
        execute: async ({
          localPort,
          remotePort,
        }: {
          localPort: number;
          remotePort: number;
        }) => {
          try {
            const { spawn } = require("child_process");
            const tunnel = spawn(
              "ssh",
              [
                ...SSH_OPTS.split(" "),
                "-L",
                `${localPort}:localhost:${remotePort}`,
                REMOTE_HOST,
                "-N",
              ],
              { detached: true, stdio: "ignore" }
            );
            tunnel.unref();
            return `Tunnel active: localhost:${localPort} → remote:${remotePort} (PID: ${tunnel.pid})`;
          } catch (e: any) {
            return `Tunnel failed: ${e.message}`;
          }
        },
      },

      laptop_exec: {
        description:
          "Execute a command on the remote machine with extended timeout and full output. Example: { command: 'bun run build', timeout: 120000 }",
        execute: async ({
          command,
          timeout = 60000,
        }: {
          command: string;
          timeout?: number;
        }) => {
          try {
            const output = execSync(
              `ssh ${SSH_OPTS} ${REMOTE_HOST} "export NVM_DIR=\\$HOME/.nvm && [ -s \\\"\\$NVM_DIR/nvm.sh\\\" ] && . \\\"\\$NVM_DIR/nvm.sh\\\" && export PATH=\\\"\\$HOME/.bun/bin:\\$PATH\\\" && ${command}"`,
              { encoding: "utf-8", timeout }
            );
            return output;
          } catch (e: any) {
            return `Command failed: ${e.stderr || e.message}`;
          }
        },
      },

      laptop_browser: {
        description:
          "Take screenshots of multiple pages on the remote machine. Example: { url: 'http://localhost:5173', pages: ['/', '/about', '/contact'] }",
        execute: async ({
          url,
          pages,
        }: {
          url: string;
          pages: string[];
        }) => {
          try {
            const timestamp = Date.now();
            const script = `
              import puppeteer from "puppeteer";
              const browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
              });
              const page = await browser.newPage();
              await page.setViewport({ width: 1920, height: 1080 });
              const results = [];
              for (const p of ${JSON.stringify(pages)}) {
                const fullUrl = p.startsWith("http") ? p : "${url}" + p;
                await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                const name = p.replace(/[^a-zA-Z0-9]/g, "_") || "index";
                const path = "/tmp/page-" + name + "-${timestamp}.png";
                await page.screenshot({ path, fullPage: false });
                results.push({ page: p, path });
              }
              await browser.close();
              console.log(JSON.stringify(results));
            `;
            const remoteScript = `/tmp/browser-script-${timestamp}.mjs`;
            execSync(
              `ssh ${SSH_OPTS} ${REMOTE_HOST} "cat > ${remoteScript}"`,
              { input: script, encoding: "utf-8" }
            );
            const output = ssh(
              `export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run ${remoteScript}`
            );
            const results = JSON.parse(output.trim());
            const localPaths: string[] = [];
            for (const r of results) {
              const localPath = `./${r.path.split("/").pop()}`;
              scp(r.path, localPath);
              localPaths.push(localPath);
            }
            return `Screenshots saved: ${localPaths.join(", ")}`;
          } catch (e: any) {
            return `Browser screenshots failed: ${e.message}`;
          }
        },
      },

      laptop_perf: {
        description:
          "Run Lighthouse performance audit on a URL. Example: { url: 'http://localhost:3000' }",
        execute: async ({ url }: { url: string }) => {
          try {
            ssh(
              `export PATH="$HOME/.bun/bin:$PATH" && which lighthouse >/dev/null 2>&1 || npm install -g lighthouse`
            );
            const timestamp = Date.now();
            const reportPath = `/tmp/lighthouse-${timestamp}.json`;
            ssh(
              `lighthouse ${url} --output=json --output-path=${reportPath} --chrome-flags="--headless --no-sandbox" --quiet 2>/dev/null`
            );
            const localPath = `./lighthouse-${timestamp}.json`;
            scp(reportPath, localPath);

            const report = JSON.parse(
              require("fs").readFileSync(localPath, "utf-8")
            );
            const scores = {
              performance: Math.round(
                report.categories.performance.score * 100
              ),
              accessibility: Math.round(
                report.categories.accessibility.score * 100
              ),
              "best-practices": Math.round(
                report.categories["best-practices"].score * 100
              ),
              seo: Math.round(report.categories.seo.score * 100),
            };
            return `Lighthouse scores:\n${JSON.stringify(scores, null, 2)}\nFull report: ${localPath}`;
          } catch (e: any) {
            return `Lighthouse failed: ${e.message}`;
          }
        },
      },

      laptop_docker: {
        description:
          "Docker compose operations on the remote machine. Example: { action: 'up', service: 'web' }",
        execute: async ({
          action,
          service,
        }: {
          action: "up" | "down" | "status" | "logs";
          service?: string;
        }) => {
          try {
            let cmd = "";
            switch (action) {
              case "up":
                cmd = `cd ${REMOTE_DIR} && docker compose up -d ${service || ""}`;
                break;
              case "down":
                cmd = `cd ${REMOTE_DIR} && docker compose down ${service || ""}`;
                break;
              case "status":
                cmd = `cd ${REMOTE_DIR} && docker compose ps`;
                break;
              case "logs":
                cmd = `cd ${REMOTE_DIR} && docker compose logs ${service || ""} --tail=50`;
                break;
              default:
                return `Unknown action: ${action}`;
            }
            const output = ssh(cmd);
            return output;
          } catch (e: any) {
            return `Docker command failed: ${e.message}`;
          }
        },
      },

      laptop_watch: {
        description:
          "Watch local files and auto-sync to remote on changes. Example: { action: 'start', interval: 5 }",
        execute: async ({
          action,
          interval = 5,
        }: {
          action: "start" | "stop" | "status";
          interval?: number;
        }) => {
          try {
            const { spawn } = require("child_process");
            const watchScript = `
              const chokidar = require("chokidar");
              const { execSync } = require("child_process");
              const watcher = chokidar.watch("${PROJECT_DIR}", {
                ignored: /node_modules|\\.git|dist/,
                persistent: true,
              });
              let syncing = false;
              watcher.on("change", (path) => {
                if (!syncing) {
                  syncing = true;
                  console.log("Change detected:", path);
                  try {
                    execSync("rsync -avz --delete --exclude node_modules --exclude .git --exclude dist ${PROJECT_DIR}/ ${REMOTE_HOST}:${REMOTE_DIR}/", { encoding: "utf-8" });
                    console.log("Sync complete");
                  } catch (e) { console.error("Sync failed:", e.message); }
                  syncing = false;
                }
              });
              console.log("Watcher started on ${PROJECT_DIR}");
            `;
            const pidFile = `~/.remote-dev-watch.pid`;
            if (action === "start") {
              execSync(
                `ssh ${SSH_OPTS} ${REMOTE_HOST} "echo '${watchScript}' > /tmp/watcher.js && nohup node /tmp/watcher.js > /tmp/watcher.log 2>&1 & echo \\$! > ${pidFile}"`
              );
              const pid = ssh(`cat ${pidFile}`);
              return `File watcher started (PID: ${pid.trim()})`;
            } else if (action === "stop") {
              ssh(`kill \\$(cat ${pidFile}) 2>/dev/null || true`);
              return "File watcher stopped";
            } else {
              const pid = ssh(`cat ${pidFile} 2>/dev/null || echo "not running"`);
              return `Watcher: ${pid.trim() === "not running" ? "not running" : "running (PID: " + pid.trim() + ")"}`;
            }
          } catch (e: any) {
            return `Watch command failed: ${e.message}`;
          }
        },
      },

      laptop_hosts: {
        description:
          "List available remote hosts or switch active host. Example: { action: 'list' } or { action: 'switch', host: 'user@vps.example.com' }",
        execute: async ({
          action,
          host,
        }: {
          action: "list" | "switch" | "current";
          host?: string;
        }) => {
          try {
            const hostsFile = `${require("os").homedir()}/.remote-dev-hosts.json`;
            if (action === "list") {
              try {
                const hosts = JSON.parse(readFileSync(hostsFile, "utf-8"));
                return JSON.stringify(hosts, null, 2);
              } catch {
                return "No hosts configured. Use 'switch' to add one.";
              }
            } else if (action === "switch" && host) {
              let hosts: Record<string, string> = {};
              try {
                hosts = JSON.parse(readFileSync(hostsFile, "utf-8"));
              } catch {}
              hosts["active"] = host;
              writeFileSync(hostsFile, JSON.stringify(hosts, null, 2));
              return `Active host set to: ${host}`;
            } else if (action === "current") {
              try {
                const hosts = JSON.parse(readFileSync(hostsFile, "utf-8"));
                return `Active host: ${hosts.active || "none"}`;
              } catch {
                return "No hosts configured.";
              }
            }
            return "Invalid action";
          } catch (e: any) {
            return `Host command failed: ${e.message}`;
          }
        },
      },

      laptop_profile: {
        description:
          "Manage dev server profiles for different projects. Example: { action: 'save', name: 'web-app', port: 5173, command: 'bun run dev' }",
        execute: async ({
          action,
          name,
          port,
          command,
        }: {
          action: "save" | "load" | "list" | "delete";
          name?: string;
          port?: number;
          command?: string;
        }) => {
          try {
            const profilesFile = `${require("os").homedir()}/.remote-dev-profiles.json`;
            let profiles: Record<string, any> = {};
            try {
              profiles = JSON.parse(readFileSync(profilesFile, "utf-8"));
            } catch {}
            if (action === "save" && name) {
              profiles[name] = { port: port || 5173, command: command || "bun run dev" };
              writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
              return `Profile '${name}' saved`;
            } else if (action === "load" && name) {
              const profile = profiles[name];
              if (!profile) return `Profile '${name}' not found`;
              return `Profile '${name}': port=${profile.port}, command=${profile.command}`;
            } else if (action === "list") {
              return JSON.stringify(profiles, null, 2);
            } else if (action === "delete" && name) {
              delete profiles[name];
              writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
              return `Profile '${name}' deleted`;
            }
            return "Invalid action";
          } catch (e: any) {
            return `Profile command failed: ${e.message}`;
          }
        },
      },

      laptop_gallery: {
        description:
          "Save and compare screenshots over time. Example: { action: 'save', name: 'homepage' } or { action: 'compare', name: 'homepage' }",
        execute: async ({
          action,
          name,
          url = "http://localhost:5173",
        }: {
          action: "save" | "compare" | "list" | "diff";
          name?: string;
          url?: string;
        }) => {
          try {
            const galleryDir = `${require("os").homedir()}/.remote-dev-gallery`;
            const { mkdirSync } = require("fs");
            mkdirSync(galleryDir, { recursive: true });
            if (action === "save" && name) {
              const timestamp = Date.now();
              const remotePath = `/tmp/screenshot-${timestamp}.png`;
              const localPath = `${galleryDir}/${name}-${timestamp}.png`;
              ssh(
                `export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run screenshot.mjs ${url} ${remotePath}`
              );
              scp(remotePath, localPath);
              return `Screenshot saved as ${name}-${timestamp}.png`;
            } else if (action === "list") {
              const { readdirSync } = require("fs");
              const files = readdirSync(galleryDir).filter((f: string) => f.endsWith(".png"));
              return `Gallery (${files.length} screenshots):\n${files.join("\n")}`;
            } else if (action === "compare" && name) {
              const { readdirSync } = require("fs");
              const files = readdirSync(galleryDir)
                .filter((f: string) => f.startsWith(name + "-"))
                .sort()
                .slice(-2);
              if (files.length < 2) return "Need at least 2 screenshots to compare";
              return `Comparing:\n1. ${files[0]}\n2. ${files[1]}\nOpen both images to compare.`;
            } else if (action === "diff" && name) {
              const { readdirSync } = require("fs");
              const files = readdirSync(galleryDir)
                .filter((f: string) => f.startsWith(name + "-"))
                .sort()
                .slice(-2);
              if (files.length < 2) return "Need at least 2 screenshots for diff";
              const timestamp = Date.now();
              const diffScript = `
                import { PNG } from "pngjs";
                import fs from "fs";
                const img1 = PNG.sync.read(fs.readFileSync("${galleryDir}/${files[0]}"));
                const img2 = PNG.sync.read(fs.readFileSync("${galleryDir}/${files[1]}"));
                const diff = new PNG({ width: img1.width, height: img1.height });
                let changes = 0;
                for (let y = 0; y < img1.height; y++) {
                  for (let x = 0; x < img1.width; x++) {
                    const idx = (y * img1.width + x) * 4;
                    const r = Math.abs(img1.data[idx] - img2.data[idx]);
                    const g = Math.abs(img1.data[idx + 1] - img2.data[idx + 1]);
                    const b = Math.abs(img1.data[idx + 2] - img2.data[idx + 2]);
                    if (r + g + b > 50) { diff.data[idx] = 255; diff.data[idx + 1] = 0; diff.data[idx + 2] = 0; changes++; }
                    else { diff.data[idx] = img1.data[idx]; diff.data[idx + 1] = img1.data[idx + 1]; diff.data[idx + 2] = img1.data[idx + 2]; }
                    diff.data[idx + 3] = 255;
                  }
                }
                fs.writeFileSync("/tmp/diff-${timestamp}.png", PNG.sync.write(diff));
                console.log(JSON.stringify({ changes, totalPixels: img1.width * img1.height }));
              `;
              const remoteScript = `/tmp/diff-script-${timestamp}.mjs`;
              execSync(
                `ssh ${SSH_OPTS} ${REMOTE_HOST} "cat > ${remoteScript}"`,
                { input: diffScript, encoding: "utf-8" }
              );
              ssh(`export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run ${remoteScript}`);
              const diffPath = `${galleryDir}/${name}-diff-${timestamp}.png`;
              scp(`/tmp/diff-${timestamp}.png`, diffPath);
              return `Diff saved as ${name}-diff-${timestamp}.png`;
            }
            return "Invalid action";
          } catch (e: any) {
            return `Gallery command failed: ${e.message}`;
          }
        },
      },

      laptop_git: {
        description:
          "Git operations on the remote machine. Example: { action: 'status' } or { action: 'push', message: 'fix: bug' }",
        execute: async ({
          action,
          message,
          branch,
        }: {
          action: "status" | "pull" | "commit" | "push" | "log" | "diff";
          message?: string;
          branch?: string;
        }) => {
          try {
            let cmd = "";
            switch (action) {
              case "status":
                cmd = `cd ${REMOTE_DIR} && git status`;
                break;
              case "pull":
                cmd = `cd ${REMOTE_DIR} && git pull origin ${branch || "main"}`;
                break;
              case "commit":
                if (!message) return "Commit message required";
                cmd = `cd ${REMOTE_DIR} && git add -A && git commit -m "${message}"`;
                break;
              case "push":
                cmd = `cd ${REMOTE_DIR} && git push origin ${branch || "main"}`;
                break;
              case "log":
                cmd = `cd ${REMOTE_DIR} && git log --oneline -10`;
                break;
              case "diff":
                cmd = `cd ${REMOTE_DIR} && git diff --stat`;
                break;
              default:
                return `Unknown action: ${action}`;
            }
            const output = ssh(cmd);
            return output;
          } catch (e: any) {
            return `Git command failed: ${e.message}`;
          }
        },
      },

      laptop_health: {
        description:
          "Check if all remote dev tools are installed and working. No parameters needed.",
        execute: async () => {
          try {
            const checks: string[] = [];
            // SSH
            try {
              ssh("echo ok");
              checks.push("SSH: OK");
            } catch {
              checks.push("SSH: FAILED");
            }
            // Node
            try {
              const node = ssh("node --version 2>/dev/null || echo not found");
              checks.push(`Node: ${node.trim()}`);
            } catch {
              checks.push("Node: NOT FOUND");
            }
            // Bun
            try {
              const bun = ssh(
                'export PATH="$HOME/.bun/bin:$PATH" && bun --version 2>/dev/null || echo not found'
              );
              checks.push(`Bun: ${bun.trim()}`);
            } catch {
              checks.push("Bun: NOT FOUND");
            }
            // Puppeteer
            try {
              const puppeteer = ssh(
                'export PATH="$HOME/.bun/bin:$PATH" && cd ~/screenshot-tool && bun run -e "console.log(require(\"puppeteer\").version)" 2>/dev/null || echo not found'
              );
              checks.push(`Puppeteer: ${puppeteer.trim()}`);
            } catch {
              checks.push("Puppeteer: NOT FOUND");
            }
            // Docker
            try {
              const docker = ssh("docker --version 2>/dev/null || echo not found");
              checks.push(`Docker: ${docker.trim()}`);
            } catch {
              checks.push("Docker: NOT FOUND");
            }
            // Git
            try {
              const git = ssh("git --version 2>/dev/null || echo not found");
              checks.push(`Git: ${git.trim()}`);
            } catch {
              checks.push("Git: NOT FOUND");
            }
            // Disk space
            try {
              const disk = ssh("df -h / | tail -1 | awk '{print $4}'");
              checks.push(`Disk free: ${disk.trim()}`);
            } catch {
              checks.push("Disk: UNKNOWN");
            }
            // Memory
            try {
              const mem = ssh("free -h | grep Mem | awk '{print $4}'");
              checks.push(`RAM free: ${mem.trim()}`);
            } catch {
              checks.push("Memory: UNKNOWN");
            }
            return checks.join("\n");
          } catch (e: any) {
            return `Health check failed: ${e.message}`;
          }
        },
      },

      laptop_setup: {
        description:
          "Interactive setup wizard for a new remote machine. Example: { host: 'user@192.168.1.100', keyPath: '/path/to/key' }",
        execute: async ({
          host,
          keyPath,
        }: {
          host: string;
          keyPath: string;
        }) => {
          try {
            const steps: string[] = [];
            // Test SSH
            steps.push("Testing SSH connection...");
            try {
              execSync(
                `ssh -i ${keyPath} -o StrictHostKeyChecking=no ${host} "echo ok"`,
                { encoding: "utf-8", timeout: 10000 }
              );
              steps.push("  SSH: OK");
            } catch {
              return "SSH connection failed. Check host and key.";
            }
            // Install Node
            steps.push("Installing Node.js via nvm...");
            sshWith(host, keyPath, `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash 2>/dev/null`);
            sshWith(host, keyPath, `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm install 22`);
            steps.push("  Node: installed");
            // Install Bun
            steps.push("Installing Bun...");
            sshWith(host, keyPath, `curl -fsSL https://bun.sh/install | bash 2>/dev/null`);
            steps.push("  Bun: installed");
            // Setup Puppeteer
            steps.push("Setting up Puppeteer...");
            sshWith(host, keyPath, `mkdir -p ~/screenshot-tool && cd ~/screenshot-tool && bun init -y && bun add puppeteer`);
            // Create screenshot script
            const screenshotScript = `import puppeteer from "puppeteer";
const url = process.argv[2] || "http://localhost:5173";
const outputPath = process.argv[3] || "/tmp/screenshot.png";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.screenshot({ path: outputPath, fullPage: false });
await browser.close();
console.log("Screenshot saved to " + outputPath);`;
            execSync(
              `ssh -i ${keyPath} ${host} "echo '${screenshotScript}' > ~/screenshot-tool/screenshot.mjs"`,
              { encoding: "utf-8" }
            );
            steps.push("  Puppeteer: ready");
            // Install Docker (optional)
            steps.push("Checking Docker...");
            try {
              sshWith(host, keyPath, `docker --version`);
              steps.push("  Docker: already installed");
            } catch {
              steps.push("  Docker: not installed (optional)");
            }
            // Install Git
            steps.push("Checking Git...");
            try {
              sshWith(host, keyPath, `git --version`);
              steps.push("  Git: already installed");
            } catch {
              sshWith(host, keyPath, `apt-get update && apt-get install -y git`);
              steps.push("  Git: installed");
            }
            return steps.join("\n");
          } catch (e: any) {
            return `Setup failed: ${e.message}`;
          }
        },
      },

      laptop_recover: {
        description:
          "Auto-recover crashed dev server. Example: { action: 'check' } or { action: 'restart' }",
        execute: async ({
          action,
        }: {
          action: "check" | "restart" | "watch";
        }) => {
          try {
            if (action === "check") {
              const status = ssh(
                `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_PORT} 2>/dev/null || echo "not running"`
              );
              if (status.trim() === "200") {
                return "Dev server is running";
              } else {
                return "Dev server is NOT running";
              }
            } else if (action === "restart") {
              ssh("pkill -f 'vite' 2>/dev/null || true");
              await new Promise((r) => setTimeout(r, 1000));
              ssh(
                `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && export PATH="$HOME/.bun/bin:$PATH" && cd ${REMOTE_DIR} && nohup bun run dev --host 0.0.0.0 > /tmp/dev-server.log 2>&1 &`
              );
              await new Promise((r) => setTimeout(r, 3000));
              const status = ssh(
                `curl -s -o /dev/null -w "%{http_code}" http://localhost:${DEV_PORT} || echo "not ready"`
              );
              return `Dev server restarted (status: ${status})`;
            } else if (action === "watch") {
              const watchScript = `
                setInterval(() => {
                  const http = require("http");
                  http.get("http://localhost:${DEV_PORT}", (res) => {
                    if (res.statusCode !== 200) {
                      console.log("Server down, restarting...");
                      require("child_process").execSync("pkill -f 'vite' 2>/dev/null || true");
                      require("child_process").execSync("cd ${REMOTE_DIR} && nohup bun run dev --host 0.0.0.0 > /tmp/dev-server.log 2>&1 &");
                    }
                  }).on("error", () => {
                    console.log("Server unreachable, restarting...");
                    require("child_process").execSync("cd ${REMOTE_DIR} && nohup bun run dev --host 0.0.0.0 > /tmp/dev-server.log 2>&1 &");
                  });
                }, 30000);
              `;
              ssh(
                `nohup node -e '${watchScript.replace(/'/g, "'\\''")}' > /tmp/watchdog.log 2>&1 &`
              );
              return "Watchdog started (checks every 30s)";
            }
            return "Invalid action";
          } catch (e: any) {
            return `Recovery failed: ${e.message}`;
          }
        },
      },
    },
  };
};

function sshWith(host: string, key: string, cmd: string): string {
  return execSync(`ssh -i ${key} -o StrictHostKeyChecking=no ${host} "${cmd}"`, {
    encoding: "utf-8",
    timeout: 60000,
  });
}
