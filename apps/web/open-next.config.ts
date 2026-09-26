import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * Ingen `incrementalCache`. Standardskabelonen lægger Next's ISR-cache i R2,
 * men siderne her er dynamiske, og hver cache-læsning ville være en Class
 * B-operation. Uden overstyring holder adapteren cachen i hukommelsen pr.
 * isolat, hvilket er gratis og passer til en app der alligevel ikke
 * pre-renderer noget.
 */
export default defineCloudflareConfig();
