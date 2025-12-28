# GTM MCP Server

Google Tag Manager MCP Server with Service Account authentication and Claude Skills.

## Features

- **Service Account Authentication**: No OAuth flow required
- **Full API Coverage**: All 19 GTM tools
- **Pagination Support**: Configurable page sizes for large datasets
- **Claude Skills**: Auto-installs GTM Agent skills to `~/.claude/skills/gtm/`
- **Easy Setup**: CLI tool for credential configuration

## Quick Install

```bash
# Install from GitHub
npm install -g github:wonyoungseong/gtmAgent

# Setup credentials
gtm-mcp-setup

# Add to Claude Desktop (.mcp.json)
{
  "mcpServers": {
    "gtm": {
      "command": "gtm-mcp"
    }
  }
}
```

## Setup

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Tag Manager API**:
   - "APIs & Services" → "Library" → Search "Tag Manager API" → Enable
4. Create a Service Account:
   - "IAM & Admin" → "Service Accounts" → "Create Service Account"
5. Create a key:
   - Click the service account → "Keys" → "Add Key" → "JSON"
   - Download the JSON file

### 2. Grant GTM Access

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Select your container → "Admin" → "User Management"
3. Add the service account email (from the JSON file)
4. Grant appropriate permissions (Read/Edit/Publish)

### 3. Configure Credentials

Run the setup CLI:

```bash
gtm-mcp-setup
```

This will:
- Prompt for your Service Account JSON file path
- Copy it to `~/.gtm-mcp/credentials.json`
- Validate the credentials

### 4. Configure Claude Desktop

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "gtm": {
      "command": "gtm-mcp"
    }
  }
}
```

## Available Tools

| Tool | Actions |
|------|---------|
| `gtm_account` | get, list, update |
| `gtm_container` | create, get, list, update, remove, combine, lookup, moveTagId, snippet |
| `gtm_workspace` | create, get, list, update, remove, createVersion, getStatus, sync, quickPreview, resolveConflict |
| `gtm_tag` | create, get, list, update, remove, revert |
| `gtm_trigger` | create, get, list, update, remove, revert |
| `gtm_variable` | create, get, list, update, remove, revert |
| `gtm_version` | get, live, publish, remove, setLatest, undelete, update |
| `gtm_built_in_variable` | create, list, remove, revert |
| `gtm_client` | create, get, list, update, remove, revert |
| `gtm_destination` | get, list, link, unlink |
| `gtm_environment` | create, get, list, update, remove, reauthorize |
| `gtm_folder` | create, get, list, update, remove, revert, entities, moveEntitiesToFolder |
| `gtm_gtag_config` | create, get, list, update, remove |
| `gtm_template` | create, get, list, update, remove, revert |
| `gtm_transformation` | create, get, list, update, remove, revert |
| `gtm_user_permission` | create, get, list, update, remove |
| `gtm_version_header` | list, latest |
| `gtm_zone` | create, get, list, update, remove, revert |
| `gtm_export_full` | Export complete container data |
| `gtm_remove_session` | Clear session data |

## Usage Examples

```javascript
// List Accounts
gtm_account(action: "list")

// List Tags with Pagination
gtm_tag(action: "list", accountId: "123", containerId: "456", workspaceId: "789", page: 1, itemsPerPage: 20)

// Get Live Version
gtm_version(action: "live", accountId: "123", containerId: "456")

// Create a Tag
gtm_tag(action: "create", accountId: "123", containerId: "456", workspaceId: "789", createOrUpdateConfig: {...})
```

## Credential Search Order

1. `GTM_SERVICE_ACCOUNT_JSON` environment variable (JSON string)
2. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (file path)
3. `~/.gtm-mcp/credentials.json` (setup by gtm-mcp-setup)
4. `../Credential/*.json` (development)
5. `./service-account.json`
6. `./credentials.json`

## Claude Skills

To install the GTM Agent skills, manually copy the skills folder:

```bash
# After installation, copy skills to Claude config
cp -r $(npm root -g)/gtm-mcp-server/mcp-server/skills/gtm ~/.claude/skills/
```

Skills include:
- **SKILL.md**: Main workflow guide
- **procedures.md**: Detailed procedures
- **naming-convention.md**: Tag/Trigger/Variable naming rules
- **validation.md**: ES5 and validation checklists
- **event-types.md**: Type A/B/C event classification

## Development

```bash
# Clone the repository
git clone https://github.com/wonyoungseong/gtmAgent.git
cd gtmAgent/mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run with tsx (development)
npm run dev

# Run compiled version
npm start
```

## License

MIT
