import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials, createSession, deleteSession } from '../../helpers/api';
import { ISendMessageResponse, IMessagePart } from '../../types';

export async function executeSkill(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionMode = this.getNodeParameter('sessionMode', itemIndex, 'existing') as string;
	const skill = this.getNodeParameter('skill', itemIndex) as string;
	const skillArguments = this.getNodeParameter('skillArguments', itemIndex, '') as string;
	const model = this.getNodeParameter('model', itemIndex, '') as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	// Extract options with defaults
	const timeout = (options.timeout as number) ?? 300000;
	const trimResponse = (options.trimResponse as boolean) ?? true;
	const responseKey = (options.responseKey as string) || 'response';
	const agent = (options.agent as string) || '';
	const messageId = (options.messageID as string) || '';

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
		// Build message text: /skill-name arguments
		// Using message API with slash command format
		const skillText = skillArguments
			? `/${skill} ${skillArguments}`
			: `/${skill}`;

		// Build payload using message API format with parts array
		const payload: IDataObject = {
			parts: [
				{
					type: 'text',
					text: skillText,
				},
			],
		};

		// Add optional parameters
		if (messageId) {
			payload.messageID = messageId;
		}

		if (agent) {
			payload.agent = agent;
		}

		// model format: "providerID::modelID" -> convert to {providerID, modelID} object for message API
		if (model && model.includes('::')) {
			const [providerID, modelID] = model.split('::');
			payload.model = { providerID, modelID };
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
					skill,
					skillArguments,
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
