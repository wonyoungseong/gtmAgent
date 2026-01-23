import { google } from "googleapis";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import { URL } from "url";
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
// OAuth2 Scopes
const SCOPES = [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.manage.accounts",
    "https://www.googleapis.com/auth/tagmanager.manage.users",
    "https://www.googleapis.com/auth/tagmanager.publish",
];
// Find first .json file in Credential folder
function findCredentialInFolder(folderPath) {
    try {
        if (!existsSync(folderPath))
            return null;
        const files = readdirSync(folderPath);
        const jsonFile = files.find(f => f.endsWith(".json"));
        if (jsonFile) {
            return join(folderPath, jsonFile);
        }
    }
    catch {
        // Folder doesn't exist or not readable
    }
    return null;
}
// Service Account credential paths to check (in priority order)
const CREDENTIAL_PATHS = [
    // 1. Environment variable (explicit path)
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // 2. GTM MCP config directory (setup by gtm-mcp-setup)
    SERVICE_ACCOUNT_PATH,
    // 3. Credential folder (development)
    findCredentialInFolder(credentialFolder),
    // 4. Current directory
    join(process.cwd(), "service-account.json"),
    join(process.cwd(), "credentials.json"),
    // 5. Legacy config directory
    join(homedir(), ".config", "gtm-mcp", "service-account.json"),
];
let cachedClient = null;
let cachedCredentials = null;
let authType = null;
function findCredentialsFile() {
    for (const path of CREDENTIAL_PATHS) {
        if (path && existsSync(path)) {
            return path;
        }
    }
    return null;
}
function loadServiceAccountCredentials() {
    if (cachedCredentials) {
        return cachedCredentials;
    }
    // Try environment variable first (JSON string)
    const envCredentials = process.env.GTM_SERVICE_ACCOUNT_JSON;
    if (envCredentials) {
        try {
            cachedCredentials = JSON.parse(envCredentials);
            console.error("[GTM MCP] Using credentials from GTM_SERVICE_ACCOUNT_JSON environment variable");
            return cachedCredentials;
        }
        catch {
            console.error("[GTM MCP] Invalid JSON in GTM_SERVICE_ACCOUNT_JSON environment variable");
        }
    }
    // Try file paths
    const credPath = findCredentialsFile();
    if (credPath) {
        try {
            const content = readFileSync(credPath, "utf-8");
            const parsed = JSON.parse(content);
            // Check if it's a service account (has private_key)
            if (parsed.private_key && parsed.client_email) {
                cachedCredentials = parsed;
                console.error(`[GTM MCP] Using Service Account from ${credPath}`);
                return cachedCredentials;
            }
        }
        catch (error) {
            console.error(`[GTM MCP] Failed to load credentials from ${credPath}: ${error}`);
        }
    }
    return null;
}
function loadOAuth2Credentials() {
    // Check environment variable first
    const envOAuth2 = process.env.GTM_OAUTH2_CREDENTIALS_JSON;
    if (envOAuth2) {
        try {
            const creds = JSON.parse(envOAuth2);
            console.error("[GTM MCP] Using OAuth2 credentials from GTM_OAUTH2_CREDENTIALS_JSON");
            return creds;
        }
        catch {
            console.error("[GTM MCP] Invalid JSON in GTM_OAUTH2_CREDENTIALS_JSON");
        }
    }
    // Check file
    if (existsSync(OAUTH2_CREDENTIALS_PATH)) {
        try {
            const content = readFileSync(OAUTH2_CREDENTIALS_PATH, "utf-8");
            console.error(`[GTM MCP] Using OAuth2 credentials from ${OAUTH2_CREDENTIALS_PATH}`);
            return JSON.parse(content);
        }
        catch (error) {
            console.error(`[GTM MCP] Failed to load OAuth2 credentials: ${error}`);
        }
    }
    return null;
}
function loadOAuth2Token() {
    if (existsSync(OAUTH2_TOKEN_PATH)) {
        try {
            const content = readFileSync(OAUTH2_TOKEN_PATH, "utf-8");
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    return null;
}
function saveOAuth2Token(token) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(OAUTH2_TOKEN_PATH, JSON.stringify(token, null, 2));
    console.error(`[GTM MCP] OAuth2 token saved to ${OAUTH2_TOKEN_PATH}`);
}
// Load access token directly (from env or file)
function loadAccessToken() {
    // 1. Environment variable (highest priority)
    const envToken = process.env.GTM_ACCESS_TOKEN;
    if (envToken) {
        console.error("[GTM MCP] Using access token from GTM_ACCESS_TOKEN environment variable");
        return envToken.trim();
    }
    // 2. File
    if (existsSync(ACCESS_TOKEN_PATH)) {
        try {
            const token = readFileSync(ACCESS_TOKEN_PATH, "utf-8").trim();
            if (token) {
                console.error(`[GTM MCP] Using access token from ${ACCESS_TOKEN_PATH}`);
                return token;
            }
        }
        catch (error) {
            console.error(`[GTM MCP] Failed to load access token: ${error}`);
        }
    }
    return null;
}
// Save access token to file
export function saveAccessToken(token) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(ACCESS_TOKEN_PATH, token.trim());
    console.error(`[GTM MCP] Access token saved to ${ACCESS_TOKEN_PATH}`);
}
async function createServiceAccountClient() {
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
    }
    catch (error) {
        console.error(`[GTM MCP] Service Account authentication failed: ${error}`);
        return null;
    }
}
async function createOAuth2Client() {
    const credentials = loadOAuth2Credentials();
    if (!credentials) {
        return null;
    }
    const clientConfig = credentials.installed || credentials.web;
    if (!clientConfig) {
        console.error("[GTM MCP] Invalid OAuth2 credentials format");
        return null;
    }
    const oauth2Client = new google.auth.OAuth2(clientConfig.client_id, clientConfig.client_secret, "http://localhost:3000/oauth2callback");
    // Check for existing token
    const token = loadOAuth2Token();
    if (token) {
        oauth2Client.setCredentials(token);
        // Check if token is expired
        if (token.expiry_date && token.expiry_date > Date.now()) {
            const client = google.tagmanager({
                version: "v2",
                auth: oauth2Client,
            });
            authType = "oauth2";
            console.error("[GTM MCP] Authenticated with OAuth2 (existing token)");
            return client;
        }
        // Try to refresh the token
        if (token.refresh_token) {
            try {
                const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
                const newToken = {
                    access_token: newCredentials.access_token,
                    refresh_token: newCredentials.refresh_token || token.refresh_token,
                    scope: newCredentials.scope,
                    token_type: newCredentials.token_type,
                    expiry_date: newCredentials.expiry_date,
                };
                saveOAuth2Token(newToken);
                oauth2Client.setCredentials(newToken);
                const client = google.tagmanager({
                    version: "v2",
                    auth: oauth2Client,
                });
                authType = "oauth2";
                console.error("[GTM MCP] Authenticated with OAuth2 (refreshed token)");
                return client;
            }
            catch (error) {
                console.error(`[GTM MCP] Failed to refresh OAuth2 token: ${error}`);
            }
        }
    }
    // No valid token - need to perform OAuth2 flow
    console.error("[GTM MCP] OAuth2 token not found or expired. Run 'gtm-mcp-oauth' to authenticate.");
    return null;
}
// Create client with direct access token
async function createAccessTokenClient() {
    const accessToken = loadAccessToken();
    if (!accessToken) {
        return null;
    }
    try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: accessToken,
        });
        const client = google.tagmanager({
            version: "v2",
            auth: oauth2Client,
        });
        authType = "access-token";
        console.error("[GTM MCP] Authenticated with direct access token");
        return client;
    }
    catch (error) {
        console.error(`[GTM MCP] Access token authentication failed: ${error}`);
        return null;
    }
}
export async function getTagManagerClient() {
    if (cachedClient) {
        return cachedClient;
    }
    // 1. Try Service Account first
    cachedClient = await createServiceAccountClient();
    if (cachedClient) {
        return cachedClient;
    }
    // 2. Try OAuth2
    cachedClient = await createOAuth2Client();
    if (cachedClient) {
        return cachedClient;
    }
    // 3. Try direct access token (Developer mode)
    cachedClient = await createAccessTokenClient();
    if (cachedClient) {
        return cachedClient;
    }
    throw new Error("No valid credentials found. Please configure one of the following:\n\n" +
        "Option 1: Service Account (Recommended for automation)\n" +
        "  - Run 'gtm-mcp-setup' to configure Service Account credentials\n" +
        "  - Or set GOOGLE_APPLICATION_CREDENTIALS environment variable\n\n" +
        "Option 2: OAuth2 (For personal use with refresh)\n" +
        "  - Place OAuth2 credentials at ~/.gtm-mcp/oauth2-credentials.json\n" +
        "  - Run 'gtm-mcp-oauth' to authenticate\n\n" +
        "Option 3: Access Token (Developer mode - simplest)\n" +
        "  - Get token from https://developers.google.com/oauthplayground/\n" +
        "  - Set GTM_ACCESS_TOKEN environment variable\n" +
        "  - Or save to ~/.gtm-mcp/access-token.txt\n");
}
// Clear cached client (useful when token expires)
export function clearCachedClient() {
    cachedClient = null;
    authType = null;
    console.error("[GTM MCP] Cached client cleared");
}
export function getCredentialsInfo() {
    // Check Service Account
    const saCredentials = loadServiceAccountCredentials();
    if (saCredentials) {
        return {
            email: saCredentials.client_email,
            projectId: saCredentials.project_id,
            type: "service-account",
        };
    }
    // Check OAuth2
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
    // Check Access Token
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
export function getAuthType() {
    return authType;
}
// OAuth2 authorization flow (for CLI usage)
export async function performOAuth2Flow() {
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
    const oauth2Client = new google.auth.OAuth2(clientConfig.client_id, clientConfig.client_secret, "http://localhost:3000/oauth2callback");
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
    // Start local server to receive callback
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
                        const token = {
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token,
                            scope: tokens.scope,
                            token_type: tokens.token_type,
                            expiry_date: tokens.expiry_date,
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
                    }
                    catch (err) {
                        res.writeHead(500, { "Content-Type": "text/html" });
                        res.end(`<h1>Token Exchange Failed</h1><p>${err}</p>`);
                        server.close();
                        resolve(false);
                    }
                }
            }
        });
        server.listen(3000, () => {
            // Try to open browser
            const openCommand = process.platform === "win32" ? "start" :
                process.platform === "darwin" ? "open" : "xdg-open";
            import("child_process").then(({ exec }) => {
                exec(`${openCommand} "${authUrl}"`);
            });
        });
        // Timeout after 5 minutes
        setTimeout(() => {
            console.error("\nAuthentication timed out.");
            server.close();
            resolve(false);
        }, 5 * 60 * 1000);
    });
}
export { CONFIG_DIR, OAUTH2_CREDENTIALS_PATH, OAUTH2_TOKEN_PATH, SERVICE_ACCOUNT_PATH, ACCESS_TOKEN_PATH, SCOPES };
