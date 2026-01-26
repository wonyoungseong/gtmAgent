import { google } from "googleapis";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import { URL } from "url";
import { execSync } from "child_process";

type TagManagerClient = ReturnType<typeof google.tagmanager>;

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

interface OAuth2Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface OAuth2Token {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

interface AccessTokenData {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  client_id?: string;
  client_secret?: string;
}

// Get the directory where this module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", ".."); // mcp-server root
const credentialFolder = join(projectRoot, "..", "Credential"); // ../Credential folder

// GTM MCP config directory
const CONFIG_DIR = join(homedir(), ".gtm-mcp");
const SERVICE_ACCOUNT_PATH = join(CONFIG_DIR, "credentials.json");
const OAUTH2_CREDENTIALS_PATH = join(CONFIG_DIR, "oauth2-credentials.json");
const OAUTH2_TOKEN_PATH = join(CONFIG_DIR, "oauth2-token.json");
const ACCESS_TOKEN_PATH = join(CONFIG_DIR, "access-token.txt");
const ACCESS_TOKEN_JSON_PATH = join(CONFIG_DIR, "access-token.json");

// OAuth2 Scopes
const SCOPES = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  "https://www.googleapis.com/auth/tagmanager.manage.accounts",
  "https://www.googleapis.com/auth/tagmanager.manage.users",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

// Token expiry buffer (refresh 5 minutes before expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// Environment variable to enable gcloud CLI auth (default: disabled)
// Set GTM_USE_GCLOUD=true to enable gcloud auth
const USE_GCLOUD = process.env.GTM_USE_GCLOUD === 'true';

// Singleton state
let cachedClient: TagManagerClient | null = null;
let cachedCredentials: ServiceAccountCredentials | null = null;
let cachedAccessTokenData: AccessTokenData | null = null;
let authType: "gcloud" | "service-account" | "oauth2" | "access-token" | null = null;
let lastValidationTime: number = 0;

// ==================== Utility Functions ====================

function findCredentialInFolder(folderPath: string): string | null {
  try {
    if (!existsSync(folderPath)) return null;
    const files = readdirSync(folderPath);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (jsonFile) {
      return join(folderPath, jsonFile);
    }
  } catch {
    // Folder doesn't exist or not readable
  }
  return null;
}

// Service Account credential paths to check (in priority order)
const CREDENTIAL_PATHS = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  SERVICE_ACCOUNT_PATH,
  findCredentialInFolder(credentialFolder),
  join(process.cwd(), "service-account.json"),
  join(process.cwd(), "credentials.json"),
  join(homedir(), ".config", "gtm-mcp", "service-account.json"),
];

function findCredentialsFile(): string | null {
  for (const path of CREDENTIAL_PATHS) {
    if (path && existsSync(path)) {
      return path;
    }
  }
  return null;
}

// ==================== Token Validation ====================

/**
 * Check if token needs refresh (expired or near expiry)
 */
function isTokenExpiredOrNearExpiry(expiryDate?: number): boolean {
  if (!expiryDate) return false; // No expiry means we can't check
  return Date.now() > (expiryDate - TOKEN_EXPIRY_BUFFER_MS);
}

/**
 * Validate and refresh access token if needed
 * Returns refreshed token data or null if refresh failed
 */
async function validateAndRefreshToken(tokenData: AccessTokenData): Promise<AccessTokenData | null> {
  const hasRefreshCapability = tokenData.refresh_token && tokenData.client_id && tokenData.client_secret;

  // If no expiry date, assume token is valid (can't check)
  if (!tokenData.expiry_date) {
    return tokenData;
  }

  // Check if token is still valid
  if (!isTokenExpiredOrNearExpiry(tokenData.expiry_date)) {
    return tokenData;
  }

  // Token expired or near expiry - need refresh
  if (!hasRefreshCapability) {
    console.error("[GTM MCP] Token expired and cannot be refreshed (missing refresh_token or client credentials)");
    return null;
  }

  console.error("[GTM MCP] Token expired or near expiry, refreshing...");

  try {
    const oauth2Client = new google.auth.OAuth2(
      tokenData.client_id,
      tokenData.client_secret
    );

    oauth2Client.setCredentials({
      refresh_token: tokenData.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const refreshedData: AccessTokenData = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || tokenData.refresh_token,
      expiry_date: credentials.expiry_date ?? undefined,
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
    };

    // Save refreshed token immediately
    saveAccessTokenData(refreshedData);
    console.error("[GTM MCP] Token refreshed and saved successfully");

    return refreshedData;
  } catch (error) {
    console.error(`[GTM MCP] Token refresh failed: ${error}`);
    return null;
  }
}

// ==================== Credential Loaders ====================

function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Try environment variable first (JSON string)
  const envCredentials = process.env.GTM_SERVICE_ACCOUNT_JSON;
  if (envCredentials) {
    try {
      cachedCredentials = JSON.parse(envCredentials);
      console.error("[GTM MCP] Loaded Service Account from environment variable");
      return cachedCredentials!;
    } catch {
      console.error("[GTM MCP] Invalid JSON in GTM_SERVICE_ACCOUNT_JSON");
    }
  }

  // Try file paths
  const credPath = findCredentialsFile();
  if (credPath) {
    try {
      const content = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.private_key && parsed.client_email) {
        cachedCredentials = parsed;
        console.error(`[GTM MCP] Loaded Service Account from ${credPath}`);
        return cachedCredentials!;
      }
    } catch (error) {
      console.error(`[GTM MCP] Failed to load credentials from ${credPath}: ${error}`);
    }
  }

  return null;
}

