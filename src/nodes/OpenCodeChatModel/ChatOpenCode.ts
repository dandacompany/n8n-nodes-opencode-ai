import {
	BaseChatModel,
	type BaseChatModelParams,
	type BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import { type BaseMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { type ChatResult, type ChatGeneration } from '@langchain/core/outputs';
import { type CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableToolLike } from '@langchain/core/runnables';

export interface ChatOpenCodeInput extends BaseChatModelParams {
	baseUrl: string;
	username: string;
	password: string;
	sessionId?: string;
	model?: string;
	timeout?: number;
	useTemporarySession?: boolean;
	tempSessionTitle?: string;
}

interface IMessagePart {
	type: string;
	text?: string;
}

interface ISendMessageResponse {
	parts?: IMessagePart[];
	info?: {
		id?: string;
		sessionID?: string;
		modelID?: string;
		providerID?: string;
		tokens?: {
			input?: number;
			output?: number;
		};
		cost?: number;
	};
}

interface ICreateSessionResponse {
	id: string;
	title?: string;
}

interface ToolDefinition {
	name: string;
	description: string;
	schema?: Record<string, unknown>;
}

interface ParsedToolCall {
	name: string;
	args: Record<string, unknown>;
	id: string;
}

export interface ChatOpenCodeCallOptions extends BaseChatModelCallOptions {
	tools?: ToolDefinition[];
}

export class ChatOpenCode extends BaseChatModel<ChatOpenCodeCallOptions> {
	baseUrl: string;
	username: string;
	password: string;
	sessionId?: string;
	model?: string;
	timeout: number;
	useTemporarySession: boolean;
	tempSessionTitle: string;
	boundTools?: ToolDefinition[];

	static lc_name(): string {
		return 'ChatOpenCode';
	}

	constructor(fields: ChatOpenCodeInput & { boundTools?: ToolDefinition[] }) {
		super(fields);
		this.baseUrl = fields.baseUrl;
		this.username = fields.username;
		this.password = fields.password;
		this.sessionId = fields.sessionId;
		this.model = fields.model;
		this.timeout = fields.timeout ?? 300000;
		this.useTemporarySession = fields.useTemporarySession ?? false;
		this.tempSessionTitle = fields.tempSessionTitle ?? 'Temporary Chat Session';
		this.boundTools = fields.boundTools;
	}

	_llmType(): string {
		return 'opencode';
	}

	private getAuthHeader(): string {
		return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
	}

	private async createSession(title: string): Promise<string> {
		const response = await fetch(`${this.baseUrl}/session`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': this.getAuthHeader(),
			},
			body: JSON.stringify({ title }),
		});

		if (!response.ok) {
			throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
		}

		const data = await response.json() as ICreateSessionResponse;
		return data.id;
	}

	private async deleteSession(sessionId: string): Promise<void> {
		const response = await fetch(`${this.baseUrl}/session/${sessionId}`, {
			method: 'DELETE',
			headers: {
				'Authorization': this.getAuthHeader(),
			},
		});

		if (!response.ok) {
			console.error(`Failed to delete session ${sessionId}: ${response.status} ${response.statusText}`);
		}
	}

	/**
	 * Bind tools to the model for function calling support
	 */
	override bindTools(
		tools: (StructuredToolInterface | RunnableToolLike | ToolDefinition)[],
	): ChatOpenCode {
		const toolDefinitions: ToolDefinition[] = tools.map((tool) => {
			// Cast to unknown first for safe type handling
			const toolObj = tool as unknown as Record<string, unknown>;
			const name = String(toolObj.name || 'unknown');
			const description = String(toolObj.description || '');
			const schema = toolObj.schema as Record<string, unknown> | undefined;

			return { name, description, schema };
		});

		return new ChatOpenCode({
			baseUrl: this.baseUrl,
			username: this.username,
			password: this.password,
			sessionId: this.sessionId,
			model: this.model,
			timeout: this.timeout,
			useTemporarySession: this.useTemporarySession,
			tempSessionTitle: this.tempSessionTitle,
			boundTools: toolDefinitions,
		});
	}

	/**
	 * Format tools as a system prompt for models that don't have native tool support
	 */
	private formatToolsAsPrompt(tools: ToolDefinition[]): string {
		const toolDescriptions = tools.map((tool) => {
			let desc = `- ${tool.name}: ${tool.description}`;
			if (tool.schema) {
				desc += `\n  Parameters: ${JSON.stringify(tool.schema, null, 2)}`;
			}
			return desc;
		}).join('\n\n');

		return `You have access to the following tools. To use a tool, respond with a JSON object in the following format:
{"tool": "tool_name", "args": {"arg1": "value1", "arg2": "value2"}}

Available tools:
${toolDescriptions}

If you need to use a tool, respond ONLY with the JSON object. If you don't need to use a tool, respond normally with text.`;
	}

	/**
	 * Parse tool calls from the response text
	 */
	private parseToolCalls(responseText: string): ParsedToolCall[] {
		const toolCalls: ParsedToolCall[] = [];

		// Try to find JSON tool calls in the response
		const jsonPattern = /\{[\s\S]*?"tool"[\s\S]*?:[\s\S]*?"[\w]+"[\s\S]*?,[\s\S]*?"args"[\s\S]*?:[\s\S]*?\{[\s\S]*?\}[\s\S]*?\}/g;
		const matches = responseText.match(jsonPattern);

		if (matches) {
			for (const match of matches) {
				try {
					const parsed = JSON.parse(match);
					if (parsed.tool && typeof parsed.tool === 'string') {
						toolCalls.push({
							name: parsed.tool,
							args: parsed.args || {},
							id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						});
					}
				} catch {
					// Not valid JSON, skip
				}
			}
		}

		return toolCalls;
	}

	async _generate(
		messages: BaseMessage[],
		options: this['ParsedCallOptions'],
		_runManager?: CallbackManagerForLLMRun,
	): Promise<ChatResult> {
		let sessionId = this.sessionId;
		let shouldDeleteSession = false;

		// Create temporary session if needed
		if (this.useTemporarySession) {
			sessionId = await this.createSession(this.tempSessionTitle);
			shouldDeleteSession = true;
		}

		if (!sessionId) {
			throw new Error('No session ID provided and temporary session mode is not enabled');
		}

		try {
			// Get tools from bound tools or options
			const tools = this.boundTools || options?.tools || [];

			// Prepare messages with tool prompt if tools are available
			let processedMessages = [...messages];
			if (tools.length > 0) {
				const toolPrompt = this.formatToolsAsPrompt(tools);
				// Add tool prompt as system message at the beginning
				processedMessages = [new SystemMessage(toolPrompt), ...messages];
			}

			// Convert messages to text (combine all messages for context)
			const messageTexts: string[] = [];
			for (const msg of processedMessages) {
				let prefix = '';
				if (msg._getType() === 'system') {
					prefix = '[System]: ';
				} else if (msg._getType() === 'human') {
					prefix = '[User]: ';
				} else if (msg._getType() === 'ai') {
					prefix = '[Assistant]: ';
				}

				if (typeof msg.content === 'string') {
					messageTexts.push(prefix + msg.content);
				} else if (Array.isArray(msg.content)) {
					const text = msg.content
						.filter((part): part is { type: 'text'; text: string } =>
							typeof part === 'object' && part.type === 'text'
						)
						.map((part) => part.text)
						.join('\n');
					if (text) {
						messageTexts.push(prefix + text);
					}
				}
			}

			const messageText = messageTexts.join('\n\n');

			// Build request payload
			const payload: Record<string, unknown> = {
				parts: [{ type: 'text', text: messageText }],
			};

			// Add model if specified
			if (this.model && this.model.includes('::')) {
				const [providerID, modelID] = this.model.split('::');
				payload.model = { providerID, modelID };
			}

			// Make API request
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.timeout);

			try {
				const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': this.getAuthHeader(),
					},
					body: JSON.stringify(payload),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`OpenCode API error: ${response.status} ${response.statusText}`);
				}

				const data = await response.json() as ISendMessageResponse;

				// Extract text response
				const responseText = (data.parts || [])
					.filter((p: IMessagePart) => p.type === 'text')
					.map((p: IMessagePart) => p.text || '')
					.join('\n')
					.trim();

				// Build token usage info
				const tokenUsage = {
					promptTokens: data.info?.tokens?.input ?? 0,
					completionTokens: data.info?.tokens?.output ?? 0,
					totalTokens: (data.info?.tokens?.input ?? 0) + (data.info?.tokens?.output ?? 0),
				};

				// Check for tool calls in the response
				const toolCalls = tools.length > 0 ? this.parseToolCalls(responseText) : [];

				// Create AIMessage with or without tool calls
				let aiMessage: AIMessage;
				if (toolCalls.length > 0) {
					aiMessage = new AIMessage({
						content: responseText,
						tool_calls: toolCalls.map(tc => ({
							name: tc.name,
							args: tc.args,
							id: tc.id,
							type: 'tool_call' as const,
						})),
					});
				} else {
					aiMessage = new AIMessage(responseText);
				}

				const generation: ChatGeneration = {
					text: responseText,
					message: aiMessage,
					generationInfo: {
						messageId: data.info?.id,
						modelID: data.info?.modelID,
						providerID: data.info?.providerID,
						cost: data.info?.cost,
						sessionId: sessionId,
						wasTemporarySession: shouldDeleteSession,
						toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
					},
				};

				return {
					generations: [generation],
					llmOutput: {
						tokenUsage,
						modelId: data.info?.modelID,
						providerId: data.info?.providerID,
					},
				};
			} catch (error) {
				clearTimeout(timeoutId);
				if (error instanceof Error && error.name === 'AbortError') {
					throw new Error(`OpenCode API request timeout after ${this.timeout}ms`);
				}
				throw error;
			}
		} finally {
			// Delete temporary session after use
			if (shouldDeleteSession && sessionId) {
				await this.deleteSession(sessionId);
			}
		}
	}
}
