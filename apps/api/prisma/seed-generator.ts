/**
 * Genererer et katalog i en størrelse man kan mærke.
 *
 * De 17 håndskrevne drikkevarer i seed.ts bliver stående — de er rigtige
 * produkter og gode at vise frem. Her lægges der hundredvis af genererede
 * oven i, så paginering, facettællinger og smagsprofiler bliver afprøvet med
 * noget der ligner virkeligheden.
 *
 * Alt er deterministisk. Den samme seed giver de samme data hver gang, ellers
 * ville et skærmbillede eller en fejlrapport ikke kunne genskabes.
 */

/** mulberry32 — lille, hurtig, og god nok til testdata. */
export function tilfaeldig(froe: number): () => number {
  let a = froe;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/**
 * UUID'er ud af den samme strøm som resten. Uden dem ville to kørsler mod hver
 * sin tomme database give forskellige id'er, og så kunne et skærmbillede eller
 * en fejlrapport alligevel ikke genskabes.
 */
export function uuid(rng: Rng): string {
  const h = '0123456789abcdef';
  let ud = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) ud += '-';
    else if (i === 14) ud += '4';
    else if (i === 19) ud += h[(Math.floor(rng() * 16) & 0x3) | 0x8];
    else ud += h[Math.floor(rng() * 16)];
  }
  return ud;
}

export const vaelg = <T>(rng: Rng, liste: readonly T[]): T =>
  liste[Math.floor(rng() * liste.length)] as T;

export const heltal = (rng: Rng, fra: number, til: number): number =>
  fra + Math.floor(rng() * (til - fra + 1));

export const decimal = (rng: Rng, fra: number, til: number, decimaler = 1): number =>
  Number((fra + rng() * (til - fra)).toFixed(decimaler));

/**
 * Bedømmelser er ikke jævnt fordelt. Folk der gider skrive en anmeldelse,
 * giver sjældent 1 — tyngden ligger omkring 3,5–4,5 med en hale nedad.
 * Tre tilfældige tal lagt sammen giver en klokkeform; den skubbes opad og
 * rundes til halve stjerner, som er det kontrakterne tillader.
 */
export function bedoemmelse(rng: Rng): number {
  const klokke = (rng() + rng() + rng()) / 3;
  const raa = 1 + klokke * 4 + 0.55;
  return Math.min(5, Math.max(1, Math.round(raa * 2) / 2));
}

// ---- Ordbanker ------------------------------------------------------------

const BRYGHUS_FORLED = [
  'Nørre',
  'Vester',
  'Øster',
  'Søndre',
  'Gamle',
  'Lille',
  'Store',
  'Hvide',
  'Sorte',
  'Røde',
  'Skovs',
  'Havnens',
  'Bakkens',
  'Engens',
  'Klitmøller',
  'Ravnsborg',
  'Møllers',
  'Bjergets',
  'Fjordens',
  'Hedens',
  'Stjerne',
  'Tågelund',
  'Kildevang',
  'Ellebæk',
];
const BRYGHUS_EFTERLED = ['Bryghus', 'Bryggeri', 'Bryglaug', 'Ølværk', 'Brygværk'];

const OEL_TILLAEG = [
  'Sortmosset',
  'Gyldne',
  'Tågede',
  'Vilde',
  'Stille',
  'Rå',
  'Modige',
  'Tunge',
  'Lyse',
  'Bitre',
  'Solmodne',
  'Kolde',
  'Dybe',
  'Skarpe',
  'Bløde',
  'Barske',
  'Glemte',
  'Første',
  'Sidste',
  'Lange',
  'Korte',
  'Salte',
  'Søde',
  'Tørre',
];
const OEL_SUBSTANTIV = [
  'Nat',
  'Morgen',
  'Sommer',
  'Vinter',
  'Høst',
  'Storm',
  'Tåge',
  'Sol',
  'Måne',
  'Skov',
  'Klit',
  'Fjord',
  'Bølge',
  'Sten',
  'Rug',
  'Humle',
  'Malt',
  'Krone',
  'Anker',
  'Fyr',
  'Ravn',
  'Ulv',
  'Hjort',
  'Ørn',
];

