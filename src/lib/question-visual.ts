import type { IconName } from '../components/Icon.astro';

/** Topic cues only: these graphics never assert an approval, certification or technical result. */
const iconsById: Readonly<Record<string, IconName>> = Object.freeze({
  'f-a2': 'panels',
  'f-a14': 'calendar',
  'f-a19': 'roll',
  'f-a20': 'book',
  'f-a21': 'drawing',
  'f-a35': 'tag',
  'f-b1': 'room',
  'f-b4': 'calendar',
  'f-b5': 'drawing',
  'f-b7': 'roll',
  'f-b9': 'calendar',
  'f-b11': 'search',
  'f-b16': 'drawing',
  'f-c8': 'tag',
  'f-c14': 'drawing',
  'f-c28': 'book',
  'f-d4': 'lock',
  'f-d26': 'tools',
  'f-q1': 'drawing',
  'f-q3': 'drawing',
  'f-q6': 'drawing',
  'f-q10': 'room',
  'f-q11': 'tools',
  's-joinery': 'tools',
  's-acoustic': 'layers',
  's-aftercare': 'tools',
  's-since-2012': 'calendar',
  's-listed': 'room',
  cost: 'tag',
  'lead-times': 'calendar',
  preparation: 'tools',
  supply: 'roll',
  aftercare: 'tools',
  'materials-area': 'swatch',
  'hp-lining': 'layers',
  'hp-sequence': 'panels',
  'gc-seams': 'swatch',
  'gc-clean': 'tools',
  'silk-marks': 'swatch',
  'fabric-wide': 'roll',
  'hotel-live': 'room',
  'hotel-package': 'layers',
  'mural-measure': 'ruler',
  'acoustic-where': 'layers',
  'af-what': 'layers',
  'af-occupied': 'room',
  'af-sample': 'swatch',
  'wf-types': 'layers',
  'wf-double': 'layers',
  'wf-remove': 'tools',
  'jp-doors': 'layers',
  'jp-bespoke': 'swatch',
  'jp-film-or-paper': 'layers',
  'jp-package': 'tools',
  'ex-scaffold': 'access',
  'ex-masonry': 'tools',
  'ex-windows': 'layers',
  'ex-interior': 'room',
  'commercial-dates': 'calendar',
  'commercial-supply': 'roll',
  'mayfair-hotel': 'room',
  'mayfair-survey': 'tag',
  'belgravia-listed': 'room',
  'belgravia-designer': 'drawing',
  'chelsea-single-room': 'room',
  'chelsea-aftercare': 'tools',
  'kensington-materials': 'swatch',
  'kensington-quantity': 'roll',
  'city-main-contractor': 'drawing',
  'city-programme': 'calendar',
  'cotswolds-travel': 'pin',
  'cotswolds-old-walls': 'tools',
  'tb-relationship': 'drawing',
  'tb-vinyl': 'roll',
  'tb-sample-room': 'drawing',
  'papers-relationship': 'drawing',
  'papers-supply': 'roll',
  'cost-per-roll': 'tag',
  'cost-wastage': 'roll',
  'cost-survey': 'tag',
  'trade-packages': 'layers',
  'trade-insurance': 'drawing',
  'trade-nights': 'calendar',
  'fitout-jct': 'drawing',
  'fitout-insurance': 'drawing',
  'fitout-mobilise': 'calendar',
  'calico-relationship': 'drawing',
  'calico-lining': 'layers',
  'calico-deadline': 'calendar',
  'hoh-relationship': 'drawing',
  'hoh-listed': 'room',
  'hoh-photos': 'camera',
  'heritage-listed': 'room',
  'heritage-lime': 'tools',
  'heritage-walls': 'tools',
});

