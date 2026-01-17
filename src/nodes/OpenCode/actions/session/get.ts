import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function getSession(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;

	const response = await openCodeApiRequest.call(this, credentials, {
		method: 'GET',
		endpoint: `/session/${sessionId}`,
	});

	return [
		{
			json: response as IDataObject,
			pairedItem: { item: itemIndex },
		},
	];
}
