import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { slugify } from '@maanslogen/contracts';

/**
 * Idempotent seed: kan køres igen og igen uden at duplikere noget.
 * 1.0's seed startede med at tømme samtlige tabeller — hvilket gør den
 * uanvendelig mod alt andet end en tom udviklingsdatabase.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type AttributeSeed = {
  key: string;
  displayName: string;
  dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';
  unit?: string;
  required?: boolean;
  filterable?: boolean;
  highlighted?: boolean;
  sortOrder: number;
  rules?: Prisma.InputJsonValue;
  options?: { value: string; label: string }[];
  categories?: string[];
  types?: string[];
};

type QuestionSeed = {
  prompt: string;
  helpText?: string;
  answerType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SCALE' | 'SELECT' | 'MULTI_SELECT';
  required?: boolean;
  sortOrder: number;
  options?: { value: string; label: string }[];
  scale?: Prisma.InputJsonValue;
  categories?: string[];
};

const CATEGORIES = [
  { name: 'Øl', icon: '🍺', accentColor: '#a8492a', description: 'Fra pilsner til imperial stout.', sortOrder: 1 },
  { name: 'Vin', icon: '🍷', accentColor: '#7d3b52', description: 'Rød, hvid, rosé og bobler.', sortOrder: 2 },
  { name: 'Whisky', icon: '🥃', accentColor: '#8a6a3a', description: 'Skotsk, irsk, bourbon og rug.', sortOrder: 3 },
  { name: 'Gin', icon: '🍸', accentColor: '#2e5e4e', description: 'London Dry, Old Tom og genever.', sortOrder: 4 },
  { name: 'Rom', icon: '🏝️', accentColor: '#6b4423', description: 'Hvid, gylden og mørk rom.', sortOrder: 5 },
  { name: 'Cider', icon: '🍏', accentColor: '#5a7a3a', description: 'Æble- og pærecider.', sortOrder: 6 },
];

const TYPES: Record<string, { name: string; description: string }[]> = {
  'Øl': [
    { name: 'Pilsner', description: 'Lys, klar og forfriskende.' },
    { name: 'IPA', description: 'Humlet og aromatisk.' },
    { name: 'Stout', description: 'Mørk, ristet og fyldig.' },
    { name: 'Hvedeøl', description: 'Uklar, frugtig og blød.' },
    { name: 'Imperial stout', description: 'Stout med skruen i bund.' },
  ],
  'Vin': [
    { name: 'Rødvin', description: 'Fra let bourgogne til kraftig barolo.' },
    { name: 'Hvidvin', description: 'Frisk syre og frugt.' },
    { name: 'Rosé', description: 'Let og sommerlig.' },
    { name: 'Mousserende', description: 'Champagne, crémant og cava.' },
  ],
  'Whisky': [
    { name: 'Skotsk single malt', description: 'Én destilleri, én malt.' },
    { name: 'Bourbon', description: 'Majsbaseret og sød.' },
    { name: 'Irsk whisky', description: 'Blød og tredobbelt destilleret.' },
  ],
  'Gin': [
    { name: 'London Dry', description: 'Enebær forrest.' },
    { name: 'Old Tom', description: 'Let sødet.' },
  ],
  'Rom': [
    { name: 'Hvid rom', description: 'Let og til cocktails.' },
    { name: 'Mørk rom', description: 'Karamel og krydderi.' },
  ],
  'Cider': [
    { name: 'Æblecider', description: 'Syrlig og frugtig.' },
    { name: 'Pærecider', description: 'Blødere og sødere.' },
  ],
};

const ATTRIBUTES: AttributeSeed[] = [
  {
    key: 'alcohol_percent',
    displayName: 'Alkoholprocent',
    dataType: 'NUMBER',
    unit: '%',
    required: true,
    filterable: true,
    highlighted: true,
    sortOrder: 10,
    rules: { min: 0, max: 70, step: 0.1 },
  },
  {
    key: 'ibu',
    displayName: 'Bitterhed',
    dataType: 'NUMBER',
    unit: 'IBU',
    filterable: true,
    highlighted: true,
    sortOrder: 20,
    rules: { min: 0, max: 120 },
    categories: ['Øl'],
  },
  {
    key: 'color',
    displayName: 'Farve',
    dataType: 'ENUM',
    filterable: true,
    highlighted: true,
    sortOrder: 30,
    options: [
      { value: 'light', label: 'Lys' },
      { value: 'amber', label: 'Ravfarvet' },
      { value: 'dark', label: 'Mørk' },
    ],
    categories: ['Øl'],
  },
  {
    key: 'organic',
    displayName: 'Økologisk',
    dataType: 'BOOLEAN',
    filterable: true,
    sortOrder: 40,
  },
  {
    key: 'serving_temp',
    displayName: 'Serveringstemperatur',
    dataType: 'NUMBER',
    unit: '°C',
    sortOrder: 50,
    rules: { min: -5, max: 25 },
  },
  {
    key: 'grape_variety',
    displayName: 'Druesort',
    dataType: 'MULTI_ENUM',
    filterable: true,
    highlighted: true,
    sortOrder: 60,
    options: [
      { value: 'cabernet_sauvignon', label: 'Cabernet Sauvignon' },
      { value: 'merlot', label: 'Merlot' },
      { value: 'chardonnay', label: 'Chardonnay' },
      { value: 'riesling', label: 'Riesling' },
      { value: 'pinot_noir', label: 'Pinot Noir' },
    ],
    categories: ['Vin'],
  },
  {
    key: 'cask_type',
    displayName: 'Fadlagring',
    dataType: 'ENUM',
    filterable: true,
    highlighted: true,
    sortOrder: 70,
    options: [
      { value: 'ex_bourbon', label: 'Ex-bourbon' },
      { value: 'sherry', label: 'Sherry' },
      { value: 'port', label: 'Portvin' },
      { value: 'virgin_oak', label: 'Ny eg' },
    ],
    categories: ['Whisky', 'Rom'],
  },
  {
    key: 'age_years',
    displayName: 'Lagringstid',
    dataType: 'NUMBER',
    unit: 'år',
    filterable: true,
    highlighted: true,
    sortOrder: 80,
    rules: { min: 0, max: 80 },
    categories: ['Whisky', 'Rom'],
  },
  {
    key: 'tasting_notes',
    displayName: 'Smagsnoter',
    dataType: 'TEXT',
    sortOrder: 90,
    rules: { maxLength: 400 },
  },
];

const QUESTIONS: QuestionSeed[] = [
  {
    prompt: 'Hvor bitter er den?',
    answerType: 'SCALE',
    required: true,
    sortOrder: 10,
    scale: { min: 1, max: 5, minLabel: 'Slet ikke', maxLabel: 'Meget bitter' },
    categories: ['Øl'],
  },
  {
    prompt: 'Hvor sød er den?',
    answerType: 'SCALE',
    required: true,
    sortOrder: 20,
    scale: { min: 1, max: 5, minLabel: 'Tør', maxLabel: 'Meget sød' },
    categories: ['Øl', 'Cider'],
  },
  {
    prompt: 'Hvor fyldig er munfølelsen?',
    answerType: 'SCALE',
    sortOrder: 30,
    scale: { min: 1, max: 5, minLabel: 'Let', maxLabel: 'Meget fyldig' },
    categories: ['Øl', 'Vin', 'Whisky', 'Rom'],
  },
  {
    prompt: 'Ville du købe den igen?',
    answerType: 'BOOLEAN',
    required: true,
    sortOrder: 40,
  },
  {
    prompt: 'Til hvilken anledning?',
    answerType: 'SELECT',
    sortOrder: 50,
    options: [
      { value: 'alone', label: 'Aften alene' },
      { value: 'food', label: 'Med mad' },
      { value: 'friends', label: 'Med venner' },
      { value: 'special', label: 'Særlig lejlighed' },
    ],
  },
  {
    prompt: 'Hvilke aromaer lagde du mærke til?',
    answerType: 'MULTI_SELECT',
    sortOrder: 60,
    options: [
      { value: 'citrus', label: 'Citrus' },
      { value: 'caramel', label: 'Karamel' },
      { value: 'coffee', label: 'Kaffe' },
      { value: 'smoke', label: 'Røg' },
      { value: 'vanilla', label: 'Vanilje' },
      { value: 'berries', label: 'Bær' },
    ],
  },
  {
    prompt: 'Hvad vil du huske om den?',
    helpText: 'Din egen note — vises sammen med anmeldelsen.',
    answerType: 'TEXT',
    sortOrder: 70,
  },
];

const BRANDS: { name: string; country: string; categories: string[] }[] = [
  { name: 'Mikkeller', country: 'DK', categories: ['Øl'] },
  { name: 'To Øl', country: 'DK', categories: ['Øl'] },
  { name: 'Carlsberg', country: 'DK', categories: ['Øl'] },
  { name: 'Amager Bryghus', country: 'DK', categories: ['Øl'] },
  { name: 'Guinness', country: 'IE', categories: ['Øl'] },
  { name: 'Weihenstephaner', country: 'DE', categories: ['Øl'] },
  { name: 'Concha y Toro', country: 'CL', categories: ['Vin'] },
  { name: 'Moët & Chandon', country: 'FR', categories: ['Vin'] },
  { name: 'Dr. Loosen', country: 'DE', categories: ['Vin'] },
  { name: 'Glenfiddich', country: 'GB', categories: ['Whisky'] },
  { name: 'Jameson', country: 'IE', categories: ['Whisky'] },
  { name: 'Wild Turkey', country: 'US', categories: ['Whisky'] },
  { name: 'Hernö', country: 'SE', categories: ['Gin'] },
  { name: 'Tanqueray', country: 'GB', categories: ['Gin'] },
  { name: 'Havana Club', country: 'CU', categories: ['Rom'] },
  { name: 'Plantation', country: 'BB', categories: ['Rom'] },
  { name: 'Rekorderlig', country: 'SE', categories: ['Cider'] },
];

const BEVERAGES: {
  name: string;
  brand: string;
  type: string;
  country: string;
  vintage?: number;
  description: string;
  attributes: Record<string, string | number | boolean | string[]>;
}[] = [
  {
    name: 'Beer Geek Breakfast',
    brand: 'Mikkeller',
    type: 'Stout',
    country: 'DK',
    description: 'Oatmeal stout brygget med kaffe. Dyb, ristet og fyldig med en lang bitter afslutning.',
    attributes: { alcohol_percent: 7.5, ibu: 42, color: 'dark', organic: false, serving_temp: 10 },
  },
  {
    name: 'Black Malts & Body Salts',
    brand: 'To Øl',
    type: 'Imperial stout',
    country: 'DK',
    description: 'Imperial stout med kaffe og vanilje. Tyk og varmende.',
    attributes: { alcohol_percent: 9, ibu: 60, color: 'dark', organic: true, serving_temp: 12 },
  },
  {
    name: 'Hr. Frederiksen',
    brand: 'Amager Bryghus',
    type: 'Imperial stout',
    country: 'DK',
    description: 'Dansk imperial stout-klassiker — lakrids, mørk chokolade og en tydelig alkoholvarme.',
    attributes: { alcohol_percent: 10.5, ibu: 70, color: 'dark', organic: false },
  },
  {
    name: 'Draught',
    brand: 'Guinness',
    type: 'Stout',
    country: 'IE',
    description: 'Den mest kendte stout i verden. Cremet skum og tør ristet afslutning.',
    attributes: { alcohol_percent: 4.2, ibu: 45, color: 'dark', organic: false, serving_temp: 6 },
  },
  {
    name: 'Hefeweissbier',
    brand: 'Weihenstephaner',
    type: 'Hvedeøl',
    country: 'DE',
    description: 'Banan og nellike fra gæren, blød kulsyre og en frisk afslutning.',
    attributes: { alcohol_percent: 5.4, ibu: 14, color: 'light', organic: false, serving_temp: 7 },
  },
  {
    name: 'Pilsner',
    brand: 'Carlsberg',
    type: 'Pilsner',
    country: 'DK',
    description: 'Den grønne. Let, tør og hverdagsagtig.',
    attributes: { alcohol_percent: 4.6, ibu: 18, color: 'light', organic: false, serving_temp: 5 },
  },
  {
    name: 'Jazz Meets Rock',
    brand: 'To Øl',
    type: 'IPA',
    country: 'DK',
    description: 'Dobbelt IPA med masser af harpiks og grapefrugt.',
    attributes: { alcohol_percent: 8.2, ibu: 80, color: 'amber', organic: true },
  },
  {
    name: 'Marques de Casa Concha Cabernet',
    brand: 'Concha y Toro',
    type: 'Rødvin',
    country: 'CL',
    vintage: 2021,
    description: 'Mørke bær, cederträ og bløde tanniner fra Puente Alto.',
    attributes: { alcohol_percent: 14, grape_variety: ['cabernet_sauvignon'], organic: false, serving_temp: 18 },
  },
  {
    name: 'Blue Slate Riesling',
    brand: 'Dr. Loosen',
    type: 'Hvidvin',
    country: 'DE',
    vintage: 2022,
    description: 'Stenfrugt, lime og en stram mineralsk syre fra Mosel.',
    attributes: { alcohol_percent: 11.5, grape_variety: ['riesling'], organic: false, serving_temp: 9 },
  },
  {
    name: 'Impérial Brut',
    brand: 'Moët & Chandon',
    type: 'Mousserende',
    country: 'FR',
    description: 'Grøn æble, citrus og brioche. Husets kendetegn.',
    attributes: { alcohol_percent: 12, grape_variety: ['chardonnay', 'pinot_noir'], serving_temp: 8 },
  },
  {
    name: '12 Year Old',
    brand: 'Glenfiddich',
    type: 'Skotsk single malt',
    country: 'GB',
    description: 'Pære, eg og en let honningsødme. Indgangen til single malt for mange.',
    attributes: { alcohol_percent: 40, cask_type: 'ex_bourbon', age_years: 12, serving_temp: 18 },
  },
  {
    name: 'Rare Breed',
    brand: 'Wild Turkey',
    type: 'Bourbon',
    country: 'US',
    description: 'Fadstyrke-bourbon med vanilje, kanel og en kraftig eftersmag.',
    attributes: { alcohol_percent: 58.4, cask_type: 'virgin_oak', age_years: 8 },
  },
  {
    name: 'Black Barrel',
    brand: 'Jameson',
    type: 'Irsk whisky',
    country: 'IE',
    description: 'Dobbeltristede fade giver karamel og en rundere krop end standardudgaven.',
    attributes: { alcohol_percent: 40, cask_type: 'ex_bourbon', age_years: 6 },
  },
  {
    name: 'Swedish Excellence',
    brand: 'Hernö',
    type: 'London Dry',
    country: 'SE',
    description: 'Enebær, koriander og tyttebær. Blød og rund for en London Dry.',
    attributes: { alcohol_percent: 40.5, organic: true },
  },
  {
    name: '7 Años',
    brand: 'Havana Club',
    type: 'Mørk rom',
    country: 'CU',
    description: 'Tobak, kakao og tørret frugt. Den klassiske cubanske profil.',
    attributes: { alcohol_percent: 40, cask_type: 'ex_bourbon', age_years: 7 },
  },
  {
    name: 'Xaymaca Special Dry',
    brand: 'Plantation',
    type: 'Mørk rom',
    country: 'BB',
    description: 'Jamaicansk funk med banan og ananas. Tør afslutning.',
    attributes: { alcohol_percent: 43, cask_type: 'ex_bourbon', age_years: 4 },
  },
  {
    name: 'Æble-Cider',
    brand: 'Rekorderlig',
    type: 'Æblecider',
    country: 'SE',
    description: 'Sød og letdrikkelig — den man deler på en altan i juli.',
    attributes: { alcohol_percent: 4.5, organic: false, serving_temp: 5 },
  },
];

const REVIEW_TEXTS = [
  { title: 'Ramte lige ned i det', body: 'Præcis den balance jeg håbede på. Den holder til hele aftenen.' },
  { title: 'God, men tung', body: 'Fantastisk første indtryk. Efter en halv flaske bliver den lidt meget.' },
  { title: 'Bedre end forventet', body: 'Havde skrevet den af på forhånd. Det var forkert.' },
  { title: 'Solid hverdagsflaske', body: 'Ikke noget der overrasker, men heller aldrig skuffende.' },
  { title: 'Lidt for sød for mig', body: 'Godt håndværk, men sødmen tager over til sidst.' },
  { title: 'Den kommer i skabet igen', body: 'Købte to mere dagen efter. Siger vist alt.' },
];

async function upsertUser(
  email: string,
  displayName: string,
  role: 'USER' | 'MODERATOR' | 'ADMIN',
  password: string,
): Promise<{ id: string }> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email },
    create: { email, displayName, role, passwordHash },
    update: { displayName, role },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  console.log('Seeder database …');

  // ---- Brugere ----
  const admin = await upsertUser('admin@maanslogen.dk', 'Mathias F.', 'ADMIN', 'Maanslogen-Admin-1');
  const moderator = await upsertUser('mod@maanslogen.dk', 'Signe K.', 'MODERATOR', 'Maanslogen-Mod-1');
  const reviewers = await Promise.all([
    upsertUser('jonas@example.dk', 'Jonas P.', 'USER', 'Maanslogen-Test-1'),
    upsertUser('frida@example.dk', 'Frida L.', 'USER', 'Maanslogen-Test-1'),
    upsertUser('omar@example.dk', 'Omar H.', 'USER', 'Maanslogen-Test-1'),
    upsertUser('lene@example.dk', 'Lene B.', 'USER', 'Maanslogen-Test-1'),
  ]);
  const allReviewers = [moderator, ...reviewers];
  console.log(`  ${allReviewers.length + 1} brugere`);

  // ---- Kategorier og typer ----
  const categoryByName = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.beverageCategory.upsert({
      where: { slug: slugify(category.name) },
      create: { ...category, slug: slugify(category.name) },
      update: { icon: category.icon, accentColor: category.accentColor, sortOrder: category.sortOrder },
      select: { id: true },
    });
    categoryByName.set(category.name, row.id);
  }

  const typeByName = new Map<string, string>();
  for (const [categoryName, types] of Object.entries(TYPES)) {
    const categoryId = categoryByName.get(categoryName);
    if (!categoryId) continue;
    for (const [index, type] of types.entries()) {
      const slug = slugify(`${categoryName} ${type.name}`);
      const row = await prisma.beverageType.upsert({
        where: { slug },
        create: { slug, categoryId, name: type.name, description: type.description, sortOrder: index * 10 },
        update: { description: type.description, sortOrder: index * 10 },
        select: { id: true },
      });
      typeByName.set(type.name, row.id);
    }
  }
  console.log(`  ${categoryByName.size} kategorier, ${typeByName.size} typer`);

  // ---- Attributdefinitioner ----
  const attributeByKey = new Map<string, { id: string; dataType: string }>();
  for (const attribute of ATTRIBUTES) {
    const categoryIds = (attribute.categories ?? [])
      .map((name) => categoryByName.get(name))
      .filter((id): id is string => Boolean(id));

    const row = await prisma.attributeDefinition.upsert({
      where: { key: attribute.key },
      create: {
        key: attribute.key,
        displayName: attribute.displayName,
        dataType: attribute.dataType,
        unit: attribute.unit ?? null,
        required: attribute.required ?? false,
        filterable: attribute.filterable ?? false,
        highlighted: attribute.highlighted ?? false,
        sortOrder: attribute.sortOrder,
        rules: attribute.rules,
        options: attribute.options,
        ...(categoryIds.length ? { categories: { connect: categoryIds.map((id) => ({ id })) } } : {}),
      },
      update: {
        displayName: attribute.displayName,
        unit: attribute.unit ?? null,
        required: attribute.required ?? false,
        filterable: attribute.filterable ?? false,
        highlighted: attribute.highlighted ?? false,
        sortOrder: attribute.sortOrder,
        rules: attribute.rules,
        options: attribute.options,
        ...(categoryIds.length ? { categories: { set: categoryIds.map((id) => ({ id })) } } : {}),
      },
      select: { id: true, dataType: true },
    });
    attributeByKey.set(attribute.key, row);
  }
  console.log(`  ${attributeByKey.size} attributdefinitioner`);

  // ---- Spørgsmål ----
  let questionCount = 0;
  for (const question of QUESTIONS) {
    const categoryIds = (question.categories ?? [])
      .map((name) => categoryByName.get(name))
      .filter((id): id is string => Boolean(id));

    const existing = await prisma.question.findFirst({ where: { prompt: question.prompt } });
    const data = {
      prompt: question.prompt,
      helpText: question.helpText ?? null,
      answerType: question.answerType,
      required: question.required ?? false,
      sortOrder: question.sortOrder,
      options: question.options as Prisma.InputJsonValue | undefined,
      scale: question.scale,
    };

    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: { ...data, categories: { set: categoryIds.map((id) => ({ id })) } },
      });
    } else {
      await prisma.question.create({
        data: {
          ...data,
          ...(categoryIds.length ? { categories: { connect: categoryIds.map((id) => ({ id })) } } : {}),
        },
      });
    }
    questionCount += 1;
  }
  console.log(`  ${questionCount} spørgsmål`);

  // ---- Mærker ----
  const brandByName = new Map<string, string>();
  for (const brand of BRANDS) {
    const categoryIds = brand.categories
      .map((name) => categoryByName.get(name))
      .filter((id): id is string => Boolean(id));
    const slug = slugify(brand.name);
    const row = await prisma.brand.upsert({
      where: { slug },
      create: {
        slug,
        name: brand.name,
        countryCode: brand.country,
        categories: { connect: categoryIds.map((id) => ({ id })) },
      },
      update: { countryCode: brand.country, categories: { set: categoryIds.map((id) => ({ id })) } },
      select: { id: true },
    });
    brandByName.set(brand.name, row.id);
  }
  console.log(`  ${brandByName.size} mærker`);

  // ---- Drikkevarer med attributværdier ----
  const beverageIds: string[] = [];
  for (const beverage of BEVERAGES) {
    const brandId = brandByName.get(beverage.brand);
    const typeId = typeByName.get(beverage.type);
    if (!brandId || !typeId) continue;

    const slug = slugify([beverage.brand, beverage.name, beverage.vintage].filter(Boolean).join(' '));
    const row = await prisma.beverage.upsert({
      where: { slug },
      create: {
        slug,
        name: beverage.name,
        description: beverage.description,
        countryCode: beverage.country,
        vintage: beverage.vintage ?? null,
        brandId,
        typeId,
      },
      update: { description: beverage.description, countryCode: beverage.country },
      select: { id: true },
    });
    beverageIds.push(row.id);

    for (const [key, value] of Object.entries(beverage.attributes)) {
      const definition = attributeByKey.get(key);
      if (!definition) continue;

      const columns =
        definition.dataType === 'NUMBER'
          ? { valueNumber: Number(value) }
          : definition.dataType === 'BOOLEAN'
            ? { valueBoolean: Boolean(value) }
            : definition.dataType === 'MULTI_ENUM'
              ? { valueJson: value as Prisma.InputJsonValue }
              : { valueText: String(value) };

      await prisma.beverageAttributeValue.upsert({
        where: { beverageId_definitionId: { beverageId: row.id, definitionId: definition.id } },
        create: { beverageId: row.id, definitionId: definition.id, ...columns },
        update: columns,
      });
    }
  }
  console.log(`  ${beverageIds.length} drikkevarer`);

  // ---- Anmeldelser med besvarelser ----
  let reviewCount = 0;
  for (const [beverageIndex, beverageId] of beverageIds.entries()) {
    const beverage = await prisma.beverage.findUniqueOrThrow({
      where: { id: beverageId },
      select: { typeId: true, type: { select: { categoryId: true } } },
    });

    const questions = await prisma.question.findMany({
      where: {
        deletedAt: null,
        active: true,
        AND: [
          {
            OR: [
              { categories: { none: {} } },
              { categories: { some: { id: beverage.type.categoryId } } },
            ],
          },
          { OR: [{ types: { none: {} } }, { types: { some: { id: beverage.typeId } } }] },
        ],
      },
    });

    // Deterministisk "tilfældighed", så seeden giver samme data hver gang.
    const reviewerCount = 2 + (beverageIndex % 3);
    for (let offset = 0; offset < reviewerCount; offset += 1) {
      const reviewer = allReviewers[(beverageIndex + offset) % allReviewers.length];
      if (!reviewer) continue;

      const existing = await prisma.review.findUnique({
        where: { userId_beverageId: { userId: reviewer.id, beverageId } },
        select: { id: true },
      });
      if (existing) continue;

      const rating = 3 + ((beverageIndex + offset * 2) % 5) * 0.5;
      const text = REVIEW_TEXTS[(beverageIndex + offset) % REVIEW_TEXTS.length];

      const answers = questions.map((question, questionIndex) => {
        const seed = beverageIndex + offset + questionIndex;
        switch (question.answerType) {
          case 'SCALE':
            return { questionId: question.id, valueNumber: 1 + (seed % 5) };
          case 'BOOLEAN':
            return { questionId: question.id, valueBoolean: seed % 4 !== 0 };
          case 'NUMBER':
            return { questionId: question.id, valueNumber: 5 + (seed % 15) };
          case 'SELECT': {
            const options = (question.options as { value: string }[] | null) ?? [];
            const option = options[seed % Math.max(options.length, 1)];
            return option ? { questionId: question.id, valueText: option.value } : null;
          }
          case 'MULTI_SELECT': {
            const options = (question.options as { value: string }[] | null) ?? [];
            const picked = options
              .filter((_, index) => (index + seed) % 3 === 0)
              .map((option) => option.value);
            return picked.length
              ? { questionId: question.id, valueJson: picked as Prisma.InputJsonValue }
              : null;
          }
          default:
            return { questionId: question.id, valueText: text?.body ?? 'Ingen noter.' };
        }
      });

      await prisma.review.create({
        data: {
          userId: reviewer.id,
          beverageId,
          rating,
          title: text?.title ?? null,
          body: text?.body ?? null,
          answers: {
            create: answers.filter((answer): answer is NonNullable<typeof answer> => answer !== null),
          },
        },
      });
      reviewCount += 1;
    }

    // Genberegn den denormaliserede bedømmelse fra rækkerne.
    const grouped = await prisma.review.groupBy({
      by: ['rating'],
      where: { beverageId, deletedAt: null },
      _count: { _all: true },
    });
    let total = 0;
    let count = 0;
    const buckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const group of grouped) {
      total += group.rating * group._count._all;
      count += group._count._all;
      const bucket = String(Math.round(group.rating));
      buckets[bucket] = (buckets[bucket] ?? 0) + group._count._all;
    }
    await prisma.beverage.update({
      where: { id: beverageId },
      data: {
        ratingAverage: count === 0 ? 0 : Number((total / count).toFixed(4)),
        ratingCount: count,
        ratingBuckets: buckets,
      },
    });
  }
  console.log(`  ${reviewCount} nye anmeldelser`);

  console.log('\nFærdig. Log ind i admin med:');
  console.log('  admin@maanslogen.dk / Maanslogen-Admin-1   (ADMIN)');
  console.log('  mod@maanslogen.dk   / Maanslogen-Mod-1     (MODERATOR)');
  console.log(`  admin-id: ${admin.id}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
