/** Lightweight card data. Original example artwork is loaded only on request. */
export type RoomStudioExampleId = 'willow-chimney' | 'ochre-lshape' | 'indigo-bay';
export interface RoomStudioExampleMetadata {
  id: RoomStudioExampleId;
  name: string;
  description: string;
  artworkLabel: string;
  layoutLabel: string;
  dimensionsLabel: string;
  repeatMm: { width: number; height: number };
  pixelSize: { width: number; height: number };
  renders: { stills: readonly [string, string]; panorama: string };
}
export const roomStudioExamples: readonly RoomStudioExampleMetadata[] = [
  {
    id: 'willow-chimney', name: 'Willow lattice',
    description: 'A sage botanical repeat wraps an eight-wall room, including the projecting chimney breast. Three windows and a door show the set-out around real openings.',
    artworkLabel: 'Original illustrative Willow lattice wallpaper',
    layoutLabel: 'Chimney breast · 8 wall segments', dimensionsLabel: '6.2 × 4.6 m · 2.8 m ceiling',
    repeatMm: { width: 640, height: 640 }, pixelSize: { width: 1536, height: 1536 },
    renders: { stills: ['/media/room-studio/examples/willow-chimney-1.webp', '/media/room-studio/examples/willow-chimney-2.webp'], panorama: '/media/room-studio/examples/willow-chimney-panorama.webp' },
  },
  {
    id: 'ochre-lshape', name: 'Ochre cadence',
    description: 'An original block-print study uses a physical half-drop repeat across an L-shaped room, with three windows and two doors. Alternate strips receive one half-height drop.',
    artworkLabel: 'Original illustrative Ochre cadence wallpaper',
    layoutLabel: 'L-shaped room · 6 wall segments', dimensionsLabel: '6.0 × 5.0 m · 2.7 m ceiling',
    repeatMm: { width: 530, height: 640 }, pixelSize: { width: 1536, height: 1536 },
    renders: { stills: ['/media/room-studio/examples/ochre-lshape-1.webp', '/media/room-studio/examples/ochre-lshape-2.webp'], panorama: '/media/room-studio/examples/ochre-lshape-panorama.webp' },
  },
  {
    id: 'indigo-bay', name: 'Indigo arcade',
    description: 'An indigo fan repeat follows a chamfered bay with three window faces, a fourth side window and a door. The angled walls retain the same measured repeat.',
    artworkLabel: 'Original illustrative Indigo arcade wallpaper',
    layoutLabel: 'Angled bay room · 6 wall segments', dimensionsLabel: '5.6 × 4.6 m · 2.75 m ceiling',
    repeatMm: { width: 600, height: 600 }, pixelSize: { width: 1536, height: 1536 },
    renders: { stills: ['/media/room-studio/examples/indigo-bay-1.webp', '/media/room-studio/examples/indigo-bay-2.webp'], panorama: '/media/room-studio/examples/indigo-bay-panorama.webp' },
  },
];
