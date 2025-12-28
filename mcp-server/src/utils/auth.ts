import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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

// Service Account credential paths to check
const CREDENTIAL_PATHS = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  join(process.cwd(), "service-account.json"),
  join(process.cwd(), "credentials.json"),
  join(homedir(), ".config", "gtm-mcp", "service-account.json"),
];

let cachedClient: TagManagerClient | null = null;
let cachedCredentials: ServiceAccountCredentials | null = null;

function findCredentialsFile(): string | null {
  for (const path of CREDENTIAL_PATHS) {
    if (path && existsSync(path)) {
      return path;
    }
  }
  return null;
}

function loadCredentials(): ServiceAccountCredentials {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Try environment variable first (JSON string)
  const envCredentials = process.env.GTM_SERVICE_ACCOUNT_JSON;
  if (envCredentials) {
    try {
      cachedCredentials = JSON.parse(envCredentials);
      console.error("[GTM MCP] Using credentials from GTM_SERVICE_ACCOUNT_JSON environment variable");
      return cachedCredentials!;
    } catch {
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
      return cachedCredentials!;
    } catch (error) {
      throw new Error(`Failed to load credentials from ${credPath}: ${error}`);
    }
  }

  throw new Error(
    "No Service Account credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS, " +
    "GTM_SERVICE_ACCOUNT_JSON, or place service-account.json in the current directory."
  );
}

export async function getTagManagerClient(): Promise<TagManagerClient> {
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

export function getCredentialsInfo(): { email: string; projectId: string } | null {
  try {
    const credentials = loadCredentials();
    return {
      email: credentials.client_email,
      projectId: credentials.project_id,
    };
  } catch {
    return null;
  }
}