/** Guide FAQs have no IDs; keep their exact topic choices as deliberate as the numbered questions. */
const iconsByQuestion: Readonly<Record<string, IconName>> = Object.freeze({
  'should the ceiling be papered before the walls?': 'layers',
  'how much extra wallpaper does a staircase need?': 'roll',
  'can a moulded or ornate ceiling be papered?': 'tools',
  'should i cut a bubble in wallpaper and glue it down?': 'tools',
  'can i wipe grasscloth or silk with a damp cloth?': 'swatch',
  'when does a wallcovering problem need a site inspection?': 'search',
  'can you hang new wallpaper over old wallpaper?': 'layers',
  'does wallpaper need lining paper?': 'layers',
  'which wallpaper paste do you use?': 'layers',
  'how do you know a wall is dry enough?': 'search',
  'where should the first drop of wallpaper go?': 'ruler',
  'what happens when the walls are not straight?': 'ruler',
  'what is overlap and splice?': 'layers',
  'are visible seams in grasscloth a fault?': 'swatch',
  'should alternate drops of grasscloth be reversed?': 'roll',
  'can grasscloth go in a bathroom or a busy hallway?': 'swatch',
  'is there a price per roll for wallpaper installation?': 'tag',
  'what should a wallpaper installation quotation include?': 'tag',
  'does the pattern repeat change the cost?': 'tag',
});

/** Known IDs stay consistent across pages; topic matching also supports new and unnumbered questions. */
export function questionIcon(question: string, id?: string): IconName {
  const assigned = id ? iconsById[id] : undefined;
  if (assigned) return assigned;

  const text = question.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const exact = iconsByQuestion[text];
  if (exact) return exact;
  if (/\b(nda|confidential|confidentiality|privacy|private client|permission)\b/.test(text)) return 'lock';
  if (/\b(photograph|photographs|photography|photos|images|picture|pictures)\b/.test(text)) return 'camera';
  // Price wins over a secondary material or pattern reference in the same question.
  if (/\b(price|prices|pricing|cost|costs|quotation|quote|budget|payment|payments|deposit|prelims|inclusions)\b/.test(text)) return 'tag';
  if (/fire|euroclass|\b(insurance|accreditation|accreditations|certification|certified|certificate|certificates|qualified|qualification|training|approval|approved|recommended|endorsement|endorse|rams|jct|contract|contracting|contracts|supervises|supervision)\b/.test(text)) return 'drawing';
  if (/acoustic|\b(adhesive|adhesives|primer|primers|paste|pasting|lining|backing|build-up|film|glazing)\b/.test(text)) return 'layers';
  if (/\b(quantity|quantities|waste|wastage|allowance|rolls|offcuts|spares)\b|how much (extra )?(wallpaper|paper)|how many/.test(text)) return 'roll';
  if (/first drop|not straight|crooked|true vertical|plumb/.test(text)) return 'ruler';
  if (/overlap|splice|new wallpaper over old|papered before the walls/.test(text)) return 'layers';
  if (/bubble|\bglue\b/.test(text)) return 'tools';
  if (/dry enough|damp|moisture|inspection|inspect|snagging|snags|assess|assessment/.test(text)) return 'search';
  if (/\b(repair|repairs|aftercare|care|clean|cleaning|wash|washable|damage|guarantee|warranty|maintenance)\b/.test(text)) return 'tools';
  if (/\b(lead time|lead times|book|booking|start|dates|date|deadline|programme|program|phasing|phase|nights|night|weekend|weekends|hours)\b|how (far ahead|long)/.test(text)) return 'calendar';
  if (/\b(measure|measurement|measurements|dimensions|dimension|width|height|survey|surveying)\b/.test(text)) return 'ruler';
  if (/\b(layout|sequence|sequencing|set-out|setting-out|pattern|drawing|drawings|elevation|elevations|scenic|mural|murals)\b/.test(text)) return 'drawing';
  if (/\b(handover|references|reference|record|records|documents|documentation|o&m|experience)\b/.test(text)) return 'book';
  if (/\b(supply|supplies|supplied|delivery|deliveries|batch|batches|faulty|short|roll|ordering)\b/.test(text)) return 'roll';
  if (/\b(scaffold|scaffolding|access|stairs|staircases)\b/.test(text)) return 'access';
  if (/\b(prepare|preparation|substrate|uneven|joinery|manufacture|limewash|render)\b/.test(text)) return 'tools';
  if (/\b(sample|samples|material|materials|texture|seam|seams|joints|silk|grasscloth|colour|color|finish|finishes)\b/.test(text)) return 'swatch';
  if (/\b(travel|outside|coverage|areas|area|where|london|cotswolds)\b/.test(text)) return 'pin';
  if (/\b(hotel|hotels|room|rooms|building|buildings|house|houses|home|homes|occupied|residence|residences)\b/.test(text)) return 'room';
  if (/\b(contact|email|enquiry|enquiries|send|discuss)\b/.test(text)) return 'mail';
  return 'book';
}
