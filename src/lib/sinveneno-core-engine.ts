// ============================================================
// SinVeneno Core Engine v1.0
// Arquitectura: NLM Synthesis + Gemini TypeScript + Colmena debate
// Tres capas en cascada con cortocircuito en primer ROJO
// ============================================================

export type RiskStatus = 'RED' | 'YELLOW' | 'GREEN' | 'UNKNOWN';
export type Layer = 'CAPA_1_ACEITES' | 'CAPA_2_METALES' | 'CAPA_3_PLASTICOS' | 'NINGUNA' | 'TIMEOUT';

export interface ScanInput {
  ingredientsRaw: string;
  barcode?: string;
  productName?: string;
  packagingMaterial?: 'plastico' | 'lata' | 'vidrio' | 'tetrapak' | 'multicapa' | 'desconocido';
  category?: string;
  isOrganic?: boolean;
}

export interface AuditResult {
  status: RiskStatus;
  layerTriggered: Layer;
  reason: string;
  triggeredTokens: string[];
  metalScore?: number;
  executionTimeMs: number;
}

const OIL_TOKENS_MAX: Set<string> = new Set([
  'aceite de soya', 'aceite de soja', 'aceite de canola', 'aceite de colza',
  'aceite de girasol', 'aceite de maíz', 'aceite de maiz', 'aceite de cártamo',
  'aceite de cartamo', 'aceite de algodón', 'aceite de algodon', 'aceite de palma',
  'aceite de palmiste', 'aceite de cacahuate', 'aceite de cacahuete',
  'aceite de ajonjolí', 'aceite de ajonjoli', 'aceite de sésamo', 'aceite de sesamo',
  'aceite de linaza', 'aceite de pepita', 'aceite de arroz',
  'aceite vegetal', 'aceites vegetales', 'aceite vegetal refinado',
  'mezcla de aceites vegetales', 'grasa vegetal', 'grasas vegetales',
  'manteca vegetal', 'shortening vegetal', 'shortening',
  'aceite parcialmente hidrogenado', 'aceite hidrogenado',
  'grasa parcialmente hidrogenada', 'grasa hidrogenada',
  'aceite interesterificado', 'grasa interesterificada',
  'mono y diglicéridos de ácidos grasos', 'mono y digliceridos de acidos grasos',
  'monoglicéridos', 'monogliceridos', 'diglicéridos', 'digliceridos',
  'estearoil lactilato de sodio', 'estearoil-2-lactilato de sodio', 'ssl',
  'ésteres de propilenglicol', 'esteres de propilenglicol', 'pgms',
  'e471', 'e472', 'e473', 'e474', 'e475', 'e476', 'e477', 'e481', 'e482',
  'polisorbato 60', 'polisorbato 65', 'polisorbato 80',
  'lecitina de soya', 'lecitina de soja', 'lecitina de girasol',
  'tbhq', 'bht', 'bha', 'terciario butilhidroquinona',
  'hidroxitolueno butilado', 'hidroxianisol butilado',
  'olestra', 'salatrim',
  'soybean oil', 'canola oil', 'sunflower oil', 'corn oil', 'safflower oil',
  'cottonseed oil', 'palm oil', 'palm kernel oil', 'vegetable oil',
  'partially hydrogenated', 'hydrogenated vegetable',
  'mono and diglycerides', 'soy lecithin', 'sunflower lecithin',
]);

const OIL_WHITELIST: Set<string> = new Set([
  'aceite de oliva', 'aceite de oliva extra virgen', 'aceite de oliva virgen extra',
  'extra virgin olive oil', 'olive oil', 'aceite de aguacate', 'avocado oil',
  'aceite de coco', 'coconut oil', 'aceite de coco virgen', 'aceite mct',
  'mct oil', 'aceite de mantequilla', 'mantequilla', 'ghee', 'manteca de cerdo',
  'aceite de palma rojo', 'red palm oil',
]);

