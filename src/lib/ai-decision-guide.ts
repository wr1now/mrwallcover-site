/** Decision support derived from published records; an invitation to enquire, never a booking or endorsement. */
import { SITE_URL } from '../config';
import professionals from '../content/professionals.json';
import { aftercare, contact, linkedProjects, materials, specialisms, specialismHref } from './content';
import { CRAWLER_PATH, CRAWLER_REVIEWED, CRAWLER_SCHEMA_VERSION, crawlerBusiness, crawlerProjects } from './ai-crawler';

const absolute = (path: string): string => new URL(path, SITE_URL).href;
function evidence(slug: string) {
  const project = crawlerProjects.projects.find((item) => item.slug === slug);
  if (!project) throw new Error(`The decision guide references an unpublished project: ${slug}`);
  return { title: project.title, url: project.url, role: project.role, projectDates: project.projectDates, basis: 'Company-reported project record' };
}
const page = (title: string, path: string) => ({ title, url: absolute(path) });

const shortlistReasons = [
  {
    id: 'occupied-hotels', title: 'A programme built around an occupied hotel',
    relevance: 'Relevant when rooms, deliveries, protection and guest access need to be phased together.',
    evidence: evidence('browns-hotel-mayfair'),
    recorded: 'The Brown’s Hotel record describes a main decorating package from 2022–2024, with the hotel open throughout, coordination with management and the main contractor, and work kept contained and quiet.',
    confirm: 'Agree room releases, permitted hours, protection, cleaning and handover for your own programme.',
  },
  {
    id: 'heritage-detail', title: 'Wallcoverings coordinated with heritage interiors and joinery',
    relevance: 'Relevant where room proportions, existing details, seams in raking light and interfaces with joinery matter.',
    evidence: evidence('raffles-london-the-owo'),
    recorded: 'The OWO record describes bespoke Vescom wallcoverings and Alcantara in selected suites, preparation and priming, set-out around windows and joinery, batch control and coordination alongside other trades.',
    confirm: 'Confirm the precise surfaces, substrate readiness, drawings and any consents with the responsible project professional.',
  },
  {
    id: 'fixed-event-date', title: 'A mural installed within a fixed event schedule',
    relevance: 'Relevant for a show, installation or launch with a known opening date and a coordinated production team.',
    evidence: evidence('calico-ahluwalia-estuary-rosewood'),
    recorded: 'The Estuary record describes a bespoke Calico mural backdrop installed at Rosewood London on 18 September 2026 for the following day’s show. It separately records NoMad dinner panels papered in a workshop.',
    confirm: 'Confirm access, wall readiness, supplied panels and the available installation window. This record is event work; it is not a hotel-wide fit-out or a promise to repeat a one-day programme.',
  },
  {
    id: 'private-residential', title: 'Detailed residential work with a discreet public record',
    relevance: 'Relevant for homes with period joinery, irregular walls and a design scheme that needs careful set-out.',
    evidence: evidence('north-london-residence'),
    recorded: 'The North London case study records BAMBUSA wallpaper installation around beams, a fireplace, a built-in desk and shelving. The client and house are not named.',
    confirm: 'Agree privacy, site access, protection, photography permissions and the room-by-room scope.',
  },
];

