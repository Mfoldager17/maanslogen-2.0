import { SetMetadata } from '@nestjs/common';
import type { Role } from '@maanslogen/contracts';

export const ROLES_KEY = 'maanslogen:minRole';

/** Mindste rolle der må kalde endpointet. Hierarkisk: ADMIN opfylder MODERATOR. */
export const MinRole = (role: Role): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, role);
