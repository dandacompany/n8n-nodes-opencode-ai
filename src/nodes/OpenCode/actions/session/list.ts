import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function listSessions(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);

	const response = await openCodeApiRequest.call(this, credentials, {
		method: 'GET',
		endpoint: '/session',
	});

	const sessions = Array.isArray(response) ? response : [response];

	return sessions.map((session) => ({
		json: session as IDataObject,
		pairedItem: { item: itemIndex },
	}));
}