const VIN_HUS_FORLED = ['Château', 'Domaine', 'Tenuta', 'Bodega', 'Quinta', 'Weingut', 'Clos'];
const VIN_HUS_NAVN = [
  'Beauregard',
  'Montclair',
  'Valdespino',
  'Rosseti',
  'Lambert',
  'Ferrand',
  'Aurelio',
  'Santarelli',
  'Kronberg',
  'Delacroix',
  'Fontanella',
  'Marchetti',
  'Vallée',
  'Roquefort',
  'Sanvito',
  'Ordoñez',
  'Guerrero',
  'Steinbach',
];
const VIN_MARK = [
  'Les Hauts',
  'Grand Cru',
  'Vieilles Vignes',
  'Riserva',
  'Gran Reserva',
  'Alte Reben',
  'Vigna Alta',
  'La Pente',
  'Le Clos',
  'Terrazas',
  'Kalkstein',
  'Sur Lie',
];

const DESTILLERI_FORLED = [
  'Glen',
  'Ben',
  'Craig',
  'Loch',
  'Kil',
  'Dun',
  'Auch',
  'Bal',
  'Inver',
  'Ard',
  'Tober',
  'Strath',
];
const DESTILLERI_EFTERLED = [
  'morangie',
  'fiddich',
  'livet',
  'ronach',
  'nahabhain',
  'mory',
  'garvie',
  'lochy',
  'darroch',
  'begie',
  'kinnon',
  'vullin',
];

const GIN_FORLED = [
  'Juniper',
  'Botanical',
  'Copper',
  'Nordic',
  'Wild',
  'Old',
  'Crown',
  'Harbour',
  'Garden',
  'Seven',
  'Silver',
  'Thistle',
];
const GIN_EFTERLED = ['Hall', 'Works', 'House', 'Yard', 'Still', 'Row', 'Lane', 'Quay'];

const ROM_FORLED = [
  'Isla',
  'Costa',
  'Puerto',
  'Casa',
  'Hacienda',
  'Ron de',
  'Bahía',
  'Punta',
  'Palma',
  'Vista',
];
const ROM_EFTERLED = [
  'Verde',
  'del Sol',
  'Blanca',
  'Azul',
  'Dorada',
  'Vieja',
  'Real',
  'Negra',
  'Antigua',
  'Serena',
];

const CIDER_GAARD = [
  'Æblegård',
  'Frugtlund',
  'Havegård',
  'Pometet',
  'Dyssegård',
  'Kirsebærlund',
  'Solbakken',
  'Høstgård',
  'Bakkely',
  'Frugthaven',
];
const AEBLESORTER = [
  'Ingrid Marie',
  'Cox Orange',
  'Belle de Boskoop',
  'Filippa',
  'Guldborg',
  'Rød Ananas',
  'Pigeon',
  'Gråsten',
  'Discovery',
  'Holsteiner',
];

const FORNAVNE = [
  'Anders',
  'Astrid',
  'Bjørn',
  'Camilla',
  'Ditte',
  'Emil',
  'Freja',
  'Gustav',
  'Hanne',
  'Ida',
  'Jakob',
  'Karen',
  'Lars',
  'Maja',
  'Nikolaj',
  'Olivia',
  'Peter',
  'Rikke',
  'Søren',
  'Trine',
  'Ulrik',
  'Vibeke',
  'William',
  'Yasmin',
  'Zenia',
  'Mikkel',
  'Sofie',
  'Kasper',
  'Laura',
  'Mads',
  'Nanna',
  'Oscar',
  'Pernille',
  'Rasmus',
  'Signe',
  'Thomas',
  'Amalie',
  'Frederik',
  'Josefine',
  'Malthe',
];
const EFTERNAVNE = [
  'Jensen',
  'Nielsen',
  'Hansen',
  'Pedersen',
  'Andersen',
  'Christensen',
  'Larsen',
  'Sørensen',
  'Rasmussen',
  'Jørgensen',
  'Petersen',
  'Madsen',
  'Kristensen',
  'Olsen',
  'Thomsen',
  'Christiansen',
  'Poulsen',
  'Johansen',
  'Møller',
  'Mortensen',
];

