import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function abortSession(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;

	const response = await openCodeApiRequest.call(this, credentials, {
		method: 'POST',
		endpoint: `/session/${sessionId}/abort`,
	});

	return [
		{
			json: (response as IDataObject) || {
				success: true,
				message: `Session ${sessionId} aborted`,
				sessionId,
			},
			pairedItem: { item: itemIndex },
		},
	];
}
