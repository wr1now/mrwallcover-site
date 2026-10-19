/** Room Studio v2. Survey inputs are integer millimetres; artwork is precise to 0.1 mm. Compiled meshes use metres,
 * right-handed X/Y/Z, Y up. Plan points use X/Z, counter-clockwise from above.
 * Wall IDs belong to the outgoing edge of each point and survive coordinate edits.
 */
export type Point2 = { x: number; z: number };
export type Vec3 = [number, number, number];
export type RoomVertex = Point2 & { wallId: string };
export interface Opening {
  id: string; wallId: string; kind: 'door' | 'window';
  offsetMm: number; widthMm: number; heightMm: number; sillMm: number; revealMm: number;
  /** Optional simple window frame inside the measured opening; 0/absent is bare. */
  frameMm?: number;
}
export interface RoomDefinition {
  vertices: RoomVertex[]; heightMm: number; openings: Opening[];
  skirtingMm: number; corniceMm: number; confirmed: boolean;
}
export interface TextureAsset {
  id: string; sha256: string; mime: 'image/png' | 'image/jpeg' | 'image/webp';
  widthPx: number; heightPx: number;
  /** Local user artwork; stripped from database metadata after private upload. */
  dataUrl?: string; storagePath?: string;
}
export interface ArtworkCalibration {
  widthMm: number; heightMm: number;
  crop: { x: number; y: number; width: number; height: number };
  rotation: 0 | 90 | 180 | 270;
  repeatKind: 'tile' | 'strip'; match: 'straight' | 'half-drop'; offsetAlreadyIncluded: boolean;
  proofAccepted: boolean;
}
export interface CatalogueReference { productId: string; version: string; verification: 'approved' | 'custom'; }
export interface PaintFinish {
  catalogue?: CatalogueReference;
  id: string; type: 'paint'; name: string; colour: string; sheen: 'matte' | 'eggshell';
}
/** Illustrative response controls, never a claim of manufacturer measurements. */
export interface ArtworkAppearance {
  roughness: number; metalness: number;
  /** Optional parametric geometry; compiled mesh positions remain authoritative. */
  relief?: { kind: 'coffered' | 'faceted'; depthMm: number; columns: number; rows: number };
}
export interface ArtworkPanel {
  id: string; number: number; texture: TextureAsset; widthMm: number; heightMm: number;
}
export interface ArtworkFinish {
  catalogue?: CatalogueReference;
  /** Finite full-image panels in installation order. Never repeated or stretched. */
  panels?: ArtworkPanel[];
  id: string; type: 'wallpaper' | 'mural'; name: string;
  texture: TextureAsset; calibration: ArtworkCalibration;
  appearance?: ArtworkAppearance;
}
export interface BauwerkFinish {
  catalogue?: CatalogueReference;
  id: string; type: 'bauwerk'; name: string; colour: string;
  shadeId: string; catalogueVersion: string; productUrl: string;
  colourProvenance: 'manufacturer' | 'derived-preview'; seed: number;
}
export type FinishAsset = PaintFinish | ArtworkFinish | BauwerkFinish;
/** Surveyed phase reference. A changed wall finish retains the reference; finite panels require placement review after a gap. */
export interface FinishWallRun {
  id: string; finishId: string; wallIds: string[]; startOffsetMm: number;
}
export interface WallFinishAssignment {
  /** Distance along this connected run is derived from current surveyed wall lengths. */
  runId?: string;
  id: string; wallId: string; finishId: string;
  /** Horizontal band measured from finished floor; null top means room ceiling. */
  fromMm: number; toMm: number | null;
  offsetXmm: number; offsetYmm: number;
}
export interface StudioCamera {
  /** FOV is vertical degrees, shared by Three.js and Blender's vertical sensor fit. */
  id: string; kind: 'perspective' | 'panorama'; position: Vec3; target: Vec3; fov: number;
}
export type LightingPreset = 'daylight' | 'warm';
export interface FinishScheme { id: string; name: string; finishes: FinishAsset[]; assignments: WallFinishAssignment[]; wallRuns?: FinishWallRun[]; }
export interface RoomProject {
  schemaVersion: 1 | 2; id: string; ownerId: string | null; name: string;
  room: RoomDefinition; finishes: FinishAsset[]; assignments: WallFinishAssignment[];
  wallRuns?: FinishWallRun[];
  cameras: StudioCamera[]; lighting: LightingPreset; schemes: FinishScheme[];
  revision: number; updatedAt: string;
}
export interface RoomRevision {
  id: string; projectId: string; number: number; createdAt: string;
  /** Full immutable snapshot. Render only this snapshot, never a mutable project. */
  project: RoomProject;
}
export interface CompiledMesh {
  id: string; surface: 'wall' | 'reveal' | 'floor' | 'ceiling' | 'skirting' | 'cornice';
  wallId?: string; materialId: string;
  positions: number[]; normals: number[]; uvs: number[]; indices: number[];
}
export interface CompiledMaterial {
  id: string; type: FinishAsset['type'] | 'neutral'; colour: string; roughness: number;
  appearance?: ArtworkAppearance;
  textureId?: string; repeat?: boolean; seed?: number;
  texturePreparation?: { crop: ArtworkCalibration['crop']; rotation: ArtworkCalibration['rotation'] };
}
export interface RenderPackage {
  schemaVersion: 1; compilerVersion: string; revisionId: string; projectId: string;
  units: 'metres'; meshes: CompiledMesh[]; materials: CompiledMaterial[];
  textures: TextureAsset[]; cameras: StudioCamera[]; lighting: LightingPreset;
  outputs: { stills: [1920, 1080]; panorama: [4096, 2048] };
}
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface ProcessingJob {
  id: string; ownerId: string; type: 'analysis' | 'render'; inputIdentity: string;
  revisionId: string | null; orderId?: string; state: JobState; reservedPence: number;
  attempts: number; error: string | null; outputs: { kind: string; storagePath: string; sha256: string }[];
  createdAt: string; updatedAt: string;
}
export interface ValidationIssue { path: string; message: string; }
export interface PlanCandidate {
  room: RoomDefinition | null;
  scaleKnown: boolean; heightKnown: boolean;
  issues: ValidationIssue[]; evidence: string[];
}