const LANDE = ['DK', 'DK', 'DK', 'SE', 'NO', 'DE', 'GB', 'BE', 'FR', 'IT', 'ES', 'US'];

// ---- Generatorer ----------------------------------------------------------

export function maerkenavn(rng: Rng, kategori: string): string {
  switch (kategori) {
    case 'Øl':
      return `${vaelg(rng, BRYGHUS_FORLED)} ${vaelg(rng, BRYGHUS_EFTERLED)}`;
    case 'Vin':
      return `${vaelg(rng, VIN_HUS_FORLED)} ${vaelg(rng, VIN_HUS_NAVN)}`;
    case 'Whisky':
      return `${vaelg(rng, DESTILLERI_FORLED)}${vaelg(rng, DESTILLERI_EFTERLED)}`;
    case 'Gin':
      return `${vaelg(rng, GIN_FORLED)} ${vaelg(rng, GIN_EFTERLED)}`;
    case 'Rom':
      return `${vaelg(rng, ROM_FORLED)} ${vaelg(rng, ROM_EFTERLED)}`;
    default:
      return `${vaelg(rng, CIDER_GAARD)}`;
  }
}

export function drikkevarenavn(rng: Rng, kategori: string, type: string): string {
  switch (kategori) {
    case 'Øl':
      return `${vaelg(rng, OEL_TILLAEG)} ${vaelg(rng, OEL_SUBSTANTIV)}`;
    case 'Vin':
      return `${vaelg(rng, VIN_MARK)} ${heltal(rng, 2014, 2023)}`;
    case 'Whisky':
      return `${heltal(rng, 8, 25)} År ${vaelg(rng, ['Single Malt', 'Cask Strength', 'Small Batch', 'Reserve'])}`;
    case 'Gin':
      return `${vaelg(rng, ['Dry', 'Navy Strength', 'Barrel Aged', 'Citrus', 'Signature'])} Gin`;
    case 'Rom':
      return `${heltal(rng, 5, 23)} Años ${vaelg(rng, ['Reserva', 'Gran Reserva', 'Extra Añejo', 'Solera'])}`;
    default:
      return `${vaelg(rng, AEBLESORTER)} ${type}`;
  }
}

export const land = (rng: Rng): string => vaelg(rng, LANDE);

export function person(rng: Rng, nummer: number): { navn: string; email: string } {
  const navn = `${vaelg(rng, FORNAVNE)} ${vaelg(rng, EFTERNAVNE)}`;
  // Nummeret i adressen sikrer at to ens navne ikke kolliderer.
  const lokal = navn
    .toLowerCase()
    .replace(/[^a-z]/g, '.')
    .replace(/\.+/g, '.');
  return { navn, email: `${lokal}${nummer}@example.dk` };
}

/**
 * Attributværdier der holder sig inden for definitionernes regler. Seeden
 * skriver direkte gennem Prisma og går altså uden om valideringen, så det er
 * her ansvaret ligger for at kataloget ikke fyldes med tal appen selv ville
 * have afvist.
 */
