import type { FinishAsset, TextureAsset } from './types.ts';

/** Photograph coordinates are normalized to the orientation-corrected source. */
export interface PhotoPoint { x: number; y: number; }
export type PhotoQuad = [PhotoPoint, PhotoPoint, PhotoPoint, PhotoPoint];
export interface PhotoMaskStroke {
  id: string; mode: 'erase' | 'restore';
  /** Radius is a fraction of the photograph's shorter side. */
  radius: number; points: PhotoPoint[];
}
export interface PhotoSurface {
  id: string; name: string;
  /** Clockwise, starting at the wall's top left. */
  corners: PhotoQuad; strokes: PhotoMaskStroke[]; finishId: string | null;
  widthMm: number | null; heightMm: number | null;
  scale: number; offsetXmm: number; offsetYmm: number; shading: number;
}
export interface PhotoRevision {
  id: string; name: string; createdAt: string;
  surfaces: PhotoSurface[]; finishes: FinishAsset[];
}
export interface PhotoProject {
  kind: 'photo'; schemaVersion: 1; id: string; ownerId: string | null;
  name: string; source: TextureAsset; surfaces: PhotoSurface[];
  finishes: FinishAsset[]; comparisons: PhotoRevision[];
  revision: number; updatedAt: string;
}

export const PHOTO_LIMITS = { surfaces: 6, comparisons: 8, finishes: 48, strokes: 500, strokePoints: 20000, projectBytes: 100 * 1024 * 1024, exportEdge: 4096 } as const;
