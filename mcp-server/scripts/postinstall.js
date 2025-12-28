#!/usr/bin/env node

/**
 * GTM MCP Server - Postinstall Script
 * Copies Claude Skills to ~/.claude/skills/gtm/
 */

import { existsSync, mkdirSync, cpSync, readdirSync, renameSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Change to home directory to avoid ENOENT errors
try {
  process.chdir(homedir());
} catch (e) {
  // Ignore if already there
}

var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);

var SKILLS_SOURCE = join(__dirname, "..", "skills", "gtm");
var SKILLS_TARGET = join(homedir(), ".claude", "skills", "gtm");
var BACKUP_SUFFIX = ".backup-" + Date.now();

function log(msg) {
  console.log("[GTM MCP] " + msg);
}

function copySkills() {
  // Check if source skills exist
  if (!existsSync(SKILLS_SOURCE)) {
    log("Skills source not found, skipping skills installation");
    return;
  }

  // Create target directory
  var targetParent = dirname(SKILLS_TARGET);
  if (!existsSync(targetParent)) {
    mkdirSync(targetParent, { recursive: true });
  }

  // Backup existing skills if they exist
  if (existsSync(SKILLS_TARGET)) {
    var backupPath = SKILLS_TARGET + BACKUP_SUFFIX;
    log("Backing up existing skills to " + backupPath);
    renameSync(SKILLS_TARGET, backupPath);
  }

  // Copy skills
  try {
    cpSync(SKILLS_SOURCE, SKILLS_TARGET, { recursive: true });
    log("Skills installed to " + SKILLS_TARGET);
  } catch (err) {
    console.error("[GTM MCP] Failed to copy skills: " + err.message);
  }
}

function showNextSteps() {
  console.log("");
  console.log("=".repeat(50));
  console.log("GTM MCP Server installed successfully!");
  console.log("=".repeat(50));
  console.log("");
  console.log("Next steps:");
  console.log("");
  console.log("1. Setup Service Account credentials:");
  console.log("   $ gtm-mcp-setup");
  console.log("");
  console.log("2. Add to your Claude Desktop config (.mcp.json):");
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "gtm": {');
  console.log('         "command": "gtm-mcp"');
  console.log('       }');
  console.log('     }');
  console.log('   }');
  console.log("");
  console.log("3. Restart Claude Desktop");
  console.log("");
}

// Run
copySkills();
showNextSteps();
