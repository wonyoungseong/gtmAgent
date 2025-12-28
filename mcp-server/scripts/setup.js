#!/usr/bin/env node

/**
 * GTM MCP Server - Setup Script
 * Configures Service Account credentials
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join, resolve, isAbsolute } from "path";
import { createInterface } from "readline";

var CONFIG_DIR = join(homedir(), ".gtm-mcp");
var CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

function log(msg) {
  console.log("[GTM MCP Setup] " + msg);
}

function error(msg) {
  console.error("[GTM MCP Setup] ERROR: " + msg);
}

function prompt(question) {
  var rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(function(resolve) {
    rl.question(question, function(answer) {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validateCredentials(content) {
  try {
    var creds = JSON.parse(content);
    if (!creds.type || creds.type !== "service_account") {
      return { valid: false, error: "Not a service account JSON (missing type: service_account)" };
    }
    if (!creds.client_email) {
      return { valid: false, error: "Missing client_email" };
    }
    if (!creds.private_key) {
      return { valid: false, error: "Missing private_key" };
    }
    return { valid: true, email: creds.client_email, projectId: creds.project_id };
  } catch (e) {
    return { valid: false, error: "Invalid JSON: " + e.message };
  }
}

async function setup() {
  console.log("");
  console.log("=".repeat(50));
  console.log("GTM MCP Server - Credential Setup");
  console.log("=".repeat(50));
  console.log("");

  // Check if credentials already exist
  if (existsSync(CREDENTIALS_PATH)) {
    var existing = readFileSync(CREDENTIALS_PATH, "utf-8");
    var validation = validateCredentials(existing);
    if (validation.valid) {
      console.log("Existing credentials found:");
      console.log("  Email: " + validation.email);
      console.log("  Project: " + validation.projectId);
      console.log("");
      var overwrite = await prompt("Overwrite existing credentials? (y/N): ");
      if (overwrite.toLowerCase() !== "y") {
        log("Setup cancelled");
        return;
      }
    }
  }

  // Get credentials path from user
  console.log("");
  console.log("Please provide the path to your Service Account JSON file.");
  console.log("You can create one at: https://console.cloud.google.com/iam-admin/serviceaccounts");
  console.log("");

  var inputPath = await prompt("Service Account JSON path: ");

  if (!inputPath) {
    error("No path provided");
    process.exit(1);
  }

  // Remove surrounding quotes (from drag-and-drop or copy-paste)
  inputPath = inputPath.replace(/^['"]|['"]$/g, "");

  // Resolve path
  var sourcePath = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

  if (!existsSync(sourcePath)) {
    error("File not found: " + sourcePath);
    process.exit(1);
  }

  // Validate credentials
  var content = readFileSync(sourcePath, "utf-8");
  var validation = validateCredentials(content);

  if (!validation.valid) {
    error(validation.error);
    process.exit(1);
  }

  // Create config directory
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Copy credentials
  copyFileSync(sourcePath, CREDENTIALS_PATH);
  log("Credentials saved to " + CREDENTIALS_PATH);

  console.log("");
  console.log("Setup complete!");
  console.log("");
  console.log("Service Account: " + validation.email);
  console.log("Project ID: " + validation.projectId);
  console.log("");
  console.log("You can now use the GTM MCP server with Claude Desktop.");
  console.log("");
}

// Check for --check flag
if (process.argv.includes("--check")) {
  if (existsSync(CREDENTIALS_PATH)) {
    var content = readFileSync(CREDENTIALS_PATH, "utf-8");
    var validation = validateCredentials(content);
    if (validation.valid) {
      console.log("Credentials OK: " + validation.email);
      process.exit(0);
    } else {
      error(validation.error);
      process.exit(1);
    }
  } else {
    error("No credentials found. Run 'gtm-mcp-setup' to configure.");
    process.exit(1);
  }
} else {
  setup().catch(function(e) {
    error(e.message);
    process.exit(1);
  });
}
