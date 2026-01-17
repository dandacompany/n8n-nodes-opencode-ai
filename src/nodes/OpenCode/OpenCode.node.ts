import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { executeAction } from './actions';
import { IProvider, ISession } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ISkillInfo {
	name: string;
	description: string;
	path: string;
}

/**
 * Parse YAML frontmatter from SKILL.md content
 */
function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
	const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return {};
	}

	const frontmatter = frontmatterMatch[1];
	const result: { name?: string; description?: string } = {};

	// Parse name
	const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
	if (nameMatch) {
		result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
	}

	// Parse description
	const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
	if (descMatch) {
		result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
	}

	return result;
}

/**
 * Scan a directory for skill folders containing SKILL.md
 */
function scanSkillDirectory(baseDir: string): ISkillInfo[] {
	const skills: ISkillInfo[] = [];

	try {
		if (!fs.existsSync(baseDir)) {
			return skills;
		}

		const entries = fs.readdirSync(baseDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const skillMdPath = path.join(baseDir, entry.name, 'SKILL.md');

			if (fs.existsSync(skillMdPath)) {
				try {
					const content = fs.readFileSync(skillMdPath, 'utf-8');
					const { name, description } = parseSkillFrontmatter(content);

					skills.push({
						name: name || entry.name,
						description: description || `Skill: ${entry.name}`,
						path: path.join(baseDir, entry.name),
					});
				} catch (err) {
					// Skip files that can't be read
					console.error(`Error reading ${skillMdPath}:`, err);
				}
			}
		}
	} catch (err) {
		console.error(`Error scanning directory ${baseDir}:`, err);
	}

	return skills;
}

