import { google } from "googleapis";
import { readFileSync, existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
// Get the directory where this module is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", ".."); // mcp-server root
const credentialFolder = join(projectRoot, "..", "Credential"); // ../Credential folder
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
    join(homedir(), ".gtm-mcp", "credentials.json"),
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
function findCredentialsFile() {
    for (const path of CREDENTIAL_PATHS) {
        if (path && existsSync(path)) {
            return path;
        }
    }
    return null;
}
function loadCredentials() {
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
            throw new Error("Invalid JSON in GTM_SERVICE_ACCOUNT_JSON environment variable");
        }
    }
    // Try file paths
    const credPath = findCredentialsFile();
    if (credPath) {
        try {
            const content = readFileSync(credPath, "utf-8");
            cachedCredentials = JSON.parse(content);
            console.error(`[GTM MCP] Using credentials from ${credPath}`);
            return cachedCredentials;
        }
        catch (error) {
            throw new Error(`Failed to load credentials from ${credPath}: ${error}`);
        }
    }
    throw new Error("No Service Account credentials found. Please either:\n" +
        "1. Run 'gtm-mcp-setup' to configure credentials (recommended)\n" +
        "2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable to the JSON file path\n" +
        "3. Place credentials in ~/.gtm-mcp/credentials.json");
}
export async function getTagManagerClient() {
    if (cachedClient) {
        return cachedClient;
    }
    const credentials = loadCredentials();
    // Create JWT client with Service Account
    const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
            "https://www.googleapis.com/auth/tagmanager.readonly",
            "https://www.googleapis.com/auth/tagmanager.edit.containers",
            "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
            "https://www.googleapis.com/auth/tagmanager.manage.accounts",
            "https://www.googleapis.com/auth/tagmanager.manage.users",
            "https://www.googleapis.com/auth/tagmanager.publish",
        ],
    });
    // Authorize and cache the client
    await auth.authorize();
    cachedClient = google.tagmanager({
        version: "v2",
        auth: auth,
    });
    console.error(`[GTM MCP] Authenticated as ${credentials.client_email}`);
    return cachedClient;
}
export function getCredentialsInfo() {
    try {
        const credentials = loadCredentials();
        return {
            email: credentials.client_email,
            projectId: credentials.project_id,
        };
    }
    catch {
        return null;
    }
}
