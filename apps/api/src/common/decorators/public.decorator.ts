import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'maanslogen:isPublic';

/**
 * Markerer et endpoint som åbent. Standarden er det modsatte: alt kræver login,
 * medmindre nogen aktivt har taget stilling. 1.0 havde ingen autentificering
 * overhovedet — hele admin-API'et lå åbent.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