function loadOAuth2Credentials(): OAuth2Credentials | null {
  const envOAuth2 = process.env.GTM_OAUTH2_CREDENTIALS_JSON;
  if (envOAuth2) {
    try {
      return JSON.parse(envOAuth2);
    } catch {
      console.error("[GTM MCP] Invalid JSON in GTM_OAUTH2_CREDENTIALS_JSON");
    }
  }

  if (existsSync(OAUTH2_CREDENTIALS_PATH)) {
    try {
      const content = readFileSync(OAUTH2_CREDENTIALS_PATH, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`[GTM MCP] Failed to load OAuth2 credentials: ${error}`);
    }
  }

  return null;
}

function loadOAuth2Token(): OAuth2Token | null {
  if (existsSync(OAUTH2_TOKEN_PATH)) {
    try {
      const content = readFileSync(OAUTH2_TOKEN_PATH, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

function saveOAuth2Token(token: OAuth2Token): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(OAUTH2_TOKEN_PATH, JSON.stringify(token, null, 2));
  console.error(`[GTM MCP] OAuth2 token saved`);
}

/**
 * Load access token data from all possible sources
 * Priority: ENV JSON > ENV plain > JSON file > TXT file
 */
function loadAccessTokenData(): AccessTokenData | null {
  // Return cached if recently validated
  if (cachedAccessTokenData && Date.now() - lastValidationTime < 60000) {
    return cachedAccessTokenData;
  }

  let data: AccessTokenData | null = null;

  // 1. Environment variable - JSON format (highest priority)
  const envTokenJson = process.env.GTM_ACCESS_TOKEN_JSON;
  if (envTokenJson) {
    try {
      data = JSON.parse(envTokenJson);
      console.error("[GTM MCP] Loaded token from GTM_ACCESS_TOKEN_JSON");
    } catch {
      console.error("[GTM MCP] Invalid JSON in GTM_ACCESS_TOKEN_JSON");
    }
  }

  // 2. Environment variable - plain token
  if (!data) {
    const envToken = process.env.GTM_ACCESS_TOKEN;
    if (envToken) {
      data = { access_token: envToken.trim() };
      console.error("[GTM MCP] Loaded token from GTM_ACCESS_TOKEN (no refresh support)");
    }
  }

  // 3. JSON file (supports refresh)
  if (!data && existsSync(ACCESS_TOKEN_JSON_PATH)) {
    try {
      const content = readFileSync(ACCESS_TOKEN_JSON_PATH, "utf-8");
      data = JSON.parse(content);
      console.error(`[GTM MCP] Loaded token from ${ACCESS_TOKEN_JSON_PATH}`);
    } catch (error) {
      console.error(`[GTM MCP] Failed to load access token JSON: ${error}`);
    }
  }

  // 4. Plain text file (legacy)
  if (!data && existsSync(ACCESS_TOKEN_PATH)) {
    try {
      const token = readFileSync(ACCESS_TOKEN_PATH, "utf-8").trim();
      if (token) {
        data = { access_token: token };
        console.error(`[GTM MCP] Loaded token from ${ACCESS_TOKEN_PATH} (no refresh support)`);
      }
    } catch (error) {
      console.error(`[GTM MCP] Failed to load access token: ${error}`);
    }
  }

  cachedAccessTokenData = data;
  lastValidationTime = Date.now();
  return data;
}

// Legacy function for backward compatibility
function loadAccessToken(): string | null {
  const data = loadAccessTokenData();
  return data?.access_token || null;
}

export function saveAccessToken(token: string): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Save to both TXT and JSON for consistency
  // JSON has higher priority, so we must update it too
  writeFileSync(ACCESS_TOKEN_PATH, token.trim());

  const jsonData: AccessTokenData = { access_token: token.trim() };
  writeFileSync(ACCESS_TOKEN_JSON_PATH, JSON.stringify(jsonData, null, 2));

  clearCachedClient(); // Clear cache when token changes
  console.error(`[GTM MCP] Access token saved to both TXT and JSON files`);
}

export function saveAccessTokenData(data: AccessTokenData): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(ACCESS_TOKEN_JSON_PATH, JSON.stringify(data, null, 2));
  cachedAccessTokenData = data;
  lastValidationTime = Date.now();
  console.error(`[GTM MCP] Access token data saved`);
}

// ==================== gcloud CLI Authentication ====================

/**
 * Get access token from gcloud CLI
 * Requires: gcloud CLI installed and authenticated
 *
 * Priority:
 * 1. gcloud auth application-default print-access-token (has proper scopes)
 * 2. gcloud auth print-access-token (fallback, may lack scopes)
 */
async function getGcloudAccessToken(): Promise<string | null> {
  if (!USE_GCLOUD) {
    return null;
  }

  // On Windows, use gcloud.cmd; on Unix, use gcloud
  const gcloudBase = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';

  // Try user auth first (usually has broader access), then application-default
  const commands = [
    `${gcloudBase} auth print-access-token`,
    `${gcloudBase} auth application-default print-access-token`,
  ];

  for (const command of commands) {
    try {
      const token = execSync(command, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      // Google access tokens start with 'ya29.'
      if (token && token.startsWith('ya29.')) {
        return token;
      }
    } catch {
      // Try next command
      continue;
    }
  }

  return null;
}

/**
 * Create TagManager client using gcloud CLI token
 */
async function createGcloudClient(): Promise<TagManagerClient | null> {
  const token = await getGcloudAccessToken();
  if (!token) {
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const client = google.tagmanager({
      version: "v2",
      auth: oauth2Client,
    });

    authType = "gcloud";
    lastValidationTime = Date.now(); // Track when token was fetched
    console.error("[GTM MCP] Authenticated with gcloud CLI access token");
    return client;
  } catch (error) {
    console.error(`[GTM MCP] gcloud client creation failed: ${error}`);
    return null;
  }
}

// ==================== Client Creation ====================

async function createServiceAccountClient(): Promise<TagManagerClient | null> {
  const credentials = loadServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });

    await auth.authorize();

    const client = google.tagmanager({
      version: "v2",
      auth: auth,
    });

    authType = "service-account";
    console.error(`[GTM MCP] Authenticated as Service Account: ${credentials.client_email}`);
    return client;
  } catch (error) {
    console.error(`[GTM MCP] Service Account authentication failed: ${error}`);
    return null;
  }
}

