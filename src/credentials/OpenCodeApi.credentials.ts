import {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OpenCodeApi implements ICredentialType {
	name = 'openCodeApi';
	displayName = 'OpenCode API';
	documentationUrl = 'https://opencode.ai/docs/server/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://127.0.0.1:4096',
			required: true,
			description: 'The base URL of the OpenCode server (e.g., http://127.0.0.1:4096)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Username for Basic Auth (OPENCODE_SERVER_USERNAME)',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Password for Basic Auth (OPENCODE_SERVER_PASSWORD)',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/session',
			method: 'GET',
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
