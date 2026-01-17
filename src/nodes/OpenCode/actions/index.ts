import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { executeSessionAction } from './session';
import { executeMessageAction } from './message';
import { executeConfigAction } from './config';

export async function executeAction(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (resource) {
		case 'session':
			return executeSessionAction.call(this, operation, itemIndex);
		case 'message':
			return executeMessageAction.call(this, operation, itemIndex);
		case 'config':
			return executeConfigAction.call(this, operation, itemIndex);
		default:
			throw new Error(`Unknown resource: ${resource}`);
	}
}

export { executeSessionAction } from './session';
export { executeMessageAction } from './message';
export { executeConfigAction } from './config';