async function createOAuth2Client(): Promise<TagManagerClient | null> {
  const credentials = loadOAuth2Credentials();
  if (!credentials) {
    return null;
  }

  const clientConfig = credentials.installed || credentials.web;
  if (!clientConfig) {
    console.error("[GTM MCP] Invalid OAuth2 credentials format");
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    "http://localhost:3000/oauth2callback"
  );

  let token = loadOAuth2Token();
  if (!token) {
    console.error("[GTM MCP] OAuth2 token not found. Run 'gtm-mcp-oauth' to authenticate.");
    return null;
  }

  // Validate and refresh if needed
  if (token.expiry_date && isTokenExpiredOrNearExpiry(token.expiry_date)) {
    if (token.refresh_token) {
      try {
        console.error("[GTM MCP] OAuth2 token expired, refreshing...");
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        token = {
          access_token: newCredentials.access_token!,
          refresh_token: newCredentials.refresh_token || token.refresh_token,
          scope: newCredentials.scope!,
          token_type: newCredentials.token_type!,
          expiry_date: newCredentials.expiry_date!,
        };
        saveOAuth2Token(token);
      } catch (error) {
        console.error(`[GTM MCP] OAuth2 token refresh failed: ${error}`);
        return null;
      }
    } else {
      console.error("[GTM MCP] OAuth2 token expired and no refresh_token available");
      return null;
    }
  }

  oauth2Client.setCredentials(token);

  const client = google.tagmanager({
    version: "v2",
    auth: oauth2Client,
  });

  authType = "oauth2";
  console.error("[GTM MCP] Authenticated with OAuth2");
  return client;
}

