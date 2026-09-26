'use client';

import { browserApi } from './browser';
import { createEndpoints } from './endpoints';

/** API'et set fra browseren. */
export const api = createEndpoints(browserApi);