export function attributvaerdier(
  rng: Rng,
  kategori: string,
  type: string,
): Record<string, string | number | boolean | string[]> {
  const v: Record<string, string | number | boolean | string[]> = {
    organic: rng() < 0.3,
  };

  switch (kategori) {
    case 'Øl':
      v.alcohol_percent = decimal(rng, 3.5, type.includes('Imperial') ? 12 : 7.5);
      v.ibu = heltal(rng, 10, type.includes('IPA') ? 95 : 45);
      v.color = type.includes('Stout') ? 'dark' : type.includes('Pilsner') ? 'light' : 'amber';
      v.serving_temp = heltal(rng, 4, 12);
      break;
    case 'Vin':
      v.alcohol_percent = decimal(rng, 10.5, 15);
      {
        const druer = [
          vaelg(rng, ['cabernet_sauvignon', 'merlot', 'chardonnay', 'riesling', 'pinot_noir']),
        ];
        // En tredjedel af vinene er blandinger.
        if (rng() < 0.35) {
          const to = vaelg(rng, ['merlot', 'chardonnay', 'pinot_noir']);
          if (!druer.includes(to)) druer.push(to);
        }
        v.grape_variety = druer;
      }
      v.serving_temp = heltal(rng, 6, 18);
      break;
    case 'Whisky':
    case 'Rom':
      v.alcohol_percent = decimal(rng, 40, kategori === 'Whisky' ? 58 : 50);
      v.age_years = heltal(rng, 3, kategori === 'Whisky' ? 25 : 23);
      v.cask_type = vaelg(rng, ['ex_bourbon', 'sherry', 'port', 'virgin_oak']);
      v.serving_temp = heltal(rng, 16, 22);
      break;
    case 'Gin':
      v.alcohol_percent = decimal(rng, 37.5, 57);
      v.serving_temp = heltal(rng, 4, 10);
      break;
    default:
      v.alcohol_percent = decimal(rng, 2.5, 8);
      v.serving_temp = heltal(rng, 4, 10);
  }
  return v;
}

const AABNING = [
  'Købte den på en tilfældig fredag og fortrød ikke',
  'Havde hørt godt om den, og den levede op til det',
  'Stod i køleskabet et halvt år for længe',
  'Fik den anbefalet af ham i den lokale butik',
  'Tog den med til en middag hos naboen',
  'Første gang jeg prøver noget fra dem',
  'Et indfald, og et godt et af slagsen',
  'Den har stået på ønskelisten længe',
];
const MIDTE = [
  'Duften er det bedste ved den',
  'Balancen er fin hele vejen igennem',
  'Den er mere kompleks end jeg regnede med',
  'Eftersmagen trækker lidt ud',
  'Lidt for sød til mig, men velbygget',
  'Den åbner sig efter et kvarter i glasset',
  'Man skal have lidt tålmodighed med den',
  'Ikke noget der overrasker, men solidt',
  'Sødmen og syren går fint i spænd',
  'Den er tørrere end etiketten lover',
];
const SLUT = [
  'Køber den helt sikkert igen',
  'Den skal prøves til mad næste gang',
  'Vil gerne smage den igen om et år',
  'Måske ikke hverdagsvare, men til en søndag',
  'Anbefales hvis man kan lide den stil',
  'Jeg bliver ved min sædvanlige næste gang',
  'Står nu fast på listen',
  'Den fik lov at blive færdig, og det siger lidt',
];

export function anmeldelsestekst(rng: Rng): string {
  const dele = [vaelg(rng, AABNING), vaelg(rng, MIDTE)];
  if (rng() < 0.75) dele.push(vaelg(rng, SLUT));
  return dele.join('. ') + '.';
}

/**
 * Hvor mange anmeldelser en drikkevare får. Fordelingen er skæv med vilje: de
 * fleste har en håndfuld, og nogle få har rigtig mange. Det er sådan et
 * katalog ser ud, og det er også det der afprøver begge yderpunkter —
 * smagsprofilen på en populær vare, og "for få anmeldelser"-tilfældet.
 */
export function antalAnmeldelser(rng: Rng, maksBrugere: number): number {
  const r = rng();
  if (r < 0.08) return heltal(rng, 0, 1);
  if (r < 0.65) return heltal(rng, 3, 12);
  if (r < 0.93) return heltal(rng, 13, 35);
  return Math.min(maksBrugere, heltal(rng, 36, 90));
}