async function createAccessTokenClient(): Promise<TagManagerClient | null> {
  let tokenData = loadAccessTokenData();
  if (!tokenData) {
    return null;
  }

  // Validate and refresh token upfront
  tokenData = await validateAndRefreshToken(tokenData);
  if (!tokenData) {
    return null;
  }

  try {
    const hasRefreshCapability = tokenData.refresh_token && tokenData.client_id && tokenData.client_secret;
    let oauth2Client: InstanceType<typeof google.auth.OAuth2>;

    if (hasRefreshCapability) {
      oauth2Client = new google.auth.OAuth2(
        tokenData.client_id,
        tokenData.client_secret
      );

      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_date: tokenData.expiry_date,
      });

      // Set up automatic token refresh
      oauth2Client.on('tokens', (tokens) => {
        if (tokens.access_token) {
          const updatedData: AccessTokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || tokenData!.refresh_token,
            expiry_date: tokens.expiry_date ?? undefined,
            client_id: tokenData!.client_id,
            client_secret: tokenData!.client_secret,
          };
          saveAccessTokenData(updatedData);
          console.error("[GTM MCP] Token auto-refreshed and saved");
        }
      });

      console.error("[GTM MCP] Authenticated with access token (auto-refresh enabled)");
    } else {
      oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
      });
      console.error("[GTM MCP] Authenticated with access token (no auto-refresh)");
    }

    const client = google.tagmanager({
      version: "v2",
      auth: oauth2Client,
    });

    authType = "access-token";
    return client;
  } catch (error) {
    console.error(`[GTM MCP] Access token authentication failed: ${error}`);
    return null;
  }
}

// ==================== Main API ====================

/**
 * Get TagManager client with automatic token validation and refresh
 * This is the main entry point for getting an authenticated client
 */
export async function getTagManagerClient(): Promise<TagManagerClient> {
  // Check if cached client is still valid
  if (cachedClient) {
    // For gcloud auth, refresh token every 50 minutes (tokens expire in 1 hour)
    if (authType === "gcloud") {
      const gcloudRefreshInterval = 50 * 60 * 1000; // 50 minutes
      const needsRefresh = Date.now() - lastValidationTime > gcloudRefreshInterval;

      if (needsRefresh) {
        console.error("[GTM MCP] gcloud token refresh interval reached, recreating client...");
        cachedClient = null;
      }
    }

    // For access-token auth, validate token periodically
    if (authType === "access-token" && cachedAccessTokenData) {
      const needsRevalidation = Date.now() - lastValidationTime > 60000; // Revalidate every minute

      if (needsRevalidation && cachedAccessTokenData.expiry_date) {
        if (isTokenExpiredOrNearExpiry(cachedAccessTokenData.expiry_date)) {
          console.error("[GTM MCP] Cached client token expired, recreating...");
          cachedClient = null;
        }
      }
    }

    if (cachedClient) {
      return cachedClient;
    }
  }

  // 1. Try gcloud CLI (highest priority - most convenient for dev)
  cachedClient = await createGcloudClient();
  if (cachedClient) {
    return cachedClient;
  }

  // 2. Try Service Account
  cachedClient = await createServiceAccountClient();
  if (cachedClient) {
    return cachedClient;
  }

  // 3. Try OAuth2
  cachedClient = await createOAuth2Client();
  if (cachedClient) {
    return cachedClient;
  }

  // 4. Try Access Token
  cachedClient = await createAccessTokenClient();
  if (cachedClient) {
    return cachedClient;
  }

  throw new Error(
    "No valid credentials found. Please configure one of the following:\n\n" +
    "Option 1: gcloud CLI (Easiest for development)\n" +
    "  - Install gcloud CLI: https://cloud.google.com/sdk/docs/install\n" +
    "  - Run: gcloud auth login\n" +
    "  - Token is fetched automatically via 'gcloud auth print-access-token'\n" +
    "  - Set GTM_USE_GCLOUD=false to disable\n\n" +
    "Option 2: Service Account (Recommended for automation)\n" +
    "  - Run 'gtm-mcp-setup' to configure Service Account credentials\n\n" +
    "Option 3: OAuth2 (For personal use with refresh)\n" +
    "  - Place OAuth2 credentials at ~/.gtm-mcp/oauth2-credentials.json\n" +
    "  - Run 'gtm-mcp-oauth' to authenticate\n\n" +
    "Option 4: Access Token (Manual)\n" +
    "  - Save token JSON to ~/.gtm-mcp/access-token.json with format:\n" +
    "    { \"access_token\": \"...\", \"refresh_token\": \"...\", \"client_id\": \"...\", \"client_secret\": \"...\", \"expiry_date\": ... }\n"
  );
}

/**
 * Clear cached client and force re-authentication on next call
 */
