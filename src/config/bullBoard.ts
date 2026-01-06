import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { routeQueue, receiptQueue } from './queues';

/**
 * Creates and configures the Bull Board dashboard for BullMQ queues
 * Access at: /admin/queues
 */
export function createBullBoardAdapter(): ExpressAdapter {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
        queues: [
            new BullMQAdapter(routeQueue),
            new BullMQAdapter(receiptQueue),
        ],
        serverAdapter,
        options: {
            uiConfig: {
                boardTitle: 'LogistiMa Queues',
                boardLogo: {
                    path: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Ic_local_shipping_48px.svg/192px-Ic_local_shipping.svg.png',
                    width: '40px',
                    height: 40,
                },
            },
        },
    });

    return serverAdapter;
}