interface MetalEntry { score: number; metals: string[]; organicMitigator: number; reason: string; }
const METAL_TABLE: Record<string, MetalEntry> = {
  'jarabe de maíz de alta fructosa': { score: 85, metals: ['As','Pb','Hg'], organicMitigator: 0.70, reason: 'Suelos mineros Hidalgo + proceso cloro-álcali' },
  'jarabe de maiz de alta fructosa': { score: 85, metals: ['As','Pb','Hg'], organicMitigator: 0.70, reason: 'Suelos mineros Hidalgo + proceso cloro-álcali' },
  'jmaf': { score: 85, metals: ['As','Pb','Hg'], organicMitigator: 0.70, reason: 'Proceso cloro-álcali' },
  'high fructose corn syrup': { score: 85, metals: ['As','Pb','Hg'], organicMitigator: 0.70, reason: 'Proceso cloro-álcali' },
  'hfcs': { score: 85, metals: ['As','Pb','Hg'], organicMitigator: 0.70, reason: 'Proceso cloro-álcali' },
  'harina de maíz nixtamalizada': { score: 70, metals: ['As','Pb','Cd'], organicMitigator: 0.70, reason: 'Suelos agrícolas México' },
  'harina nixtamalizada': { score: 70, metals: ['As','Pb','Cd'], organicMitigator: 0.70, reason: 'Suelos agrícolas México' },
  'masa de maíz': { score: 65, metals: ['As','Pb','Cd'], organicMitigator: 0.70, reason: 'Suelos agrícolas México' },
  'almidón de maíz': { score: 55, metals: ['As','Pb'], organicMitigator: 0.70, reason: 'Derivado maíz convencional' },
  'almidon de maiz': { score: 55, metals: ['As','Pb'], organicMitigator: 0.70, reason: 'Derivado maíz convencional' },
  'maltodextrina': { score: 50, metals: ['As','Pb'], organicMitigator: 0.70, reason: 'Mayoritariamente maíz en México' },
  'arroz': { score: 75, metals: ['As'], organicMitigator: 0.70, reason: 'Bioacumulador arsénico inorgánico' },
  'harina de arroz': { score: 70, metals: ['As'], organicMitigator: 0.70, reason: 'Arsénico concentrado' },
  'salvado de arroz': { score: 80, metals: ['As'], organicMitigator: 0.70, reason: 'Arsénico en cáscara' },
  'proteína de arroz': { score: 75, metals: ['As'], organicMitigator: 0.70, reason: 'Concentración arsénico proteína' },
  'leche de arroz': { score: 65, metals: ['As'], organicMitigator: 0.70, reason: 'Arsénico solubilizado' },
  'rice flour': { score: 70, metals: ['As'], organicMitigator: 0.70, reason: 'Rice arsenic bioaccumulator' },
  'brown rice': { score: 78, metals: ['As'], organicMitigator: 0.70, reason: 'Higher arsenic in bran' },
  'cacao': { score: 80, metals: ['Cd','Pb'], organicMitigator: 0.70, reason: 'Cadmio suelos volcánicos' },
  'cocoa': { score: 80, metals: ['Cd','Pb'], organicMitigator: 0.70, reason: 'Cadmio suelos volcánicos' },
  'polvo de cacao': { score: 85, metals: ['Cd','Pb'], organicMitigator: 0.70, reason: 'Concentración cadmio en polvo' },
  'cocoa powder': { score: 85, metals: ['Cd','Pb'], organicMitigator: 0.70, reason: 'Concentración cadmio en polvo' },
  'chocolate': { score: 75, metals: ['Cd','Pb'], organicMitigator: 0.70, reason: 'Derivado cacao' },
  'atún': { score: 85, metals: ['Hg'], organicMitigator: 0.0, reason: 'Mercurio cadena trófica' },
  'atun': { score: 85, metals: ['Hg'], organicMitigator: 0.0, reason: 'Mercurio cadena trófica' },
  'tuna': { score: 85, metals: ['Hg'], organicMitigator: 0.0, reason: 'Mercury bioaccumulation' },
  'pez espada': { score: 95, metals: ['Hg'], organicMitigator: 0.0, reason: 'Depredador tope — mercurio máximo' },
  'salmón': { score: 60, metals: ['Hg','Pb'], organicMitigator: 0.0, reason: 'Mercurio moderado' },
  'salmon': { score: 60, metals: ['Hg','Pb'], organicMitigator: 0.0, reason: 'Mercurio moderado' },
  'chile en polvo': { score: 80, metals: ['Pb'], organicMitigator: 0.60, reason: 'Litargirio histórico México' },
  'chili powder': { score: 80, metals: ['Pb'], organicMitigator: 0.60, reason: 'Litargirio histórico México' },
  'cúrcuma': { score: 85, metals: ['Pb'], organicMitigator: 0.60, reason: 'Adulteración plomo cromato' },
  'curcuma': { score: 85, metals: ['Pb'], organicMitigator: 0.60, reason: 'Adulteración plomo cromato' },
  'turmeric': { score: 85, metals: ['Pb'], organicMitigator: 0.60, reason: 'Lead chromate adulteration' },
  'paprika': { score: 70, metals: ['Pb','Cd'], organicMitigator: 0.60, reason: 'Suelos ibéricos contaminados' },
  'pimentón': { score: 70, metals: ['Pb','Cd'], organicMitigator: 0.60, reason: 'Suelos ibéricos contaminados' },
  'sal de mar': { score: 65, metals: ['Hg','Pb'], organicMitigator: 0.0, reason: 'Indicador ambiental océano' },
  'sea salt': { score: 65, metals: ['Hg','Pb'], organicMitigator: 0.0, reason: 'Ocean environmental indicator' },
  'miel': { score: 60, metals: ['Pb','Hg'], organicMitigator: 0.0, reason: 'Indicador ambiental floral' },
  'honey': { score: 60, metals: ['Pb','Hg'], organicMitigator: 0.0, reason: 'Environmental indicator' },
  'agave': { score: 55, metals: ['Pb','Cd'], organicMitigator: 0.70, reason: 'Suelo volcánico Jalisco' },
  'jarabe de agave': { score: 55, metals: ['Pb','Cd'], organicMitigator: 0.70, reason: 'Suelo volcánico Jalisco' },
  'proteína de soya': { score: 65, metals: ['Cd','As'], organicMitigator: 0.70, reason: 'Cadmio suelos soya' },
  'proteína aislada de soya': { score: 70, metals: ['Cd','As'], organicMitigator: 0.70, reason: 'Concentración cadmio aislado' },
  'soy protein': { score: 65, metals: ['Cd','As'], organicMitigator: 0.70, reason: 'Cadmio suelos soya' },
  'pea protein': { score: 55, metals: ['Cd'], organicMitigator: 0.70, reason: 'Cadmio leguminosas' },
};

