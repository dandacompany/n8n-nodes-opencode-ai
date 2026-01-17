import { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export interface IOpenCodeCredentials {
	baseUrl: string;
	username: string;
	password: string;
}

export interface INodeContext {
	execute: IExecuteFunctions;
	credentials: IOpenCodeCredentials;
	itemIndex: number;
}

export interface ISession {
	id: string;
	title: string;
	createdAt: string;
	updatedAt?: string;
	messages?: IMessage[];
}

export interface IMessage {
	id: string;
	sessionID: string;
	role: 'user' | 'assistant';
	parts: IMessagePart[];
	info?: IMessageInfo;
	createdAt?: string;
}

export interface IMessagePart {
	type: 'text' | 'tool_use' | 'tool_result' | 'tool';
	text?: string;
	toolName?: string;
	toolInput?: IDataObject;
	toolResult?: string;
	// For shell tool response
	id?: string;
	messageID?: string;
	sessionID?: string;
	tool?: string;
	callID?: string;
	state?: {
		status?: string;
		time?: { start?: number; end?: number };
		input?: IDataObject;
		output?: string;
		metadata?: { output?: string; description?: string };
	};
}

export interface IMessageInfo {
	id: string;
	sessionID: string;
	modelID: string;
	providerID: string;
	tokens: {
		input: number;
		output: number;
	};
	cost: {
		input: number;
		output: number;
		total: number;
	};
}

export interface IProvider {
	id: string;
	name: string;
	models: IModel[];
}

export interface IModel {
	id: string;
	name: string;
	description?: string;
}

export interface ISendMessageRequest {
	parts: IMessagePart[];
	model?: string;
	agent?: string;
	system?: string;
}

export interface ISendMessageResponse {
	info: IMessageInfo;
	parts: IMessagePart[];
}

export interface ISessionStatus {
	[sessionId: string]: {
		status: 'idle' | 'running' | 'error';
		lastActivity?: string;
	};
}

export type ResourceType = 'session' | 'message' | 'config';

export type SessionOperation = 'list' | 'get' | 'create' | 'delete' | 'abort' | 'status';
export type MessageOperation = 'send' | 'sendAsync' | 'list' | 'get' | 'command' | 'shell';
export type ConfigOperation = 'getProviders';

export interface IActionResult {
	json: IDataObject;
	binary?: IDataObject;
}