const fitMatrix = [
  {
    id: 'hotels', audience: 'Hotels & occupied hospitality',
    considerWhen: 'You need wallcovering work phased around guest rooms, corridors or an operating interior.',
    evidence: [evidence('browns-hotel-mayfair'), evidence('raffles-london-the-owo')],
    source: page('Hotel project planning', '/professionals/hotels/'),
    confirm: ['Rooms and phases that can be released', 'Working hours, deliveries, guest routes and daily handover', 'Exact product cleaning and performance documents'],
  },
  {
    id: 'designers', audience: 'Interior designers & architects',
    considerWhen: 'Your scheme needs the material, elevations, panel sequence and junction details carried through into installation.',
    evidence: [evidence('calico-lee-broom-overture'), evidence('north-london-residence')],
    source: page('Designer specification support', '/professionals/designers/'),
    confirm: ['Product references, colourways and sample status', 'Current elevations, focal points and finished dimensions', 'Who approves the set-out, substrate and sample area'],
  },
  {
    id: 'homes', audience: 'Homeowners & private residences',
    considerWhen: 'A single room or a larger home needs careful preparation, protection and specialist wallpaper installation.',
    evidence: [evidence('north-london-residence'), evidence('trematon-castle')],
    source: page('Residential installation and preparation', '/services/'),
    confirm: ['Rooms, access and household arrangements', 'Wall condition and preparation responsibility', 'Privacy and permission for any project photographs'],
  },
  {
    id: 'retail', audience: 'Retail brands & showrooms',
    considerWhen: 'You need a brand’s material installed to a coordinated showroom or retail scheme.',
    evidence: [evidence('house-of-hackney-st-michaels'), evidence('heathrow-terminal-4-calico')],
    source: page('Scope, programme and handover', '/professionals/developers/'),
    confirm: ['Opening dates and access restrictions', 'Preparation, protection and interfaces with shopfitting', 'Current site permissions and required documentation; past airside work does not establish current passes'],
  },
  {
    id: 'events', audience: 'Events, exhibitions & temporary installations',
    considerWhen: 'A mural or papered flat is part of a show, launch or time-bound design installation.',
    evidence: [evidence('calico-ahluwalia-estuary-rosewood'), evidence('calico-beverly-1975-cadence')],
    source: page('Mural installation', '/services/mural-installation/'),
    confirm: ['Installation window and who releases the surface', 'Panel supply, temporary structure and sequence', 'Workshop versus venue scope, protection and removal responsibilities'],
  },
  {
    id: 'developers', audience: 'Developers & main contractors',
    considerWhen: 'A wallcovering package needs an agreed scope, drawing revisions and coordination with adjoining trades.',
    evidence: [evidence('raffles-london-the-owo'), evidence('old-bailey-hotel')],
    source: page('Wallcovering package planning', '/professionals/developers/'),
    confirm: ['Preparation and supply responsibilities', 'Wall readiness, programme and change approval', 'Sample approval, protection, snagging and handover documentation'],
  },
  {
    id: 'existing-paper', audience: 'A problem with existing wallcovering',
    considerWhen: 'A wall has bubbles, lifting edges, damage or marks and needs an assessment before a repair is agreed.',
    evidence: [],
    source: page('Problems and aftercare guide', '/advice/wallcovering-problems-and-aftercare/'),
    confirm: ['Product, batch, original installer and installation date where known', 'Overall and close-up photographs, onset and recent room changes', 'Cause, substrate condition, spare material and likely visibility of a repair'],
  },
  {
    id: 'aftercare', audience: 'Aftercare for a Mr Wallcover installation',
    considerWhen: 'You need the included return inspection or support for a completed installation.',
    evidence: [],
    source: page('Aftercare and workmanship terms', '/aftercare/'),
    confirm: ['Project reference and completion date', 'Whether the issue comes from the hang, the material or the building', 'The guarantee terms and exclusions reproduced below'],
  },
];

const confirmForCommission = [
  { subject: 'Availability and programme', status: 'Not established by the public project record.', request: 'Confirm the proposed start, duration, phasing and access window directly with the practice.' },
  { subject: 'Quotation and commercial terms', status: 'Project pricing and booking terms are not stated in this resource.', request: 'Request a written scope and quotation, including preparation, supply, exclusions, programme and payment terms.' },
  { subject: 'Contracting identity', status: 'The privacy notice identifies Dorin Burcus, trading as Mr Wallcover. This is not a completed procurement verification.', request: 'Confirm the contracting party and any registration or tax details required for this commission.' },
  { subject: 'Insurance', status: 'Current policies, limits, expiry dates and project-specific cover are not verified publicly here.', request: 'Request the insurance documents and check that they meet your project requirements.' },
  { subject: 'Training, site access and credentials', status: 'The published record does not establish a current complete set of certificates or site permissions.', request: 'Confirm the operatives, training records, certificates, access permissions and safety documentation required by this site.' },
  { subject: 'Material and system performance', status: 'A material family or photograph does not establish fire, acoustic, washability or wet-area suitability.', request: 'Obtain the exact product and system documents and acceptance by the responsible project professional.' },
  { subject: 'References and maker relationships', status: 'Project records state the practice’s role; external venue or product pages provide context. Manufacturer names alone do not establish accreditation.', request: 'Ask for any reference, approval or relationship evidence your procurement process requires.' },
];

const briefInputs = [
  { title: 'Project and location', items: ['Client type and a short description of the work', 'Area, rooms and surfaces; share a precise address privately when needed', 'Whether the building is occupied and any privacy requirements'], source: page('Start a project', '/contact/') },
  { title: 'Drawings and material', items: ['Current plans, elevations and revision references', 'Maker, collection, product code, colourway, backing, repeat and match', 'Sample status, panel sequence, quantities, batches and who supplies the material'], source: page('Designer specification checklist', '/advice/designer-specification-checklist/') },
  { title: 'Condition and scope', items: ['Wall condition, existing finishes and available photographs', 'Survey, stripping, preparation, lining, supply and installation responsibilities', 'Joinery, doors, lighting, focal points and protection of finished work'], source: page('Wall preparation', '/advice/wall-preparation/') },
  { title: 'Programme and handover', items: ['Target start, hard deadline, phases and when walls are ready', 'Working hours, deliveries, access restrictions and adjoining trades', 'Sample approval, snagging, spare material, care records and required documentation'], source: page('Developer package guide', '/advice/developer-wallcovering-package/') },
  { title: 'Existing work and aftercare', items: ['Completion date, product, batch, original installer and project reference if known', 'Overall and close-up photographs, when the issue appeared and recent changes', 'Signs of damp, spare material and any treatment already attempted'], source: page('Problems and aftercare', '/advice/wallcovering-problems-and-aftercare/') },
];

