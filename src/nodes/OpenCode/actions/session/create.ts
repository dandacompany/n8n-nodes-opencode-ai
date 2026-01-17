import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function createSession(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const title = this.getNodeParameter('title', itemIndex, 'New Session') as string;

	const response = await openCodeApiRequest.call(this, credentials, {
		method: 'POST',
		endpoint: '/session',
		body: { title },
	});

	return [
		{
			json: response as IDataObject,
			pairedItem: { item: itemIndex },
		},
	];
}
