import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser, resetDatabase, startHarness, type AuthedUser, type TestHarness } from './harness';

describe('Anmeldelser (e2e)', () => {
  let harness: TestHarness;
  let moderator: AuthedUser;
  let alice: AuthedUser;
  let bob: AuthedUser;

  let stoutTypeId: string;
  let beverageId: string;
  let beverageSlug: string;
  let bitternessQuestionId: string;
  let buyAgainQuestionId: string;
  let aromaQuestionId: string;
  let wineOnlyQuestionId: string;

  beforeAll(async () => {
    harness = await startHarness();
  });
  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await resetDatabase(harness.prisma);
    moderator = await registerUser(harness, { role: 'MODERATOR', displayName: 'Signe K.' });
    alice = await registerUser(harness, { displayName: 'Alice A.' });
    bob = await registerUser(harness, { displayName: 'Bob B.' });

    const post = async (url: string, payload: Record<string, unknown>) => {
      const response = await harness.request({
        method: 'POST',
        url,
        headers: moderator.headers,
        payload,
      });
      if (response.statusCode >= 400) throw new Error(`${url}: ${response.body}`);
      return response.json();
    };

    const beerCategoryId = (await post('/api/v1/categories', { name: 'Øl' })).id;
    const wineCategoryId = (await post('/api/v1/categories', { name: 'Vin' })).id;
    stoutTypeId = (await post('/api/v1/types', { categoryId: beerCategoryId, name: 'Stout' })).id;
    const brandId = (await post('/api/v1/brands', { name: 'Mikkeller' })).id;

    const beverage = await post('/api/v1/beverages', {
      name: 'Beer Geek Breakfast',
      typeId: stoutTypeId,
      brandId,
    });
    beverageId = beverage.id;
    beverageSlug = beverage.slug;

    bitternessQuestionId = (
      await post('/api/v1/questions', {
        prompt: 'Hvor bitter er den?',
        answerType: 'SCALE',
        required: true,
        scale: { min: 1, max: 5 },
        categoryIds: [beerCategoryId],
      })
    ).id;

    buyAgainQuestionId = (
      await post('/api/v1/questions', {
        prompt: 'Ville du købe den igen?',
        answerType: 'BOOLEAN',
        required: true,
      })
    ).id;

    aromaQuestionId = (
      await post('/api/v1/questions', {
        prompt: 'Hvilke aromaer?',
        answerType: 'MULTI_SELECT',
        options: [
          { value: 'coffee', label: 'Kaffe' },
          { value: 'caramel', label: 'Karamel' },
        ],
      })
    ).id;

    wineOnlyQuestionId = (
      await post('/api/v1/questions', {
        prompt: 'Hvilken druesort dominerer?',
        answerType: 'TEXT',
        categoryIds: [wineCategoryId],
      })
    ).id;
  });

  function validAnswers() {
    return [
      { questionId: bitternessQuestionId, value: 4 },
      { questionId: buyAgainQuestionId, value: true },
    ];
  }

  async function postReview(user: AuthedUser, payload: Record<string, unknown>) {
    return harness.request({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: user.headers,
      payload: { beverageId, ...payload },
    });
  }

  describe('formularen', () => {
    it('stiller kun de spørgsmål der gælder for typen', async () => {
      const response = await harness.request({
        method: 'GET',
        url: `/api/v1/reviews/form/${beverageSlug}`,
      });
      const prompts = response.json().questions.map((question: { id: string }) => question.id);
      expect(prompts).toContain(bitternessQuestionId);
      expect(prompts).toContain(buyAgainQuestionId);
      expect(prompts).not.toContain(wineOnlyQuestionId);
    });

    it('viser brugerens egen anmeldelse når der er en', async () => {
      await postReview(alice, { rating: 4, answers: validAnswers() });

      const anonymous = await harness.request({
        method: 'GET',
        url: `/api/v1/reviews/form/${beverageSlug}`,
      });
      expect(anonymous.json().existingReview).toBeNull();

      const asAlice = await harness.request({
        method: 'GET',
        url: `/api/v1/reviews/form/${beverageSlug}`,
        headers: alice.headers,
      });
      expect(asAlice.json().existingReview.rating).toBe(4);
    });
  });

  describe('validering', () => {
    it('kræver login', async () => {
      const response = await harness.request({
        method: 'POST',
        url: '/api/v1/reviews',
        payload: { beverageId, rating: 4 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('kræver svar på de påkrævede spørgsmål', async () => {
      const response = await postReview(alice, { rating: 4 });
      expect(response.statusCode).toBe(422);
      expect(Object.keys(response.json().errors)).toHaveLength(2);
    });

    it('afviser en skalaværdi uden for grænserne', async () => {
      const response = await postReview(alice, {
        rating: 4,
        answers: [
          { questionId: bitternessQuestionId, value: 9 },
          { questionId: buyAgainQuestionId, value: true },
        ],
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().errors[`answers.${bitternessQuestionId}`][0]).toContain('mellem 1 og 5');
    });

    it('afviser ukendte valgmuligheder', async () => {
      const response = await postReview(alice, {
        rating: 4,
        answers: [...validAnswers(), { questionId: aromaQuestionId, value: ['røg'] }],
      });
      expect(response.statusCode).toBe(422);
    });

    it('afviser et spørgsmål der ikke gælder for drikkevaren', async () => {
      const response = await postReview(alice, {
        rating: 4,
        answers: [...validAnswers(), { questionId: wineOnlyQuestionId, value: 'Riesling' }],
      });
      expect(response.statusCode).toBe(422);
    });

    it('afviser kvarte stjerner', async () => {
      const response = await postReview(alice, { rating: 3.25, answers: validAnswers() });
      expect(response.statusCode).toBe(422);
    });

    it('tillader kun én anmeldelse pr. bruger pr. drikkevare', async () => {
      expect((await postReview(alice, { rating: 4, answers: validAnswers() })).statusCode).toBe(201);
      const duplicate = await postReview(alice, { rating: 5, answers: validAnswers() });
      expect(duplicate.statusCode).toBe(409);
    });
  });

  describe('bedømmelsen genberegnes', () => {
    async function ratingOf(): Promise<{ average: number; count: number; distribution: Record<string, number> }> {
      const response = await harness.request({ method: 'GET', url: `/api/v1/beverages/${beverageSlug}` });
      return response.json().rating;
    }

    it('starter på nul', async () => {
      expect(await ratingOf()).toMatchObject({ average: 0, count: 0 });
    });

    it('opdaterer gennemsnit og fordeling ved oprettelse', async () => {
      await postReview(alice, { rating: 5, answers: validAnswers() });
      await postReview(bob, { rating: 4, answers: validAnswers() });

      const rating = await ratingOf();
      expect(rating.average).toBe(4.5);
      expect(rating.count).toBe(2);
      expect(rating.distribution['5']).toBe(1);
      expect(rating.distribution['4']).toBe(1);
    });

    it('opdaterer ved redigering', async () => {
      const review = (await postReview(alice, { rating: 5, answers: validAnswers() })).json();
      await harness.request({
        method: 'PATCH',
        url: `/api/v1/reviews/${review.id}`,
        headers: alice.headers,
        payload: { rating: 2 },
      });
      expect(await ratingOf()).toMatchObject({ average: 2, count: 1 });
    });

    it('opdaterer ved sletning', async () => {
      const review = (await postReview(alice, { rating: 5, answers: validAnswers() })).json();
      await postReview(bob, { rating: 3, answers: validAnswers() });

      await harness.request({
        method: 'DELETE',
        url: `/api/v1/reviews/${review.id}`,
        headers: alice.headers,
      });
      expect(await ratingOf()).toMatchObject({ average: 3, count: 1 });
    });

    it('stemmer med rækkerne i databasen', async () => {
      await postReview(alice, { rating: 4.5, answers: validAnswers() });
      await postReview(bob, { rating: 3.5, answers: validAnswers() });

      const rows = await harness.prisma.review.findMany({ where: { beverageId }, select: { rating: true } });
      const expected = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
      const stored = await harness.prisma.beverage.findUniqueOrThrow({
        where: { id: beverageId },
        select: { ratingAverage: true, ratingCount: true },
      });

      expect(stored.ratingAverage).toBeCloseTo(expected, 4);
      expect(stored.ratingCount).toBe(rows.length);
    });
  });

  describe('ejerskab', () => {
    it('lader ikke andre redigere ens anmeldelse', async () => {
      const review = (await postReview(alice, { rating: 4, answers: validAnswers() })).json();
      const response = await harness.request({
        method: 'PATCH',
        url: `/api/v1/reviews/${review.id}`,
        headers: bob.headers,
        payload: { rating: 1 },
      });
      expect(response.statusCode).toBe(403);
    });

    it('lader en moderator redigere andres anmeldelser', async () => {
      const review = (await postReview(alice, { rating: 4, answers: validAnswers() })).json();
      const response = await harness.request({
        method: 'PATCH',
        url: `/api/v1/reviews/${review.id}`,
        headers: moderator.headers,
        payload: { title: 'Redigeret af moderator' },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('svarene vises formateret', () => {
    it('oversætter værdier til labels og skalaer', async () => {
      const review = (
        await postReview(alice, {
          rating: 4,
          answers: [...validAnswers(), { questionId: aromaQuestionId, value: ['coffee', 'caramel'] }],
        })
      ).json();

      const byPrompt = Object.fromEntries(
        review.answers.map((answer: { prompt: string; displayValue: string }) => [
          answer.prompt,
          answer.displayValue,
        ]),
      );
      expect(byPrompt['Hvor bitter er den?']).toBe('4 / 5');
      expect(byPrompt['Ville du købe den igen?']).toBe('Ja');
      expect(byPrompt['Hvilke aromaer?']).toBe('Kaffe, Karamel');
      expect(review.author.displayName).toBe('Alice A.');
    });
  });
});