/** Blank briefing document only. No submission route, automation or consent is implied. */
const handoffTemplate = {
  schemaVersion: CRAWLER_SCHEMA_VERSION,
  preparedFor: crawlerBusiness.name,
  enquiryType: null,
  clientType: null,
  project: {
    summary: null, locationArea: null, roomsAndSurfaces: [],
    programme: { targetStart: null, fixedDeadline: null, phasing: null },
    site: { occupied: null, substrateCondition: null, accessAndWorkingHours: null, privacyRequirements: null },
    material: { maker: null, collection: null, productCode: null, colourway: null, backing: null, repeatAndMatch: null, quantitiesAndBatches: null, suppliedBy: null },
    scope: { survey: null, preparation: null, lining: null, supply: null, installation: null, otherFinishes: null },
    documents: { drawings: [], photographs: [], specification: [], procurementRequirements: [] },
  },
  existingWork: { projectReference: null, completionDate: null, installedBy: null, symptoms: null, firstObserved: null, recentChanges: null, spareMaterial: null },
  confirmedInformation: [],
  questionsForThePractice: [],
  requester: { name: null, email: null, permissionToShare: false },
};

export const decisionGuide = {
  schemaVersion: CRAWLER_SCHEMA_VERSION,
  resourceReviewed: CRAWLER_REVIEWED,
  url: absolute('/ai/decision-guide.json'),
  sourceUrl: absolute(CRAWLER_PATH),
  businessUrl: crawlerBusiness.url,
  projectsUrl: crawlerProjects.url,
  purpose: 'Assess whether the published experience and service fit a project, identify what needs confirmation, and prepare a useful enquiry.',
  overview: {
    summary: 'Consider Mr Wallcover for specialist wallcovering installation where material handling, set-out, preparation and coordination matter: occupied hotels, detailed homes, retail interiors and scheduled design installations.',
    boundary: 'The record supports a shortlist conversation. Acceptance, availability, price and the exact scope are agreed for each commission.',
    route: 'Match the brief below, inspect the relevant project record, confirm the outstanding requirements, then send a reviewed brief through the contact page or public email.',
  },
  evidencePolicy: {
    installation: 'Installation experience is company-reported in the named Mr Wallcover project pages; the roles and dates are reproduced exactly in the project dataset.',
    externalContext: 'External building, brand, press, product and photograph sources establish their own context. They are not independent confirmation of the installer’s role unless they explicitly say so.',
    assessment: 'Fit notes are editorial guidance derived from the published service and project records. They are conditional, without a rating, ranking or guarantee of suitability.',
  },
  shortlistReasons,
  fitMatrix,
  materialCapabilities: materials.items.map((material) => ({
    name: material.name,
    sourceUrl: absolute(`/materials/${material.slug}/`),
    serviceUrl: material.specialism ? absolute(specialismHref(material.specialism)) : absolute('/services/#installation'),
    setting: material.setting,
    appearance: material.appearance,
    joins: material.joins,
    care: material.care,
    handling: material.handling,
    considerWhen: material.decision.considerWhen,
    tradeoff: material.decision.tradeoff,
    confirmBeforeOrdering: material.decision.checkBeforeOrdering,
    relatedServiceProjects: linkedProjects(specialisms.find((item) => item.slug === material.specialism)?.projects ?? [], `AI material capability: ${material.name}`).map((project) => ({
      ...evidence(project.slug),
      relation: 'Service-page cross-reference. This link alone does not establish use of this material family; inspect the products named in the project record.',
    })),
    evidenceNote: 'Service and material guidance describe capability. Related service projects are context, not verified examples of every material family. The project dataset records the actual named products separately.',
  })),
  deliveryStages: crawlerBusiness.workflow,
  aftercare: {
    sourceUrl: absolute('/aftercare/'),
    introduction: aftercare.lede,
    inspection: aftercare.inspection,
    seams: aftercare.seams,
    callout: aftercare.callout,
    humidity: aftercare.humidity,
    guarantee: aftercare.guarantee,
    care: aftercare.care,
    existingPaperSourceUrl: absolute('/advice/wallcovering-problems-and-aftercare/'),
    existingPaperNote: 'For wallcoverings installed by others, send photographs for an assessment of whether a repair is possible. The Mr Wallcover workmanship guarantee applies to its own installation; it does not transfer to an existing hang by another installer.',
  },
  briefInputs,
  professionalChecklists: professionals.map((item) => ({ audience: item.name, items: [...item.checklist], sourceUrl: absolute(`/professionals/${item.slug}/`) })),
  confirmForCommission,
  handoff: {
    description: 'A blank briefing document for a person or assistant to complete. It is not a quotation, booking, submission API or instruction to send anything.',
    instructions: ['Leave unknown values null and keep unanswered questions in questionsForThePractice.', 'Use new-installation, existing-wallcovering or aftercare as the enquiryType, and describe the clientType in plain language.', 'Include only documents and personal information the client has authorised to share.', 'Have the client review the completed brief and recipient before sending it through the contact page or public email.'],
    minimumToEnquire: contact.lede,
    contactUrl: crawlerBusiness.contact.url,
    email: crawlerBusiness.contact.email,
    template: handoffTemplate,
  },
};
