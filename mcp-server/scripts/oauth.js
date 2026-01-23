#!/usr/bin/env node

import { google } from "googleapis";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as http from "http";
import { URL } from "url";
import { exec } from "child_process";
import * as readline from "readline";

const CONFIG_DIR = join(homedir(), ".gtm-mcp");
const OAUTH2_CREDENTIALS_PATH = join(CONFIG_DIR, "oauth2-credentials.json");
const OAUTH2_TOKEN_PATH = join(CONFIG_DIR, "oauth2-token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  "https://www.googleapis.com/auth/tagmanager.manage.accounts",
  "https://www.googleapis.com/auth/tagmanager.manage.users",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

function loadOAuth2Credentials() {
  if (existsSync(OAUTH2_CREDENTIALS_PATH)) {
    try {
      const content = readFileSync(OAUTH2_CREDENTIALS_PATH, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to load OAuth2 credentials:", error.message);
    }
  }
  return null;
}

function saveOAuth2Token(token) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(OAUTH2_TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function setupOAuth2Credentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log("\n=== GTM MCP OAuth2 Setup ===\n");
  console.log("To use OAuth2 authentication, you need to create OAuth2 credentials:\n");
  console.log("1. Go to Google Cloud Console: https://console.cloud.google.com/");
  console.log("2. Select your project (or create a new one)");
  console.log("3. Enable the Tag Manager API:");
  console.log("   - APIs & Services > Library > Search 'Tag Manager API' > Enable");
  console.log("4. Create OAuth2 credentials:");
  console.log("   - APIs & Services > Credentials > Create Credentials > OAuth client ID");
  console.log("   - Application type: Desktop app");
  console.log("   - Download the JSON file\n");

  const credPath = await question("Enter the path to your OAuth2 credentials JSON file: ");
  rl.close();

  const trimmedPath = credPath.trim().replace(/^["']|["']$/g, "");

  if (!existsSync(trimmedPath)) {
    console.error(`\nFile not found: ${trimmedPath}`);
    process.exit(1);
  }

  try {
    const content = readFileSync(trimmedPath, "utf-8");
    const creds = JSON.parse(content);

    if (!creds.installed && !creds.web) {
      console.error("\nInvalid OAuth2 credentials format. Expected 'installed' or 'web' client type.");
      process.exit(1);
    }

    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(OAUTH2_CREDENTIALS_PATH, content);
    console.log(`\nOAuth2 credentials saved to ${OAUTH2_CREDENTIALS_PATH}`);
    return creds;
  } catch (error) {
    console.error("\nFailed to read credentials file:", error.message);
    process.exit(1);
  }
}

async function performOAuth2Flow(credentials) {
  const clientConfig = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n=== OAuth2 Authentication ===\n");
  console.log("Opening browser for authentication...\n");
  console.log("If browser doesn't open automatically, visit this URL:\n");
  console.log(authUrl);
  console.log("\nWaiting for authorization...\n");

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      if (req.url?.startsWith("/oauth2callback")) {
        const url = new URL(req.url, "http://localhost:3000");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>Authentication Failed</h1><p>Error: ${error}</p>`);
          server.close();
          resolve(false);
          return;
        }

        if (code) {
          try {
            const { tokens } = await oauth2Client.getToken(code);
            const token = {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              scope: tokens.scope,
              token_type: tokens.token_type,
              expiry_date: tokens.expiry_date,
            };
            saveOAuth2Token(token);

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><title>GTM MCP Authentication</title></head>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
              </html>
            `);

            console.log("Authentication successful!");
            console.log(`Token saved to ${OAUTH2_TOKEN_PATH}`);
            console.log("\nYou can now use GTM MCP Server with OAuth2 authentication.");
            server.close();
            resolve(true);
          } catch (err) {
            res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<h1>Token Exchange Failed</h1><p>${err.message}</p>`);
            console.error("Token exchange failed:", err.message);
            server.close();
            resolve(false);
          }
        }
      }
    });

    server.listen(3000, () => {
      // Try to open browser
      const openCommand =
        process.platform === "win32"
          ? "start"
          : process.platform === "darwin"
          ? "open"
          : "xdg-open";
      exec(`${openCommand} "${authUrl}"`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error("\nAuthentication timed out after 5 minutes.");
      server.close();
      resolve(false);
    }, 5 * 60 * 1000);
  });
}

async function main() {
  console.log("\n=== GTM MCP OAuth2 Setup ===\n");

  // Check for existing credentials
  let credentials = loadOAuth2Credentials();

  if (!credentials) {
    console.log("No OAuth2 credentials found.\n");
    credentials = await setupOAuth2Credentials();
  } else {
    console.log(`Using existing credentials from ${OAUTH2_CREDENTIALS_PATH}\n`);
  }

  // Check for existing token
  if (existsSync(OAUTH2_TOKEN_PATH)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) =>
      rl.question("Existing token found. Re-authenticate? (y/N): ", resolve)
    );
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log("\nUsing existing token. Run 'gtm-mcp-oauth' again to re-authenticate.");
      process.exit(0);
    }
  }

  // Perform OAuth2 flow
  const success = await performOAuth2Flow(credentials);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
