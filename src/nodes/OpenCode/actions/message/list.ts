import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';
import { IMessage } from '../../types';

export async function listMessages(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

	// Build query parameters
	const queryParams: Record<string, string> = {};
	if (limit && limit > 0) {
		queryParams.limit = limit.toString();
	}

	// Build query string
	const queryString = Object.keys(queryParams).length > 0
		? '?' + new URLSearchParams(queryParams).toString()
		: '';

	const response = (await openCodeApiRequest.call(this, credentials, {
		method: 'GET',
		endpoint: `/session/${sessionId}/message${queryString}`,
	})) as unknown as IMessage[];

	const messages = Array.isArray(response) ? response : [];

	if (messages.length === 0) {
		return [
			{
				json: { messages: [], count: 0, sessionId },
				pairedItem: { item: itemIndex },
			},
		];
	}

	return messages.map((msg) => ({
		json: msg as unknown as IDataObject,
		pairedItem: { item: itemIndex },
	}));
}
