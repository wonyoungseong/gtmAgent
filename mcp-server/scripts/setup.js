#!/usr/bin/env node

/**
 * GTM MCP Server - Setup Script
 * Configures Service Account credentials with native file picker
 */

import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync } from "fs";
import { homedir, platform } from "os";
import { join, resolve, basename, dirname } from "path";
import { createInterface } from "readline";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);

// Project root (where gtmAgent is cloned)
var PROJECT_ROOT = resolve(__dirname, "..", "..");
var CREDENTIAL_FOLDER = join(PROJECT_ROOT, "Credential");

// Global config location
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

  return new Promise(function(res) {
    rl.question(question, function(answer) {
      rl.close();
      res(answer.trim());
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

/**
 * Find existing credential file in Credential folder
 */
function findExistingCredential() {
  if (!existsSync(CREDENTIAL_FOLDER)) {
    return null;
  }

  var files = readdirSync(CREDENTIAL_FOLDER);
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (file.endsWith(".json")) {
      var filePath = join(CREDENTIAL_FOLDER, file);
      var content = readFileSync(filePath, "utf-8");
      var validation = validateCredentials(content);
      if (validation.valid) {
        return { path: filePath, validation: validation };
      }
    }
  }
  return null;
}

/**
 * Open native file picker dialog
 * Returns selected file path or null if cancelled
 */
function openFilePicker() {
  var os = platform();

  try {
    if (os === "darwin") {
      // macOS - use osascript (no type filter for better compatibility)
      var script = 'osascript -e \'set theFile to choose file with prompt "Select Service Account JSON file (.json)"\' -e \'POSIX path of theFile\'';
      var result = execSync(script, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      return result.trim();
    } else if (os === "win32") {
      // Windows - use PowerShell
      var psScript = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
        "$dialog.Filter = 'JSON files (*.json)|*.json'",
        "$dialog.Title = 'Select Service Account JSON file'",
        "if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName }"
      ].join("; ");
      var result = execSync("powershell -Command \"" + psScript + "\"", { encoding: "utf-8" });
      return result.trim();
    } else {
      // Linux - try zenity or kdialog
      try {
        var result = execSync('zenity --file-selection --title="Select Service Account JSON file" --file-filter="JSON files|*.json"', { encoding: "utf-8" });
        return result.trim();
      } catch (e) {
        try {
          var result = execSync('kdialog --getopenfilename . "*.json|JSON files"', { encoding: "utf-8" });
          return result.trim();
        } catch (e2) {
          return null;
        }
      }
    }
  } catch (e) {
    // User cancelled or error
    return null;
  }
}

async function setup() {
  console.log("");
  console.log("=".repeat(50));
  console.log("GTM MCP Server - Credential Setup");
  console.log("=".repeat(50));
  console.log("");
  console.log("Project folder: " + PROJECT_ROOT);
  console.log("Credential folder: " + CREDENTIAL_FOLDER);
  console.log("");

  // Step 1: Check for existing credential in Credential folder
  var existing = findExistingCredential();

  if (existing) {
    console.log("Found existing credential in Credential folder:");
    console.log("  File: " + basename(existing.path));
    console.log("  Email: " + existing.validation.email);
    console.log("  Project: " + existing.validation.projectId);
    console.log("");

    var useExisting = await prompt("Use this credential? (Y/n): ");
    if (useExisting.toLowerCase() !== "n") {
      // Use existing credential
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
      }
      copyFileSync(existing.path, CREDENTIALS_PATH);
      log("Credentials configured from: " + existing.path);
      showSuccess(existing.validation);
      return;
    }
  }

  // Step 2: Check global config
  if (existsSync(CREDENTIALS_PATH)) {
    var globalContent = readFileSync(CREDENTIALS_PATH, "utf-8");
    var globalValidation = validateCredentials(globalContent);
    if (globalValidation.valid) {
      console.log("Found existing global credentials:");
      console.log("  Email: " + globalValidation.email);
      console.log("  Project: " + globalValidation.projectId);
      console.log("");
      var useGlobal = await prompt("Use existing global credentials? (Y/n): ");
      if (useGlobal.toLowerCase() !== "n") {
        log("Using existing credentials");
        showSuccess(globalValidation);
        return;
      }
    }
  }

  // Step 3: Open file picker to select new credential
  console.log("");
  console.log("Opening file picker to select Service Account JSON...");
  console.log("(If dialog doesn't open, you can paste the file path below)");
  console.log("");

  var selectedPath = openFilePicker();

  if (!selectedPath) {
    // File picker failed or cancelled, fallback to manual input
    console.log("File picker not available or cancelled.");
    console.log("");
    var inputPath = await prompt("Please enter the path to your Service Account JSON: ");

    if (!inputPath) {
      error("No path provided");
      process.exit(1);
    }

    // Remove surrounding quotes
    inputPath = inputPath.replace(/^['"]|['"]$/g, "");
    selectedPath = inputPath;
  }

  // Resolve path
  if (!selectedPath.startsWith("/") && !selectedPath.match(/^[A-Z]:\\/i)) {
    selectedPath = resolve(process.cwd(), selectedPath);
  }

  if (!existsSync(selectedPath)) {
    error("File not found: " + selectedPath);
    process.exit(1);
  }

  // Validate credentials
  var content = readFileSync(selectedPath, "utf-8");
  var validation = validateCredentials(content);

  if (!validation.valid) {
    error(validation.error);
    process.exit(1);
  }

  // Step 4: Copy to Credential folder
  if (!existsSync(CREDENTIAL_FOLDER)) {
    mkdirSync(CREDENTIAL_FOLDER, { recursive: true });
    log("Created Credential folder: " + CREDENTIAL_FOLDER);
  }

  var destFileName = basename(selectedPath);
  var destPath = join(CREDENTIAL_FOLDER, destFileName);

  if (selectedPath !== destPath) {
    copyFileSync(selectedPath, destPath);
    log("Copied credential to: " + destPath);
  }

  // Step 5: Copy to global config
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  copyFileSync(selectedPath, CREDENTIALS_PATH);
  log("Credentials saved to: " + CREDENTIALS_PATH);

  showSuccess(validation);
}

/**
 * Copy skills to Claude config folder
 */
function copySkills() {
  var skillsSource = join(PROJECT_ROOT, "mcp-server", "skills", "gtm");
  var skillsTarget = join(homedir(), ".claude", "skills", "gtm");
  var skillsParent = join(homedir(), ".claude", "skills");

  if (!existsSync(skillsSource)) {
    log("Skills source not found, skipping");
    return false;
  }

  // Create target directory
  if (!existsSync(skillsParent)) {
    mkdirSync(skillsParent, { recursive: true });
  }

  // Copy skills recursively
  try {
    copyFolderSync(skillsSource, skillsTarget);
    log("Skills installed to: " + skillsTarget);
    return true;
  } catch (e) {
    error("Failed to copy skills: " + e.message);
    return false;
  }
}

/**
 * Recursively copy folder
 */
function copyFolderSync(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  var entries = readdirSync(src, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var srcPath = join(src, entry.name);
    var destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function showSuccess(validation) {
  // Auto-copy skills
  console.log("");
  copySkills();

  console.log("");
  console.log("=".repeat(50));
  console.log("Setup complete!");
  console.log("=".repeat(50));
  console.log("");
  console.log("Service Account: " + validation.email);
  console.log("Project ID: " + validation.projectId);
  console.log("");
  console.log("You can now use the GTM MCP server with Claude Desktop.");
  console.log("");
  console.log("Add to your .mcp.json:");
  console.log('{');
  console.log('  "mcpServers": {');
  console.log('    "gtm": { "command": "gtm-mcp" }');
  console.log('  }');
  console.log('}');
  console.log("");
}

// Check for --check flag
if (process.argv.includes("--check")) {
  // First check Credential folder
  var existing = findExistingCredential();
  if (existing) {
    console.log("Credentials OK (local): " + existing.validation.email);
    process.exit(0);
  }

  // Then check global config
  if (existsSync(CREDENTIALS_PATH)) {
    var content = readFileSync(CREDENTIALS_PATH, "utf-8");
    var validation = validateCredentials(content);
    if (validation.valid) {
      console.log("Credentials OK (global): " + validation.email);
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
