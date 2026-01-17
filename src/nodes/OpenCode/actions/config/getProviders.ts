import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function getProviders(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);

	const response = await openCodeApiRequest.call(this, credentials, {
		method: 'GET',
		endpoint: '/config/providers',
	});

	return [
		{
			json: response as IDataObject,
			pairedItem: { item: itemIndex },
		},
	];
}
