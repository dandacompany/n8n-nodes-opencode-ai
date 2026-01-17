# n8n-nodes-opencode-ai

[![npm version](https://badge.fury.io/js/n8n-nodes-opencode-ai.svg)](https://www.npmjs.com/package/n8n-nodes-opencode-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is an n8n community node package that provides integration with [OpenCode](https://opencode.ai/) AI Server API.

[OpenCode](https://github.com/opencode-ai/opencode) is a powerful terminal-based AI coding assistant. This node enables you to interact with OpenCode Server from your n8n workflows.

## Features

- **Session Management**: Create, list, get, delete, and abort OpenCode sessions
- **Message Operations**: Send messages (sync/async), execute commands, run shell commands
- **AI Agent Integration**: LangChain-compatible Tool and ChatModel nodes for n8n AI agents
- **Dynamic Configuration**: Auto-load available models, agents, and commands from server

## Prerequisites

> **⚠️ Important**: This package requires a running OpenCode Server instance. The node connects to OpenCode Server via REST API, so you must have the server running before using this node.

### Installing OpenCode

```bash
# Install OpenCode CLI
curl -fsSL https://opencode.ai/install | bash
```

For other installation methods (npm, Homebrew, Scoop, etc.), see the [OpenCode Installation Guide](https://opencode.ai/docs/installation/).

### Oh My OpenCode (Optional, Recommended)

[Oh My OpenCode](https://ohmyopencode.com/) is a powerful plugin that enhances OpenCode with specialized agents like **Sisyphus** (Claude Opus 4.5 with extended thinking) and parallel background task execution.

```bash
# Install via bunx
bunx oh-my-opencode install

# Or via npm
npm install -g oh-my-opencode
```

For more details, visit [Oh My OpenCode GitHub](https://github.com/code-yeongyu/oh-my-opencode).

### Starting OpenCode Server

```bash
# Set authentication credentials via environment variables
OPENCODE_SERVER_USERNAME=your_username OPENCODE_SERVER_PASSWORD=your_password opencode serve --port 4096
```

You can change the port number as needed. The credentials you set here will be used in the n8n credential configuration.

### Security Considerations

> **🔒 Security Warning**: The example above is for development/testing purposes only.

For production deployments:

- **Never hardcode credentials** in scripts or command lines
- Use secure environment variable management (e.g., `.env` files with proper permissions, secrets managers)
- Deploy behind a **reverse proxy** (nginx, Caddy) with HTTPS/TLS encryption
- Implement **network-level security** (firewall rules, VPN, private networks)
- Use **strong passwords** and consider rotating credentials regularly
- Monitor access logs and set up alerts for suspicious activity

Example production setup with environment file:

```bash
# .env file (chmod 600)
OPENCODE_SERVER_USERNAME=secure_username
OPENCODE_SERVER_PASSWORD=strong_random_password

# Start server
source .env && opencode serve --port 4096
```

## Installation

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Click **Install**
3. Enter `n8n-nodes-opencode-ai` and click **Install**

### Manual Installation

```bash
npm install n8n-nodes-opencode-ai
```

## Nodes

| Node | Description |
|------|-------------|
| **OpenCode** | Main node for session and message operations |
| **OpenCode Tool** | LangChain tool for AI agent workflows |
| **OpenCode Chat Model** | LangChain chat model for AI agent workflows |

## Credentials

This node uses Basic Authentication to connect to OpenCode Server.

| Field | Description | Default |
|-------|-------------|---------|
| Base URL | OpenCode Server URL | `http://127.0.0.1:4096` |
| Username | Basic Auth username | - |
| Password | Basic Auth password | - |

## Operations

### Session Resource
- **List**: Get all sessions
- **Get**: Get a specific session
- **Create**: Create a new session
- **Delete**: Delete a session
- **Abort**: Abort a running session
- **Status**: Get status of all sessions

### Message Resource
- **Send**: Send a message and wait for response
- **Send Async**: Send a message without waiting
- **Execute Command**: Run a slash command (e.g., /help)
- **Run Shell**: Execute a shell command
- **List**: Get all messages in a session
- **Get**: Get a specific message by ID

### Config Resource
- **Get Providers**: List available AI providers and models

## Usage Examples

### Basic Message Send

1. Add the **OpenCode** node to your workflow
2. Select **Message** resource and **Send** operation
3. Choose or create a session
4. Enter your message
5. Execute to get AI response

### Using with AI Agent

1. Add **OpenCode Chat Model** node as the model
2. Add **OpenCode Tool** node as a tool
3. Connect to an AI Agent node
4. The agent can now use OpenCode for coding tasks

### Temporary Session Mode

Enable **Temporary Session** mode to automatically create and delete sessions per request - useful for stateless operations.

## Requirements

- **OpenCode Server** running and accessible (see [Prerequisites](#prerequisites))
- n8n version 1.0.0 or later
- Node.js 18.0.0 or later

## Related Links

- [OpenCode Official Site](https://opencode.ai/)
- [OpenCode GitHub Repository](https://github.com/opencode-ai/opencode)
- [OpenCode Installation Guide](https://opencode.ai/docs/installation/)
- [OpenCode Server Documentation](https://opencode.ai/docs/server/)
- [Oh My OpenCode](https://ohmyopencode.com/) - Recommended plugin with specialized agents
- [Oh My OpenCode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

This project is licensed under the [MIT License](LICENSE).

This is an independent community node and is not officially affiliated with or endorsed by OpenCode. [OpenCode](https://github.com/opencode-ai/opencode) is also licensed under the MIT License.

---

## Dante Labs

**Developed and maintained by Dante Labs**

- **Homepage**: [dante-datalab.com](https://dante-datalab.com)
- **YouTube**: [@dante-labs](https://youtube.com/@dante-labs)
- **Discord**: [Dante Labs Community](https://discord.com/invite/rXyy5e9ujs)
- **Email**: datapod.k@gmail.com

### Support

If you find this project helpful, consider supporting the development!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/dante.labs)

**☕ Buy Me a Coffee**: https://buymeacoffee.com/dante.labs
