import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';

export async function deleteSession(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;

	await openCodeApiRequest.call(this, credentials, {
		method: 'DELETE',
		endpoint: `/session/${sessionId}`,
	});

	return [
		{
			json: {
				success: true,
				message: `Session ${sessionId} deleted successfully`,
				sessionId,
			},
			pairedItem: { item: itemIndex },
		},
	];
}