export class OpenCode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenCode',
		name: 'openCode',
		icon: 'file:opencode.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Interact with OpenCode Server API for AI coding assistant sessions',
		defaults: {
			name: 'OpenCode',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'openCodeApi',
				required: true,
			},
		],
		properties: [
			// Resource
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Session',
						value: 'session',
						description: 'Manage OpenCode sessions',
					},
					{
						name: 'Message',
						value: 'message',
						description: 'Send and receive messages',
					},
					{
						name: 'Config',
						value: 'config',
						description: 'Get configuration and providers',
					},
				],
				default: 'session',
			},

			// Session Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['session'],
					},
				},
				options: [
					{
						name: 'List',
						value: 'list',
						description: 'Get all sessions',
						action: 'List all sessions',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a specific session',
						action: 'Get a session',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new session',
						action: 'Create a session',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a session',
						action: 'Delete a session',
					},
					{
						name: 'Abort',
						value: 'abort',
						description: 'Abort a running session',
						action: 'Abort a session',
					},
					{
						name: 'Status',
						value: 'status',
						description: 'Get status of all sessions',
						action: 'Get session status',
					},
				],
				default: 'list',
			},

			// Message Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a message and wait for response',
						action: 'Send a message',
					},
					{
						name: 'Send Async',
						value: 'sendAsync',
						description: 'Send a message without waiting for response',
						action: 'Send a message async',
					},
					{
						name: 'Execute Command',
						value: 'command',
						description: 'Execute a slash command',
						action: 'Execute a command',
					},
					{
						name: 'Run Shell',
						value: 'shell',
						description: 'Run a shell command',
						action: 'Run shell command',
					},
					{
						name: 'Execute Skill',
						value: 'skill',
						description: 'Execute a skill with arguments',
						action: 'Execute a skill',
					},
					{
						name: 'List',
						value: 'list',
						description: 'Get all messages in a session',
						action: 'List messages',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a specific message by ID',
						action: 'Get a message',
					},
				],
				default: 'send',
			},

			// Config Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['config'],
					},
				},
				options: [
					{
						name: 'Get Providers',
						value: 'getProviders',
						description: 'Get all available providers and models',
						action: 'Get providers',
					},
				],
				default: 'getProviders',
			},

			// Session ID (for get, delete, abort)
			{
				displayName: 'Session',
				name: 'sessionId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSessions',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['session'],
						operation: ['get', 'delete', 'abort'],
					},
				},
				default: '',
				description: 'Select a session',
			},

			// Session Mode (for message operations)
			{
				displayName: 'Session Mode',
				name: 'sessionMode',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync', 'command', 'shell', 'skill'],
					},
				},
				options: [
					{
						name: 'Use Existing Session',
						value: 'existing',
						description: 'Use an existing session for conversations',
					},
					{
						name: 'Temporary Session',
						value: 'temporary',
						description: 'Create a new session for this request and delete it after response',
					},
				],
				default: 'existing',
				description: 'Choose how to handle sessions',
			},

			// Session ID (for message operations - existing mode)
			{
				displayName: 'Session',
				name: 'sessionId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSessions',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync', 'command', 'shell', 'skill'],
						sessionMode: ['existing'],
					},
				},
				default: '',
				description: 'Select a session for messaging',
			},

			// Session ID (for message list and get operation)
			{
				displayName: 'Session',
				name: 'sessionId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSessions',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['list', 'get'],
					},
				},
				default: '',
				description: 'Select a session',
			},

			// Message ID (for get operation)
			{
				displayName: 'Message ID',
				name: 'targetMessageId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The ID of the message to retrieve',
			},

			// Limit (for list operation)
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['list'],
					},
				},
				default: 50,
				description: 'Maximum number of messages to return',
			},

			// Temporary Session Title
			{
				displayName: 'Temporary Session Title',
				name: 'tempSessionTitle',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync', 'command', 'shell', 'skill'],
						sessionMode: ['temporary'],
					},
				},
				default: 'Temporary Chat Session',
				description: 'Title for temporary sessions (for debugging purposes)',
			},

			// Session Title (for create)
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['session'],
						operation: ['create'],
					},
				},
				default: 'New Session',
				description: 'Title for the new session',
			},

			// Message Text
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync'],
					},
				},
				default: '',
				description: 'The message to send',
			},

			// Model Selection
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync', 'command', 'shell', 'skill'],
					},
				},
				default: '',
				description: 'Select a model (optional, uses default if not specified)',
			},

			// Simple Response (for send)
			{
				displayName: 'Simple Response',
				name: 'simpleResponse',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send'],
					},
				},
				default: false,
				description:
					'Whether to return only the response text (true) or full metadata (false)',
			},

			// Simple Response (for shell)
			{
				displayName: 'Simple Response',
				name: 'simpleResponse',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['shell'],
					},
				},
				default: false,
				description:
					'Whether to return only the shell output (true) or full metadata (false)',
			},

			// Command (for command operation)
			{
				displayName: 'Command',
				name: 'command',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getCommands',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['command'],
					},
				},
				default: '',
				description: 'Select a slash command to execute',
			},

			// Command Arguments (for command operation)
			{
				displayName: 'Command Arguments',
				name: 'commandArguments',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['command'],
					},
				},
				default: '',
				placeholder: '{"key": "value"}',
				description: 'Arguments for the command in JSON format',
			},

			// Shell Command (for shell operation)
			{
				displayName: 'Shell Command',
				name: 'shellCommand',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['shell'],
					},
				},
				default: '',
				placeholder: 'ls -la',
				description: 'The shell command to run',
			},

			// Shell Agent (for shell operation)
			{
				displayName: 'Agent',
				name: 'shellAgent',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAgents',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['shell'],
					},
				},
				default: '',
				description: 'Agent to use for executing the shell command',
			},

			// Skill (for skill operation)
			{
				displayName: 'Skill',
				name: 'skill',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSkills',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['skill'],
					},
				},
				default: '',
				description: 'Select a skill to execute',
			},

			// Skill Arguments (for skill operation)
			{
				displayName: 'Skill Arguments',
				name: 'skillArguments',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['skill'],
					},
				},
				default: '',
				placeholder: 'Enter arguments for the skill...',
				description: 'Arguments to pass to the skill',
			},

			// Options for send/sendAsync operations
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['send', 'sendAsync'],
					},
				},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 300000,
						description: 'Request timeout in milliseconds (default: 300000 = 5 minutes)',
					},
					{
						displayName: 'Trim Response',
						name: 'trimResponse',
						type: 'boolean',
						default: true,
						description: 'Whether to trim whitespace from the response text',
					},
					{
						displayName: 'Response Key',
						name: 'responseKey',
						type: 'string',
						default: 'response',
						description: 'The key name for the response text in the output JSON',
					},
					{
						displayName: 'Agent',
						name: 'agent',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getAgents',
						},
						default: '',
						description: 'Agent to use for processing the message (optional)',
					},
					{
						displayName: 'Reference Message ID',
						name: 'messageID',
						type: 'string',
						default: '',
						description: 'Reference message ID for context (optional)',
					},
					{
						displayName: 'System Prompt',
						name: 'system',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'System prompt to prepend to the message (optional)',
					},
					{
						displayName: 'No Reply',
						name: 'noReply',
						type: 'boolean',
						default: false,
						description: 'Whether to skip waiting for a response (fire and forget)',
					},
					{
						displayName: 'Tools (JSON)',
						name: 'tools',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						placeholder: '[{"name": "tool_name", "description": "..."}]',
						description: 'Tool definitions in JSON format (optional)',
					},
				],
			},

			// Options for command operation
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['command'],
					},
				},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 300000,
						description: 'Request timeout in milliseconds (default: 300000 = 5 minutes)',
					},
					{
						displayName: 'Trim Response',
						name: 'trimResponse',
						type: 'boolean',
						default: true,
						description: 'Whether to trim whitespace from the response text',
					},
					{
						displayName: 'Response Key',
						name: 'responseKey',
						type: 'string',
						default: 'response',
						description: 'The key name for the response text in the output JSON',
					},
					{
						displayName: 'Agent',
						name: 'agent',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getAgents',
						},
						default: '',
						description: 'Agent to use for the command (optional)',
					},
					{
						displayName: 'Reference Message ID',
						name: 'messageID',
						type: 'string',
						default: '',
						description: 'Reference message ID for context (optional)',
					},
				],
			},

			// Options for shell operation
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['shell'],
					},
				},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 300000,
						description: 'Request timeout in milliseconds (default: 300000 = 5 minutes)',
					},
					{
						displayName: 'Trim Response',
						name: 'trimResponse',
						type: 'boolean',
						default: true,
						description: 'Whether to trim whitespace from the response text',
					},
					{
						displayName: 'Response Key',
						name: 'responseKey',
						type: 'string',
						default: 'response',
						description: 'The key name for the response text in the output JSON',
					},
				],
			},

			// Options for skill operation
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['skill'],
					},
				},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 300000,
						description: 'Request timeout in milliseconds (default: 300000 = 5 minutes)',
					},
					{
						displayName: 'Trim Response',
						name: 'trimResponse',
						type: 'boolean',
						default: true,
						description: 'Whether to trim whitespace from the response text',
					},
					{
						displayName: 'Response Key',
						name: 'responseKey',
						type: 'string',
						default: 'response',
						description: 'The key name for the response text in the output JSON',
					},
					{
						displayName: 'Agent',
						name: 'agent',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getAgents',
						},
						default: '',
						description: 'Agent to use for the skill (optional)',
					},
					{
						displayName: 'Reference Message ID',
						name: 'messageID',
						type: 'string',
						default: '',
						description: 'Reference message ID for context (optional)',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getSessions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('openCodeApi');
					const baseUrl = credentials.baseUrl as string;

					const response = await this.helpers.request({
						method: 'GET',
						url: `${baseUrl}/session`,
						auth: {
							user: credentials.username as string,
							pass: credentials.password as string,
						},
						json: true,
					});

					const sessions = (Array.isArray(response) ? response : [response]) as ISession[];

					return sessions.map((session) => ({
						name: session.title || `Session ${session.id.substring(0, 8)}...`,
						value: session.id,
						description: `ID: ${session.id}`,
					}));
				} catch (error) {
					console.error('Error loading sessions:', error);
					return [{ name: 'Error loading sessions', value: '' }];
				}
			},

			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('openCodeApi');
					const baseUrl = credentials.baseUrl as string;

					const response = await this.helpers.request({
						method: 'GET',
						url: `${baseUrl}/config/providers`,
						auth: {
							user: credentials.username as string,
							pass: credentials.password as string,
						},
						json: true,
					});

					const options: INodePropertyOptions[] = [
						{ name: '(Default)', value: '' },
					];

					const providers = (response.providers || []) as Array<{
						id: string;
						name?: string;
						models?: Record<string, { id: string; name?: string; providerID?: string }>;
					}>;

					for (const provider of providers) {
						if (provider.models && typeof provider.models === 'object') {
							// models is an object, not an array
							const modelList = Object.values(provider.models);
							for (const model of modelList) {
								// value format: providerID::modelID (use :: as separator)
								options.push({
									name: `${provider.name || provider.id}: ${model.name || model.id}`,
									value: `${provider.id}::${model.id}`,
									description: `Provider: ${provider.id}`,
								});
							}
						}
					}

					return options;
				} catch (error) {
					console.error('Error loading models:', error);
					return [{ name: '(Default)', value: '' }];
				}
			},

			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('openCodeApi');
					const baseUrl = credentials.baseUrl as string;

					const response = await this.helpers.request({
						method: 'GET',
						url: `${baseUrl}/agent`,
						auth: {
							user: credentials.username as string,
							pass: credentials.password as string,
						},
						json: true,
					});

					const agents = (Array.isArray(response) ? response : []) as Array<{
						name: string;
						mode?: string;
					}>;

					// Find primary agent
					const primaryAgent = agents.find((a) => a.mode === 'primary');
					const otherAgents = agents.filter((a) => a.mode !== 'primary');

					const options: INodePropertyOptions[] = [];

					// Add primary agent first (will be default selection)
					if (primaryAgent) {
						options.push({
							name: `${primaryAgent.name} (Primary)`,
							value: primaryAgent.name,
							description: 'Primary agent',
						});
					}

					// Add other agents
					for (const agent of otherAgents) {
						options.push({
							name: agent.name,
							value: agent.name,
							description: agent.mode ? `Mode: ${agent.mode}` : undefined,
						});
					}

					return options;
				} catch (error) {
					console.error('Error loading agents:', error);
					return [{ name: '(Default)', value: '' }];
				}
			},

			async getCommands(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('openCodeApi');
					const baseUrl = credentials.baseUrl as string;

					const response = await this.helpers.request({
						method: 'GET',
						url: `${baseUrl}/command`,
						auth: {
							user: credentials.username as string,
							pass: credentials.password as string,
						},
						json: true,
					});

					const commands = (Array.isArray(response) ? response : []) as Array<{
						name: string;
						description?: string;
					}>;

					return commands.map((cmd) => ({
						name: cmd.name,
						value: cmd.name,
						description: cmd.description || `Command: ${cmd.name}`,
					}));
				} catch (error) {
					console.error('Error loading commands:', error);
					return [{ name: 'Error loading commands', value: '' }];
				}
			},

			async getSkills(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const homeDir = os.homedir();

					// Skill directories to scan
					const skillDirs = [
						path.join(homeDir, '.claude', 'skills'),
						path.join(homeDir, '.config', 'opencode', 'skill'),
						path.join(homeDir, '.opencode', 'skill'),
						path.join(process.cwd(), '.claude', 'skills'),
					];

					// Collect all skills from all directories
					const allSkills: ISkillInfo[] = [];
					const seenNames = new Set<string>();

					for (const dir of skillDirs) {
						const skills = scanSkillDirectory(dir);
						for (const skill of skills) {
							// Avoid duplicates by name
							if (!seenNames.has(skill.name)) {
								seenNames.add(skill.name);
								allSkills.push(skill);
							}
						}
					}

					// Sort by name
					allSkills.sort((a, b) => a.name.localeCompare(b.name));

					if (allSkills.length === 0) {
						return [{ name: 'No skills found', value: '' }];
					}

					return allSkills.map((skill) => ({
						name: skill.name,
						value: skill.name,
						description: skill.description.length > 100
							? skill.description.substring(0, 100) + '...'
							: skill.description,
					}));
				} catch (error) {
					console.error('Error loading skills:', error);
					return [{ name: 'Error loading skills', value: '' }];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const results = await executeAction.call(this, resource, operation, i);
				returnData.push(...results);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
