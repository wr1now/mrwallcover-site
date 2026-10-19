/** Shared transport contract. Pricing configuration and private rates stay on the server. */
export type Pence = number;
export type PortalFlag = 'yes' | 'no' | 'unknown';
export type BuildingType = 'private-home' | 'apartment' | 'hotel' | 'retail' | 'office' | 'commercial-other' | 'mixed-use' | 'unknown';
export type SurfaceKind = 'wall' | 'ceiling' | 'unknown';
export type ScopeKind = 'feature_wall' | 'single_room' | 'multiple_rooms' | 'commercial';
export type MaterialGroupId = 'printed-paper' | 'printed-nonwoven' | 'vinyl-coated-paper' | 'domestic-vinyl' | 'wide-contract-vinyl' | 'standard-fabric' | 'velvet-flock-pile' | 'formed-acoustic' | 'specialists';
export interface OpeningDraft { id: string; widthMm: number; heightMm: number; count: number }
export interface RevealDraft { id: string; widthMm: number; heightMm: number; count: number }
export interface WallDraft { id: string; widthMm: number; heightMm: number; count: number; openings: OpeningDraft[]; reveals: RevealDraft[] }
export interface CeilingOpeningDraft { id: string; widthMm: number; lengthMm: number; count: number }
/** A horizontal covered face. Length is measured; wall or ceiling height is never inferred. */
export interface CeilingDraft { id: string; widthMm: number; lengthMm: number; count: number; openings: CeilingOpeningDraft[] }
export interface MaterialSelection {
  groupId: MaterialGroupId;
  /** A type ID must match a server-approved profile; group membership alone does not establish eligibility. */
  verifiedTypeId?: string;
  productId?: string;
  manufacturer?: string;
  productName?: string;
  productCode?: string;
  clientProvided: boolean;
  acoustic: PortalFlag;
  velvet: PortalFlag;
  specialist: PortalFlag;
}
export interface ScopeItem {
  id: string;
  roomId: string;
  label: string;
  scopeKind: ScopeKind;
  confirmedMeasurements: boolean;
  /** Omitted only for compatibility with legacy wall drafts. */
  surfaceKind?: SurfaceKind;
  walls: WallDraft[];
  ceilings?: CeilingDraft[];
  material: MaterialSelection;
  preparation: 'normal-prep-lining-hanging' | 'contract-ready' | 'removal-or-repair' | 'unknown';
  access: 'standard' | 'stairs' | 'high-level' | 'restricted' | 'unknown';
  packageId?: string;
}
export interface RoomDraft { id: string; label: string; floor: string }
export interface ContactDraft { name: string; email: string; phone?: string; company?: string }
export interface AddressDraft { line1: string; line2?: string; town: string; postcode: string; country: string }
export interface MaterialReadinessDraft {
  status: 'unknown' | 'awaiting-specification' | 'ordered' | 'part-delivered' | 'delivered' | 'checked-ready';
  readyDate?: string;
  /** Empty means the complete project; otherwise these exact scope items. */
  scopeItemIds: string[];
  constraints?: string;
}
export interface MaterialRequirement {
  id: string; label: string; scopeItemIds: string[];
  kind: 'wallcovering' | 'lining' | 'primer' | 'adhesive' | 'other';
  quantity?: number;
  unit: 'unknown' | 'roll' | 'panel' | 'linear-m' | 'm2' | 'litre' | 'kg' | 'item';
  status: 'to-confirm' | 'required' | 'client-confirmed';
  sourceNote?: string; notes?: string;
}
export interface PreparationCheck {
  id: string; label: string; scopeItemIds: string[];
  status: 'not-checked' | 'action-required' | 'ready' | 'not-applicable' | 'needs-review';
  checkedBy?: string; checkedOn?: string; notes?: string;
}
export interface SampleApproval {
  id: string; label: string; scopeItemIds: string[];
  status: 'not-requested' | 'requested' | 'received' | 'approved' | 'changes-required' | 'needs-review';
  approvedBy?: string; approvedOn?: string; sourceDocumentId?: string; notes?: string;
}
export interface AftercareReference {
  id: string; label: string; scopeItemIds: string[];
  status: 'to-confirm' | 'issued' | 'acknowledged';
  url?: string; sourceDocumentId?: string; instructions?: string;
}
export interface ProjectResources {
  materialRequirements: MaterialRequirement[];
  preparationChecklist: PreparationCheck[];
  sampleApprovals: SampleApproval[];
  aftercareReferences: AftercareReference[];
}
export interface ProgrammeDraft { startDate?: string; endDate?: string; occupied: PortalFlag; outOfHours: PortalFlag; phases: number; notes?: string; materialReadiness?: MaterialReadinessDraft }
export interface VehicleDayDraft {
  date: string;
  vehicleId: string;
  congestionZone: PortalFlag;
  congestionChargeApplies: PortalFlag;
  congestionTariff?: 'standard' | 'discounted' | 'unknown';
  ulezZone: PortalFlag;
  ulezChargeApplies: PortalFlag;
  ulezTariff?: 'standard' | 'discounted' | 'unknown';
  parkingRequired: PortalFlag;
}
export interface LogisticsDraft { arrangement?: 'daily-van' | 'delivery-storage-collection' | 'client-parking' | 'team-travel' | 'phased' | 'not-established'; vehicleDays: VehicleDayDraft[]; vehicleDaysConfirmed: boolean; deliveriesRequired: PortalFlag; storageRequired: PortalFlag; accessEquipmentRequired: PortalFlag; wasteRemovalRequired: PortalFlag; notes?: string }
export interface ProjectDraft {
  schemaVersion: 1;
  id?: string;
  name: string;
  buildingType?: BuildingType;
  resources?: ProjectResources;
  rooms: RoomDraft[];
  items: ScopeItem[];
  contact: ContactDraft;
  address: AddressDraft;
  /** Private context only: never used to derive price or included in a share projection. */
  propertyValuePence?: Pence;
  programme: ProgrammeDraft;
  logistics: LogisticsDraft;
}
export interface ValidationIssue { path: string; code: string; message: string }
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };
export interface EstimateLine {
  id: string;
  itemId?: string;
  /** Private pricing provenance; excluded from public sharing. */
  profileId?: string;
  packageTemplateId?: string;
  label: string;
  category: 'installation' | 'package' | 'logistics' | 'management' | 'survey' | 'preparation';
  quantity: number;
  unit: 'm2' | 'package' | 'vehicle-day' | 'hour' | 'day' | 'visit' | 'item';
  amountPence: Pence;
  inclusion: string;
}
export interface EstimateReviewReason { code: string; message: string; itemId?: string }
export interface EstimateSnapshot {
  schemaVersion: 1;
  id: string;
  projectId: string;
  projectRevision: number;
  configVersion: string;
  createdAt: string;
  validUntil: string;
  status: 'information_required' | 'review_required' | 'ready';
  currency: 'GBP';
  lines: EstimateLine[];
  subtotalPence: Pence;
  vatRateBps: number | null;
  vatPence: Pence | null;
  totalPence: Pence | null;
  vatStatus: 'exclusive' | 'not-applicable' | 'unconfirmed';
  reviewReasons: EstimateReviewReason[];
  assumptions: string[];
  /** Preserves exactly the revision reviewed. Never return this in public/shared responses. */
  project: ProjectDraft;
}
export interface SharedEstimate {
  schemaVersion: 1;
  estimateId: string;
  projectName: string;
  projectAddress: AddressDraft;
  createdAt: string;
  validUntil: string;
  status: EstimateSnapshot['status'];
  currency: 'GBP';
  lines: EstimateLine[];
  subtotalPence: Pence;
  vatRateBps: number | null;
  vatPence: Pence | null;
  totalPence: Pence | null;
  vatStatus: EstimateSnapshot['vatStatus'];
  reviewReasons: EstimateReviewReason[];
  assumptions: string[];
}
