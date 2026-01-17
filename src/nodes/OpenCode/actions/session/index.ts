import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { listSessions } from './list';
import { getSession } from './get';
import { createSession } from './create';
import { deleteSession } from './delete';
import { abortSession } from './abort';
import { getSessionStatus } from './status';

export async function executeSessionAction(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'list':
			return listSessions.call(this, itemIndex);
		case 'get':
			return getSession.call(this, itemIndex);
		case 'create':
			return createSession.call(this, itemIndex);
		case 'delete':
			return deleteSession.call(this, itemIndex);
		case 'abort':
			return abortSession.call(this, itemIndex);
		case 'status':
			return getSessionStatus.call(this, itemIndex);
		default:
			throw new Error(`Unknown session operation: ${operation}`);
	}
}

export { listSessions, getSession, createSession, deleteSession, abortSession, getSessionStatus };
