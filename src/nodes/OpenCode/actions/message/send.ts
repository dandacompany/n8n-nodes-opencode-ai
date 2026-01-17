import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials, createSession, deleteSession } from '../../helpers/api';
import { ISendMessageResponse, IMessagePart } from '../../types';

export async function sendMessage(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionMode = this.getNodeParameter('sessionMode', itemIndex, 'existing') as string;
	const message = this.getNodeParameter('message', itemIndex) as string;
	const simpleResponse = this.getNodeParameter('simpleResponse', itemIndex, false) as boolean;
	const model = this.getNodeParameter('model', itemIndex, '') as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	// Extract options with defaults
	const timeout = (options.timeout as number) ?? 300000;
	const trimResponse = (options.trimResponse as boolean) ?? true;
	const responseKey = (options.responseKey as string) || 'response';
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

		const response = (await openCodeApiRequest.call(this, credentials, {
			method: 'POST',
			endpoint: `/session/${sessionId}/message`,
			body: payload,
			timeout,
		})) as unknown as ISendMessageResponse;

		// Extract text response
		let responseText = (response.parts || [])
			.filter((p: IMessagePart) => p.type === 'text')
			.map((p: IMessagePart) => p.text || '')
			.join('\n');

		// Apply trim if enabled
		if (trimResponse) {
			responseText = responseText.trim();
		}

		if (simpleResponse) {
			// Try to parse as JSON if possible
			try {
				const parsedJson = JSON.parse(responseText);
				return [
					{
						json: parsedJson as IDataObject,
						pairedItem: { item: itemIndex },
					},
				];
			} catch {
				return [
					{
						json: { [responseKey]: responseText },
						pairedItem: { item: itemIndex },
					},
				];
			}
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
					wasTemporarySession: shouldDeleteSession,
					[responseKey]: responseText,
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
