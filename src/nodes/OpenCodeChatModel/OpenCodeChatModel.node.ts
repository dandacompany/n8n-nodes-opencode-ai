import {
	ISupplyDataFunctions,
	ILoadOptionsFunctions,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	IDataObject,
	SupplyData,
} from 'n8n-workflow';
import { ChatOpenCode } from './ChatOpenCode';

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

export class OpenCodeChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenCode Chat Model',
		name: 'lmChatOpenCode',
		icon: 'file:opencode.svg',
		group: ['transform'],
		version: 1,
		description: 'Use OpenCode as a Chat Model for AI Agents',
		defaults: {
			name: 'OpenCode Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
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
		outputs: ['ai_languageModel'],
		outputNames: ['Model'],
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
				description: 'Select an OpenCode session to use for the chat model',
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
				default: 'Temporary Chat Session',
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
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const timeout = (options.timeout as number) ?? 300000;

		// Determine session configuration based on mode
		const useTemporarySession = sessionMode === 'temporary';
		let sessionId: string | undefined;
		let tempSessionTitle: string | undefined;

		if (useTemporarySession) {
			tempSessionTitle = this.getNodeParameter('tempSessionTitle', itemIndex, 'Temporary Chat Session') as string;
		} else {
			sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
		}

		const chatModel = new ChatOpenCode({
			baseUrl: credentials.baseUrl,
			username: credentials.username,
			password: credentials.password,
			sessionId,
			model: model || undefined,
			timeout,
			useTemporarySession,
			tempSessionTitle,
		});

		return {
			response: chatModel,
		};
	}
}
