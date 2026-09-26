import { Body, Param, type PipeTransform, Query, type ArgumentMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from './app-error';

/**
 * Validerer og typekonverterer input med et delt Zod-skema fra `@maanslogen/contracts`.
 *
 * 1.0 havde class-validator-DTO'er men registrerede aldrig en ValidationPipe,
 * så intet input blev faktisk valideret. Her er validering påkrævet ved hvert kald.
 */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.join('.') : (metadata.type ?? 'body');
      (errors[key] ??= []).push(issue.message);
    }

    throw AppError.validation(
      metadata.type === 'query'
        ? 'Et eller flere query-parametre er ugyldige'
        : 'Et eller flere felter er ugyldige',
      errors,
    );
  }
}

/** `@ZodBody(createBeverageSchema) dto: CreateBeverageInput` */
export const ZodBody = <T extends ZodType>(schema: T): ParameterDecorator =>
  Body(new ZodValidationPipe(schema));

/** `@ZodQuery(beverageListQuerySchema) query: BeverageListQuery` */
export const ZodQuery = <T extends ZodType>(schema: T): ParameterDecorator =>
  Query(new ZodValidationPipe(schema));

/** `@ZodParam('id', idSchema) id: string` */
export const ZodParam = <T extends ZodType>(name: string, schema: T): ParameterDecorator =>
  Param(name, new ZodValidationPipe(schema));
