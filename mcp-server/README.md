# GTM MCP Server (Service Account)

Google Tag Manager MCP Server with Service Account authentication. Returns **full container data without pagination limits**.

## Features

- **Service Account Authentication**: No OAuth flow required
- **No Pagination Limits**: Returns complete container version data
- **Full Export**: `gtm_export_full` tool for complete JSON export
- **Claude Code Integration**: Works as a local MCP server

## Setup

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Tag Manager API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Tag Manager API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "gtm-mcp-service")
   - Grant appropriate roles (e.g., "Tag Manager Admin" or custom roles)
5. Create a key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key" → "JSON"
   - Download the JSON file

### 2. Grant GTM Access

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Select your container
3. Go to "Admin" → "User Management"
4. Add the service account email (from the JSON file)
5. Grant appropriate permissions (Read/Edit/Publish)

### 3. Configure Credentials

Option A: Place the JSON file in the project:
```bash
cp ~/Downloads/your-service-account.json ./service-account.json
```

Option B: Set environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Option C: Set JSON content directly:
```bash
export GTM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### 4. Configure Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "gtm-local": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/gtmAgent/mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `gtm_account` | List/get GTM accounts |
| `gtm_container` | List/get containers |
| `gtm_workspace` | List/get workspaces |
| `gtm_version` | Get container versions (FULL data) |
| `gtm_tag` | List/get tags |
| `gtm_trigger` | List/get triggers |
| `gtm_variable` | List/get variables |
| `gtm_export_full` | Export complete container version |

## Usage Examples

### List Accounts
```
gtm_account(action: "list")
```

### Get Live Version (Full Data)
```
gtm_version(action: "live", accountId: "123", containerId: "456")
```

### Export Full Container
```
gtm_export_full(accountId: "123", containerId: "456", versionType: "live")
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run with tsx (development)
npm run dev

# Run compiled version
npm start
```

## Comparison with Stape MCP

| Feature | Stape MCP | This MCP |
|---------|-----------|----------|
| Authentication | OAuth2 | Service Account |
| Pagination | 20 items/page | No limit |
| Hosting | Cloudflare Workers | Local (stdio) |
| Full Export | Sample only | Complete data |
