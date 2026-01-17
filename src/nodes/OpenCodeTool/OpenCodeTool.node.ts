import {
	ISupplyDataFunctions,
	ILoadOptionsFunctions,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	IDataObject,
	IHttpRequestOptions,
	SupplyData,
} from 'n8n-workflow';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

interface IOpenCodeCredentials {
	baseUrl: string;
	username: string;
	password: string;
}

interface ISession {
	id: string;
	title?: string;
}

interface IProvider {
	id: string;
	name?: string;
	models?: Record<string, { id: string; name?: string }>;
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

export class OpenCodeTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenCode Tool',
		name: 'openCodeTool',
		icon: 'file:opencode.svg',
		group: ['transform'],
		version: 1,
		description: 'Use OpenCode AI coding assistant as a tool for AI agents',
		defaults: {
			name: 'OpenCode Tool',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://opencode.ai/docs/server/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: ['ai_tool'],
		outputNames: ['Tool'],
		credentials: [
			{
				name: 'openCodeApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Session Mode',
				name: 'sessionMode',
				type: 'options',
				options: [
					{
						name: 'Use Existing Session',
						value: 'existing',
						description: 'Use an existing session for conversations',
					},
					{
						name: 'Temporary Session',
						value: 'temporary',
						description: 'Create a new session for each request and delete it after response',
					},
				],
				default: 'existing',
				description: 'Choose how to handle sessions',
			},
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
						sessionMode: ['existing'],
					},
				},
				default: '',
				description: 'Select a session for the AI tool to use',
			},
			{
				displayName: 'Temporary Session Title',
				name: 'tempSessionTitle',
				type: 'string',
				displayOptions: {
					show: {
						sessionMode: ['temporary'],
					},
				},
				default: 'Temporary Tool Session',
				description: 'Title for temporary sessions (for debugging purposes)',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				description: 'Select a model (optional, uses default if not specified)',
			},
			{
				displayName: 'Tool Name',
				name: 'toolName',
				type: 'string',
				default: 'opencode',
				description: 'The name of the tool that will be used by the AI agent',
			},
			{
				displayName: 'Tool Description',
				name: 'toolDescription',
				type: 'string',
				default: 'Use this tool to interact with OpenCode AI coding assistant. Send coding questions, code review requests, or programming tasks.',
				description: 'Description of the tool that will be shown to the AI agent',
				typeOptions: {
					rows: 3,
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 300000,
						description: 'Request timeout in milliseconds (default: 300000 = 5 minutes)',
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
					}) as { providers?: IProvider[] };

					const options: INodePropertyOptions[] = [
						{ name: '(Default)', value: '' },
					];

					const providers = (response.providers || []) as IProvider[];

					for (const provider of providers) {
						if (provider.models && typeof provider.models === 'object') {
							const modelList = Object.values(provider.models);
							for (const model of modelList) {
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
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('openCodeApi') as IOpenCodeCredentials;
		const sessionMode = this.getNodeParameter('sessionMode', itemIndex) as string;
		const model = this.getNodeParameter('model', itemIndex, '') as string;
		const toolName = this.getNodeParameter('toolName', itemIndex) as string;
		const toolDescription = this.getNodeParameter('toolDescription', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const timeout = (options.timeout as number) ?? 300000;

		// Determine session configuration based on mode
		const useTemporarySession = sessionMode === 'temporary';
		let existingSessionId: string | undefined;
		let tempSessionTitle: string | undefined;

		if (useTemporarySession) {
			tempSessionTitle = this.getNodeParameter('tempSessionTitle', itemIndex, 'Temporary Tool Session') as string;
		} else {
			existingSessionId = this.getNodeParameter('sessionId', itemIndex) as string;
		}

		// Helper functions for session management
		const createSession = async (title: string): Promise<string> => {
			const requestOptions: IHttpRequestOptions = {
				method: 'POST',
				url: `${credentials.baseUrl}/session`,
				headers: {
					'Content-Type': 'application/json',
				},
				body: { title },
				json: true,
				auth: {
					username: credentials.username,
					password: credentials.password,
				},
			};

			const response = await this.helpers.httpRequest(requestOptions) as ICreateSessionResponse;
			return response.id;
		};

		const deleteSession = async (sessionId: string): Promise<void> => {
			try {
				const requestOptions: IHttpRequestOptions = {
					method: 'DELETE',
					url: `${credentials.baseUrl}/session/${sessionId}`,
					auth: {
						username: credentials.username,
						password: credentials.password,
					},
				};
				await this.helpers.httpRequest(requestOptions);
			} catch (error) {
				console.error(`Failed to delete session ${sessionId}:`, error);
			}
		};

		const sendMessage = async (message: string): Promise<string> => {
			let sessionId: string;
			let shouldDeleteSession = false;

			// Create temporary session if needed
			if (useTemporarySession) {
				sessionId = await createSession(tempSessionTitle || 'Temporary Tool Session');
				shouldDeleteSession = true;
			} else {
				sessionId = existingSessionId!;
			}

			try {
				const payload: IDataObject = {
					parts: [{ type: 'text', text: message }],
				};

				// model format: "providerID::modelID"
				if (model && model.includes('::')) {
					const [providerID, modelID] = model.split('::');
					payload.model = { providerID, modelID };
				}

				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: `${credentials.baseUrl}/session/${sessionId}/message`,
					headers: {
						'Content-Type': 'application/json',
					},
					body: payload,
					json: true,
					timeout,
					auth: {
						username: credentials.username,
						password: credentials.password,
					},
				};

				const response = await this.helpers.httpRequest(requestOptions) as ISendMessageResponse;

				const responseText = (response.parts || [])
					.filter((p: IMessagePart) => p.type === 'text')
					.map((p: IMessagePart) => p.text || '')
					.join('\n')
					.trim();

				return responseText;
			} finally {
				// Delete temporary session after use
				if (shouldDeleteSession) {
					await deleteSession(sessionId);
				}
			}
		};

		const tool = new DynamicStructuredTool({
			name: toolName,
			description: toolDescription,
			schema: z.object({
				message: z.string().describe('The message or question to send to OpenCode AI'),
			}),
			func: async ({ message }) => {
				return await sendMessage(message);
			},
		});

		return {
			response: tool,
		};
	}
}