export function clearCachedClient(): void {
  cachedClient = null;
  cachedAccessTokenData = null;
  authType = null;
  lastValidationTime = 0;
  console.error("[GTM MCP] Cached client cleared");
}

/**
 * Wrapper for API calls with automatic retry on auth failure
 */
export async function withAuthRetry<T>(
  operation: (client: TagManagerClient) => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const client = await getTagManagerClient();
      return await operation(client);
    } catch (error: any) {
      lastError = error;

      // Check if it's an auth error (401 or token-related)
      const isAuthError =
        error?.code === 401 ||
        error?.response?.status === 401 ||
        error?.message?.includes('invalid_grant') ||
        error?.message?.includes('Token has been expired') ||
        error?.message?.includes('Invalid Credentials');

      if (isAuthError && attempt < maxRetries) {
        console.error(`[GTM MCP] Auth error detected, clearing cache and retrying (attempt ${attempt + 1}/${maxRetries})...`);
        clearCachedClient();
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export function getCredentialsInfo(): { email: string; projectId: string; type: string } | null {
  // If already authenticated, return based on current auth type
  if (authType === "gcloud") {
    return {
      email: "gcloud CLI User",
      projectId: "gcloud",
      type: "gcloud",
    };
  }

  const saCredentials = loadServiceAccountCredentials();
  if (saCredentials) {
    return {
      email: saCredentials.client_email,
      projectId: saCredentials.project_id,
      type: "service-account",
    };
  }

  const oauth2Credentials = loadOAuth2Credentials();
  const oauth2Token = loadOAuth2Token();
  if (oauth2Credentials && oauth2Token) {
    const clientConfig = oauth2Credentials.installed || oauth2Credentials.web;
    return {
      email: "OAuth2 User",
      projectId: clientConfig?.client_id?.split("-")[0] || "unknown",
      type: "oauth2",
    };
  }

  const accessToken = loadAccessToken();
  if (accessToken) {
    return {
      email: "Developer Mode",
      projectId: "access-token",
      type: "access-token",
    };
  }

  return null;
}

export function getAuthType(): string | null {
  return authType;
}

// OAuth2 authorization flow (for CLI usage)
export async function performOAuth2Flow(): Promise<boolean> {
  const credentials = loadOAuth2Credentials();
  if (!credentials) {
    console.error("OAuth2 credentials not found at", OAUTH2_CREDENTIALS_PATH);
    console.error("\nTo set up OAuth2:");
    console.error("1. Go to Google Cloud Console > APIs & Services > Credentials");
    console.error("2. Create an OAuth 2.0 Client ID (Desktop app)");
    console.error("3. Download the JSON and save it to:", OAUTH2_CREDENTIALS_PATH);
    return false;
  }

  const clientConfig = credentials.installed || credentials.web;
  if (!clientConfig) {
    console.error("Invalid OAuth2 credentials format");
    return false;
  }

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

  console.log("\n=== GTM MCP OAuth2 Authentication ===\n");
  console.log("Opening browser for authentication...\n");
  console.log("If browser doesn't open, visit this URL:\n");
  console.log(authUrl);
  console.log("\nWaiting for authorization...\n");

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      if (req.url?.startsWith("/oauth2callback")) {
        const url = new URL(req.url, "http://localhost:3000");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Authentication Failed</h1><p>Error: ${error}</p>`);
          server.close();
          resolve(false);
          return;
        }

        if (code) {
          try {
            const { tokens } = await oauth2Client.getToken(code);
            const token: OAuth2Token = {
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token!,
              scope: tokens.scope!,
              token_type: tokens.token_type!,
              expiry_date: tokens.expiry_date!,
            };
            saveOAuth2Token(token);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <h1>Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            `);

            console.log("Authentication successful! Token saved.");
            server.close();
            resolve(true);
          } catch (err) {
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(`<h1>Token Exchange Failed</h1><p>${err}</p>`);
            server.close();
            resolve(false);
          }
        }
      }
    });

    server.listen(3000, () => {
      const openCommand = process.platform === "win32" ? "start" :
                         process.platform === "darwin" ? "open" : "xdg-open";
      import("child_process").then(({ exec }) => {
        exec(`${openCommand} "${authUrl}"`);
      });
    });

    setTimeout(() => {
      console.error("\nAuthentication timed out.");
      server.close();
      resolve(false);
    }, 5 * 60 * 1000);
  });
}

export { CONFIG_DIR, OAUTH2_CREDENTIALS_PATH, OAUTH2_TOKEN_PATH, SERVICE_ACCOUNT_PATH, ACCESS_TOKEN_PATH, ACCESS_TOKEN_JSON_PATH, SCOPES };
