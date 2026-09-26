import 'server-only';
import { createEndpoints } from './endpoints';
import { serverApi } from './server';

/** API'et set fra server-komponenter og server actions. */
export const api = createEndpoints(serverApi);
