import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials, createSession, deleteSession } from '../../helpers/api';
import { ISendMessageResponse, IMessagePart } from '../../types';

export async function executeShell(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionMode = this.getNodeParameter('sessionMode', itemIndex, 'existing') as string;
	const shellCommand = this.getNodeParameter('shellCommand', itemIndex) as string;
	const agent = this.getNodeParameter('shellAgent', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex, '') as string;
	const simpleResponse = this.getNodeParameter('simpleResponse', itemIndex, false) as boolean;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	// Extract options with defaults
	const timeout = (options.timeout as number) ?? 300000;
	const trimResponse = (options.trimResponse as boolean) ?? true;
	const responseKey = (options.responseKey as string) || 'response';

	// Determine session ID based on mode
	let sessionId: string;
	let shouldDeleteSession = false;

	if (sessionMode === 'temporary') {
		const tempSessionTitle = this.getNodeParameter('tempSessionTitle', itemIndex, 'Temporary Chat Session') as string;
		sessionId = await createSession(this, credentials, tempSessionTitle);
		shouldDeleteSession = true;
	} else {
		sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
	}

	try {
		// Build payload
		const payload: IDataObject = {
			command: shellCommand,
			agent,
		};

		// model format: "providerID::modelID"
		if (model && model.includes('::')) {
			const [providerID, modelID] = model.split('::');
			payload.model = { providerID, modelID };
		}

		const response = (await openCodeApiRequest.call(this, credentials, {
			method: 'POST',
			endpoint: `/session/${sessionId}/shell`,
			body: payload,
			timeout,
		})) as unknown as ISendMessageResponse;

		// Extract shell output from tool parts
		// Shell response has parts with type 'tool' and state.output containing the command output
		let shellOutput = '';
		const parts = response.parts || [];

		for (const part of parts) {
			if (part.type === 'tool' && part.state) {
				// Try to get output from state.output or state.metadata.output
				const output = part.state.output || part.state.metadata?.output || '';
				if (output) {
					shellOutput += output;
				}
			}
		}

		// Apply trim if enabled
		if (trimResponse) {
			shellOutput = shellOutput.trim();
		}

		// Simple response - return only the shell output
		if (simpleResponse) {
			return [
				{
					json: {
						[responseKey]: shellOutput,
					},
					pairedItem: { item: itemIndex },
				},
			];
		}

		// Full response with metadata
		return [
			{
				json: {
					messageId: response.info?.id,
					sessionId: response.info?.sessionID || sessionId,
					model: response.info?.modelID,
					provider: response.info?.providerID,
					tokens: response.info?.tokens,
					cost: response.info?.cost,
					command: shellCommand,
					agent,
					wasTemporarySession: shouldDeleteSession,
					[responseKey]: shellOutput,
					parts: response.parts,
				},
				pairedItem: { item: itemIndex },
			},
		];
	} finally {
		// Delete temporary session after use
		if (shouldDeleteSession) {
			await deleteSession(this, credentials, sessionId);
		}
	}
}
