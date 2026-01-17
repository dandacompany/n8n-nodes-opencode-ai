import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { openCodeApiRequest, getCredentials } from '../../helpers/api';
import { IMessage } from '../../types';

export async function getMessage(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credentials = await getCredentials(this);
	const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
	const messageId = this.getNodeParameter('targetMessageId', itemIndex) as string;

	const response = (await openCodeApiRequest.call(this, credentials, {
		method: 'GET',
		endpoint: `/session/${sessionId}/message/${messageId}`,
	})) as unknown as IMessage;

	return [
		{
			json: response as unknown as IDataObject,
			pairedItem: { item: itemIndex },
		},
	];
}
