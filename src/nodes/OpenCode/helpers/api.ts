import {
	IExecuteFunctions,
	IHttpRequestMethods,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { IOpenCodeCredentials } from '../types';

export interface IApiRequestOptions {
	method: IHttpRequestMethods;
	endpoint: string;
	body?: IDataObject;
	qs?: IDataObject;
	timeout?: number;
}

export async function openCodeApiRequest(
	this: IExecuteFunctions,
	credentials: IOpenCodeCredentials,
	options: IApiRequestOptions,
): Promise<IDataObject | IDataObject[]> {
	const { method, endpoint, body, qs, timeout } = options;

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${credentials.baseUrl}${endpoint}`,
		headers: {
			'Content-Type': 'application/json',
		},
		body,
		qs,
		json: true,
		timeout: timeout ?? 300000, // Default: 5 minutes timeout
		// Basic Auth
		auth: {
			username: credentials.username,
			password: credentials.password,
		},
	};

	try {
		const response = await this.helpers.httpRequest(requestOptions);
		return response as IDataObject | IDataObject[];
	} catch (error) {
		const errorMessage = (error as Error).message || 'Unknown error';
		throw new Error(`OpenCode API request failed: ${errorMessage}`);
	}
}

export async function getCredentials(
	execute: IExecuteFunctions,
): Promise<IOpenCodeCredentials> {
	const credentials = await execute.getCredentials('openCodeApi');
	return {
		baseUrl: credentials.baseUrl as string,
		username: credentials.username as string,
		password: credentials.password as string,
	};
}

export async function createSession(
	execute: IExecuteFunctions,
	credentials: IOpenCodeCredentials,
	title: string,
): Promise<string> {
	const response = await openCodeApiRequest.call(execute, credentials, {
		method: 'POST',
		endpoint: '/session',
		body: { title },
	}) as IDataObject;
	return response.id as string;
}

export async function deleteSession(
	execute: IExecuteFunctions,
	credentials: IOpenCodeCredentials,
	sessionId: string,
): Promise<void> {
	try {
		await openCodeApiRequest.call(execute, credentials, {
			method: 'DELETE',
			endpoint: `/session/${sessionId}`,
		});
	} catch (error) {
		console.error(`Failed to delete session ${sessionId}:`, error);
	}
}
