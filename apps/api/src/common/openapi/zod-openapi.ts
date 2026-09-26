import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { problemDetailsSchema } from '@maanslogen/contracts';
import { z, type ZodType } from 'zod';

/**
 * Samme Zod-skema driver både validering og OpenAPI-dokumentationen.
 * I 1.0 var DTO-klasserne (til Swagger) og valideringen to adskilte sandheder,
 * som løb fra hinanden — og den genererede klient med dem.
 */
export function jsonSchemaOf(schema: ZodType, io: 'input' | 'output' = 'input'): SchemaObject {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
    reused: 'inline',
  }) as SchemaObject;
}

export function ApiZodBody(schema: ZodType, description?: string): MethodDecorator {
  return ApiBody({ schema: jsonSchemaOf(schema, 'input'), description });
}

export function ApiZodResponse(
  status: number,
  schema: ZodType,
  description?: string,
): MethodDecorator {
  return ApiResponse({ status, description, schema: jsonSchemaOf(schema, 'output') });
}

/** Fejlsvar dokumenteres ét sted, så alle endpoints beskriver dem ens. */
export function ApiProblemResponses(...statuses: number[]): MethodDecorator {
  const problem = jsonSchemaOf(problemDetailsSchema, 'output');
  const titles: Record<number, string> = {
    400: 'Ugyldig forespørgsel',
    401: 'Ikke autentificeret',
    403: 'Ingen adgang',
    404: 'Ikke fundet',
    409: 'Konflikt',
    422: 'Validering fejlede',
    429: 'For mange forespørgsler',
  };
  return applyDecorators(
    ApiExtraModels(),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: titles[status] ?? 'Fejl',
        schema: problem,
        content: { 'application/problem+json': { schema: problem } },
      }),
    ),
  );
}
