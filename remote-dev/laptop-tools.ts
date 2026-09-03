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
    },
  };
};