const METAL_ALERT_THRESHOLD = 65;

interface PackagingRule { keywords: string[]; packagingRisk: string[]; hotfill: boolean; risk: RiskStatus; reason: string; }
const HOTFILL_CATEGORIES: PackagingRule[] = [
  { keywords: ['salsa', 'ketchup', 'catsup', 'puré de tomate', 'pure de tomate'], packagingRisk: ['plastico','lata','pouch'], hotfill: true, risk: 'RED', reason: 'Líquido ácido hot-fill >85°C — antimonio/BPA' },
  { keywords: ['jugo', 'néctar', 'nectar', 'juice'], packagingRisk: ['plastico','tetrapak','lata'], hotfill: true, risk: 'RED', reason: 'Ácido cítrico + pasteurización hot-fill' },
  { keywords: ['salsa picante', 'hot sauce', 'valentina', 'búfalo', 'cholula', 'tabasco'], packagingRisk: ['plastico','lata'], hotfill: true, risk: 'RED', reason: 'Ácido + capsaicina + hot-fill' },
  { keywords: ['sopa', 'caldo enlatado', 'consomé enlatado'], packagingRisk: ['lata'], hotfill: true, risk: 'RED', reason: 'BPA recubrimiento lata + llenado caliente' },
  { keywords: ['frijoles enlatados', 'frijoles de lata', 'canned beans'], packagingRisk: ['lata'], hotfill: true, risk: 'RED', reason: 'BPA + proceso térmico lata' },
  { keywords: ['atún', 'atun', 'tuna', 'sardinas en lata', 'salmón enlatado'], packagingRisk: ['lata'], hotfill: true, risk: 'RED', reason: 'BPA lata + mercurio producto' },
  { keywords: ['té listo', 'te listo', 'iced tea', 'té frío', 'infusion lista'], packagingRisk: ['plastico','lata','tetrapak'], hotfill: true, risk: 'RED', reason: 'Taninos ácidos + hot-fill PET — antimonio' },
  { keywords: ['energizante', 'energy drink', 'monster', 'red bull'], packagingRisk: ['lata','plastico'], hotfill: false, risk: 'RED', reason: 'Lata aluminio + ácido cítrico' },
  { keywords: ['miel'], packagingRisk: ['plastico'], hotfill: true, risk: 'RED', reason: 'Miel viscosa caliente en plástico — ftalatos' },
  { keywords: ['mayonesa', 'aderezo', 'mayonnaise', 'dressing', 'ranch'], packagingRisk: ['plastico','pouch'], hotfill: true, risk: 'RED', reason: 'Emulsión grasa ácida + hot-fill' },
  { keywords: ['sopa instantánea', 'fideo instantáneo', 'ramen', 'maruchan', 'cup noodles'], packagingRisk: ['poliestireno'], hotfill: false, risk: 'RED', reason: 'Poliestireno + agua hirviendo — estireno' },
  { keywords: ['aceite'], packagingRisk: ['plastico'], hotfill: false, risk: 'RED', reason: 'Aceite lipofílico + PET — disuelve ftalatos' },
  { keywords: ['chips', 'sabritas', 'frituras', 'cheetos', 'takis', 'doritos', 'palomitas'], packagingRisk: ['multicapa'], hotfill: false, risk: 'YELLOW', reason: 'Termo-sellado multicapa — tintas y adhesivos' },
  { keywords: ['cereal', 'granola', 'avena instantánea', 'oatmeal'], packagingRisk: ['plastico'], hotfill: false, risk: 'YELLOW', reason: 'Bolsa plástico — micropartículas fricción' },
  { keywords: ['galletas', 'cookies', 'crackers'], packagingRisk: ['plastico'], hotfill: false, risk: 'YELLOW', reason: 'Bandeja o bolsa PET — fricción microplásticos' },
];

