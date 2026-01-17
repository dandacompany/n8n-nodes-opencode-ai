import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sendMessage } from './send';
import { sendMessageAsync } from './sendAsync';
import { listMessages } from './list';
import { getMessage } from './getMessage';
import { executeCommand } from './command';
import { executeShell } from './shell';

export async function executeMessageAction(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'send':
			return sendMessage.call(this, itemIndex);
		case 'sendAsync':
			return sendMessageAsync.call(this, itemIndex);
		case 'list':
			return listMessages.call(this, itemIndex);
		case 'get':
			return getMessage.call(this, itemIndex);
		case 'command':
			return executeCommand.call(this, itemIndex);
		case 'shell':
			return executeShell.call(this, itemIndex);
		default:
			throw new Error(`Unknown message operation: ${operation}`);
	}
}

export { sendMessage, sendMessageAsync, listMessages, getMessage, executeCommand, executeShell };
