import type {
  AttributeDefinition,
  AuthSession,
  Beverage,
  BeverageFacets,
  BeverageSummary,
  Brand,
  BeverageType,
  Category,
  CreateBeverageInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateAttributeDefinitionInput,
  CreateQuestionInput,
  CreateReviewInput,
  LoginInput,
  Paginated,
  PresignRequest,
  PresignResponse,
  Question,
  RegisterInput,
  Review,
  ReviewForm,
  UpdateBeverageInput,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateAttributeDefinitionInput,
  UpdateQuestionInput,
  UpdateReviewInput,
  User,
} from '@maanslogen/contracts';
import type { ApiRequest, QueryValue } from './client';

type Fetcher = <T>(path: string, options?: ApiRequest) => Promise<T>;
type Query = Record<string, QueryValue>;

/**
 * Ét sted der beskriver API'ets overflade. Bindes til enten `serverApi` eller
 * `browserApi`, så server- og klientkode kalder nøjagtig de samme funktioner.
 *
 * I 1.0 var klienten genereret fra Swagger og checket ind i repoet med en
 * håndskrevet liste af aliasser ovenpå — den drev fra API'et, og nogle
 * endpoints var håndkodet udenom fordi genereringen ikke var kørt.
 */
export function createEndpoints(request: Fetcher) {
  return {
    auth: {
      login: (body: LoginInput) => request<AuthSession>('/auth/login', { method: 'POST', body }),
      register: (body: RegisterInput) =>
        request<AuthSession>('/auth/register', { method: 'POST', body }),
      logout: () => request<void>('/auth/logout', { method: 'POST' }),
      refresh: () => request<AuthSession>('/auth/refresh', { method: 'POST' }),
      me: () => request<User>('/auth/me'),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        request<void>('/auth/change-password', { method: 'POST', body }),
    },

    categories: {
      list: (query?: Query) => request<Paginated<Category>>('/categories', { query }),
      get: (idOrSlug: string) => request<Category>(`/categories/${idOrSlug}`),
      create: (body: CreateCategoryInput) =>
        request<Category>('/categories', { method: 'POST', body }),
      update: (id: string, body: UpdateCategoryInput) =>
        request<Category>(`/categories/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
    },

    types: {
      list: (query?: Query) => request<Paginated<BeverageType>>('/types', { query }),
      get: (idOrSlug: string) => request<BeverageType>(`/types/${idOrSlug}`),
      create: (body: unknown) => request<BeverageType>('/types', { method: 'POST', body }),
      update: (id: string, body: unknown) =>
        request<BeverageType>(`/types/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/types/${id}`, { method: 'DELETE' }),
    },

    brands: {
      list: (query?: Query) => request<Paginated<Brand>>('/brands', { query }),
      get: (idOrSlug: string) => request<Brand>(`/brands/${idOrSlug}`),
      create: (body: CreateBrandInput) => request<Brand>('/brands', { method: 'POST', body }),
      update: (id: string, body: UpdateBrandInput) =>
        request<Brand>(`/brands/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/brands/${id}`, { method: 'DELETE' }),
    },

    beverages: {
      list: (query?: Query) => request<Paginated<BeverageSummary>>('/beverages', { query }),
      facets: (query?: Query) => request<BeverageFacets>('/beverages/facets', { query }),
      get: (idOrSlug: string) => request<Beverage>(`/beverages/${idOrSlug}`),
      create: (body: CreateBeverageInput) =>
        request<Beverage>('/beverages', { method: 'POST', body }),
      update: (id: string, body: UpdateBeverageInput) =>
        request<Beverage>(`/beverages/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/beverages/${id}`, { method: 'DELETE' }),
    },

    attributes: {
      list: (query?: Query) => request<Paginated<AttributeDefinition>>('/attributes', { query }),
      forType: (typeId: string) => request<AttributeDefinition[]>(`/attributes/for-type/${typeId}`),
      get: (id: string) => request<AttributeDefinition>(`/attributes/${id}`),
      create: (body: CreateAttributeDefinitionInput) =>
        request<AttributeDefinition>('/attributes', { method: 'POST', body }),
      update: (id: string, body: UpdateAttributeDefinitionInput) =>
        request<AttributeDefinition>(`/attributes/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/attributes/${id}`, { method: 'DELETE' }),
    },

    questions: {
      list: (query?: Query) => request<Paginated<Question>>('/questions', { query }),
      forType: (typeId: string) => request<Question[]>(`/questions/for-type/${typeId}`),
      create: (body: CreateQuestionInput) =>
        request<Question>('/questions', { method: 'POST', body }),
      update: (id: string, body: UpdateQuestionInput) =>
        request<Question>(`/questions/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/questions/${id}`, { method: 'DELETE' }),
    },

    reviews: {
      list: (query?: Query) => request<Paginated<Review>>('/reviews', { query }),
      form: (beverageIdOrSlug: string) => request<ReviewForm>(`/reviews/form/${beverageIdOrSlug}`),
      get: (id: string) => request<Review>(`/reviews/${id}`),
      create: (body: CreateReviewInput) => request<Review>('/reviews', { method: 'POST', body }),
      update: (id: string, body: UpdateReviewInput) =>
        request<Review>(`/reviews/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/reviews/${id}`, { method: 'DELETE' }),
    },

    users: {
      list: (query?: Query) => request<Paginated<User>>('/users', { query }),
      get: (id: string) => request<User>(`/users/${id}`),
      update: (id: string, body: unknown) =>
        request<User>(`/users/${id}`, { method: 'PATCH', body }),
      remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
      updateProfile: (body: { displayName?: string }) =>
        request<User>('/users/me', { method: 'PATCH', body }),
    },

    media: {
      presign: (body: PresignRequest) =>
        request<PresignResponse>('/media/presign', { method: 'POST', body }),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
