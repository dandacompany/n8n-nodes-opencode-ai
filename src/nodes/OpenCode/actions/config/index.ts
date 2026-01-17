import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getProviders } from './getProviders';

export async function executeConfigAction(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getProviders':
			return getProviders.call(this, itemIndex);
		default:
			throw new Error(`Unknown config operation: ${operation}`);
	}
}

export { getProviders };