const LEACHING_PACKAGING: Set<string> = new Set(['plastico', 'lata', 'pouch', 'multicapa', 'poliestireno', 'tetrapak']);
const INERT_PACKAGING: Set<string> = new Set(['vidrio']);

function normalizeOCR(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/\|/g, 'l')
    .replace(/\$/g, 's')
    .replace(/\@/g, 'a')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,.:;()\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function auditProduct(input: ScanInput): AuditResult {
  const startTime = Date.now();
  const triggeredTokens: string[] = [];

  const cleanText = normalizeOCR(input.ingredientsRaw || '');
  const tokens = cleanText.split(/[\s,;:()\-\/\.]+/).filter(t => t.length > 1);

  const hasWhitelistedOil = Array.from(OIL_WHITELIST).some(w => cleanText.includes(w));

  for (const phrase of OIL_TOKENS_MAX) {
    const compactPhrase = phrase.replace(/\s+/g, '');
    if (cleanText.replace(/\s+/g, '').includes(compactPhrase) && !hasWhitelistedOil) {
      if (!triggeredTokens.includes(phrase)) triggeredTokens.push(phrase);
    }
  }

  for (const token of tokens) {
    if (OIL_TOKENS_MAX.has(token) && !hasWhitelistedOil) {
      if (!triggeredTokens.includes(token)) triggeredTokens.push(token);
    }
  }

  for (const phrase of OIL_TOKENS_MAX) {
    if (phrase.includes(' ') && cleanText.includes(phrase)) {
      if (!hasWhitelistedOil || !Array.from(OIL_WHITELIST).some(w => cleanText.includes(w) && cleanText.indexOf(w) === cleanText.indexOf(phrase))) {
        if (!triggeredTokens.includes(phrase)) triggeredTokens.push(phrase);
      }
    }
  }

  if (triggeredTokens.length > 0) {
    return {
      status: 'RED',
      layerTriggered: 'CAPA_1_ACEITES',
      reason: `Aceite de semilla detectado: ${triggeredTokens.slice(0,3).join(', ')}. Omega-6 pro-inflamatorio — tolerancia cero.`,
      triggeredTokens,
      executionTimeMs: Date.now() - startTime,
    };
  }

  let metalScore = 0;
  const metalTriggers: string[] = [];

  for (const token of tokens) {
    if (METAL_TABLE[token]) {
      const entry = METAL_TABLE[token];
      const adjustedScore = input.isOrganic ? entry.score * entry.organicMitigator : entry.score;
      if (adjustedScore > metalScore) metalScore = adjustedScore;
      metalTriggers.push(`${token}(${Math.round(adjustedScore)})`);
    }
  }

  for (const phrase of Object.keys(METAL_TABLE)) {
    if (phrase.includes(' ') && cleanText.includes(phrase)) {
      const entry = METAL_TABLE[phrase];
      const adjustedScore = input.isOrganic ? entry.score * entry.organicMitigator : entry.score;
      if (adjustedScore > metalScore) metalScore = adjustedScore;
      if (!metalTriggers.find(t => t.startsWith(phrase))) {
        metalTriggers.push(`${phrase}(${Math.round(adjustedScore)})`);
      }
    }
  }

  if (metalScore >= METAL_ALERT_THRESHOLD) {
    const topTrigger = metalTriggers[0] || '';
    const ingredient = topTrigger.split('(')[0];
    const reason = METAL_TABLE[ingredient]?.reason || 'Bioacumulador de metales pesados';
    const organicNote = input.isOrganic ? ' (sello orgánico reduce riesgo pero NO lo elimina — persistencia histórica en suelos)' : '';

    return {
      status: 'RED',
      layerTriggered: 'CAPA_2_METALES',
      reason: `Metal pesado detectado por inferencia: ${ingredient}. ${reason}.${organicNote}`,
      triggeredTokens: metalTriggers,
      metalScore: Math.round(metalScore),
      executionTimeMs: Date.now() - startTime,
    };
  }

  if (metalScore > 0 && metalScore < METAL_ALERT_THRESHOLD) {
    triggeredTokens.push(...metalTriggers);
  }

  const packaging = input.packagingMaterial || 'desconocido';
  const hasLeachingPackaging = LEACHING_PACKAGING.has(packaging);
  const hasInertPackaging = INERT_PACKAGING.has(packaging);
  const productCategory = (input.category || input.productName || '').toLowerCase();

  if (!hasInertPackaging) {
    for (const rule of HOTFILL_CATEGORIES) {
      const categoryMatch = rule.keywords.some(kw => productCategory.includes(kw));
      const packagingMatch = packaging === 'desconocido' || rule.packagingRisk.includes(packaging);

      if (categoryMatch && packagingMatch) {
        if (rule.risk === 'RED') {
          return {
            status: 'RED',
            layerTriggered: 'CAPA_3_PLASTICOS',
            reason: rule.reason,
            triggeredTokens: [rule.keywords[0], packaging],
            executionTimeMs: Date.now() - startTime,
          };
        }
        if (rule.risk === 'YELLOW') {
          return {
            status: 'YELLOW',
            layerTriggered: 'CAPA_3_PLASTICOS',
            reason: `Advertencia empaque: ${rule.reason}`,
            triggeredTokens: [rule.keywords[0], packaging],
            executionTimeMs: Date.now() - startTime,
          };
        }
      }
    }

    if (hasLeachingPackaging && packaging !== 'desconocido') {
      return {
        status: 'YELLOW',
        layerTriggered: 'CAPA_3_PLASTICOS',
        reason: `Producto en envase reactivo (${packaging}). Riesgo menor de micropartículas por almacenamiento.`,
        triggeredTokens: [packaging],
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  if (metalScore > 0) {
    return {
      status: 'YELLOW',
      layerTriggered: 'CAPA_2_METALES',
      reason: `Precaución: ingredientes con riesgo moderado de bioacumulación (score: ${Math.round(metalScore)}/100). Por debajo del umbral de alerta.`,
      triggeredTokens,
      metalScore: Math.round(metalScore),
      executionTimeMs: Date.now() - startTime,
    };
  }

  return {
    status: 'GREEN',
    layerTriggered: 'NINGUNA',
    reason: 'Producto pasa la auditoría SinVeneno. Sin aceites de semillas, sin bioacumuladores críticos, empaque inerte o de bajo riesgo.',
    triggeredTokens: [],
    executionTimeMs: Date.now() - startTime,
  };
}
