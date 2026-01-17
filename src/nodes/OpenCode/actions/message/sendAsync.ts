import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials, createSession, deleteSession } from '../../helpers/api';

export async function sendMessageAsync(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionMode = this.getNodeParameter('sessionMode', itemIndex, 'existing') as string;
	const message = this.getNodeParameter('message', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex, '') as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	// Extract options with defaults
	const timeout = (options.timeout as number) ?? 300000;
	const agent = (options.agent as string) || '';
	const messageID = (options.messageID as string) || '';
	const system = (options.system as string) || '';
	const noReply = (options.noReply as boolean) ?? false;
	const toolsJson = (options.tools as string) || '';

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
		const payload: IDataObject = {
			parts: [{ type: 'text', text: message }],
		};

		// model format: "providerID::modelID"
		if (model && model.includes('::')) {
			const [providerID, modelID] = model.split('::');
			payload.model = { providerID, modelID };
		}

		// Add optional parameters
		if (agent) {
			payload.agent = agent;
		}
		if (messageID) {
			payload.messageID = messageID;
		}
		if (system) {
			payload.system = system;
		}
		if (noReply) {
			payload.noReply = noReply;
		}
		if (toolsJson) {
			try {
				payload.tools = JSON.parse(toolsJson);
			} catch {
				// If not valid JSON, ignore
			}
		}

		await openCodeApiRequest.call(this, credentials, {
			method: 'POST',
			endpoint: `/session/${sessionId}/prompt_async`,
			body: payload,
			timeout,
		});

		return [
			{
				json: {
					success: true,
					message: 'Message sent successfully (async)',
					sessionId,
					wasTemporarySession: shouldDeleteSession,
				},
				pairedItem: { item: itemIndex },
			},
		];
	} finally {
		// Delete temporary session after use
		// Note: For async, the session is deleted immediately after sending
		// The response may not be available if using temporary session
		if (shouldDeleteSession) {
			await deleteSession(this, credentials, sessionId);
		}
	}
}
