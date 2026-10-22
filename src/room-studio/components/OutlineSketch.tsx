import { useId, useMemo, useRef, useState } from 'react';
import Action from '../../components/react/Action.tsx';
import NumberField from './NumberField.tsx';
import { ROOM_LIMITS, signedPlanArea, validateRoom } from '../validation.ts';
import type { Point2, RoomDefinition } from '../types.ts';

/** A replacement room is only emitted after the customer explicitly accepts it. */
export default function OutlineSketch({ room, onUse, onCancel }: { room: RoomDefinition; onUse: (room: RoomDefinition) => void; onCancel: () => void }) {
  const [width, setWidth] = useState(Math.max(500, Math.max(...room.vertices.map(v => v.x)) - Math.min(...room.vertices.map(v => v.x))));
  const [depth, setDepth] = useState(Math.max(500, Math.max(...room.vertices.map(v => v.z)) - Math.min(...room.vertices.map(v => v.z))));
  // Normalised points retain the sketch proportions when its measured extent changes.
  const [points, setPoints] = useState<Point2[]>([]);
  const svg = useRef<SVGSVGElement>(null), patternId = `outline-grid-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const grid = 50, margin = Math.max(width, depth) / 20, radius = Math.max(width, depth) / 65;
  const corners = useMemo(() => points.map(point => ({ x: Math.round(point.x * width / grid) * grid, z: Math.round(point.z * depth / grid) * grid })), [points, width, depth]);
  const candidate = useMemo(() => {
    const ordered = signedPlanArea(corners) < 0 ? [...corners].reverse() : corners;
    return { ...room, vertices: ordered.map((point, index) => ({ ...point, wallId: `sketch-${index}` })), openings: [], confirmed: false };
  }, [room, corners]);
  const issues = corners.length >= 3 ? validateRoom(candidate) : [];
  function addCorner(event: React.MouseEvent<SVGSVGElement>) {
    if (!svg.current || points.length >= ROOM_LIMITS.vertices) return;
    const matrix = svg.current.getScreenCTM(); if (!matrix) return;
    const cursor = svg.current.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY;
    const point = cursor.matrixTransform(matrix.inverse());
    if (point.x < -grid / 2 || point.x > width + grid / 2 || point.y < -grid / 2 || point.y > depth + grid / 2) return;
    const x = Math.max(0, Math.min(width, Math.round(point.x / grid) * grid)), z = Math.max(0, Math.min(depth, Math.round(point.y / grid) * grid));
    if (corners.some(corner => corner.x === x && corner.z === z)) return;
    setPoints(previous => [...previous, { x: x / width, z: z / depth }]);
  }
  function accept() {
    if (corners.length < 3 || issues.length) return;
    onUse({ ...candidate, vertices: candidate.vertices.map(vertex => ({ ...vertex, wallId: crypto.randomUUID() })) });
  }
  return <div className="studio-inset studio-outline-sketch">
    <h3>Draw a new room outline</h3>
    <p className="studio-hint">Set the measured width and depth of the drawing area. Click or tap each inside corner in order; the last corner joins the first. Points snap to 50 mm. Use 3–12 corners.</p>
    <div className="studio-row"><NumberField label="Drawing width" value={width} min={500} max={ROOM_LIMITS.maxDimensionMm} step={50} onChange={setWidth}/><NumberField label="Drawing depth" value={depth} min={500} max={ROOM_LIMITS.maxDimensionMm} step={50} onChange={setDepth}/></div>
    <div className="studio-trace-viewport"><svg ref={svg} viewBox={`${-margin} ${-margin} ${width + margin * 2} ${depth + margin * 2}`} onClick={addCorner} role="img" aria-label="Measured drawing grid. Click inside corners in order." style={{ display: 'block', width: '100%', minWidth: 0, maxHeight: 360 }}>
      <defs><pattern id={patternId} width={500} height={500} patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#ccd2c4" strokeWidth={Math.max(width, depth) / 700}/></pattern></defs>
      <rect x={0} y={0} width={width} height={depth} fill={`url(#${patternId})`} stroke="#7a8976" strokeWidth={Math.max(width, depth) / 450}/>
      {corners.length > 0 && <polygon points={corners.map(point => `${point.x},${point.z}`).join(' ')} fill="#66805b25" stroke="#3c603e" strokeWidth={Math.max(width, depth) / 220}/>}
      {corners.map((point, index) => <g key={index}><circle cx={point.x} cy={point.z} r={radius} fill="#405e41"/><text x={point.x} y={point.z} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={radius * 1.2}>{index + 1}</text></g>)}
    </svg></div>
    <p className="studio-hint" role="status">{corners.length} of {ROOM_LIMITS.vertices} corners · grid lines every 500 mm.{corners.length === ROOM_LIMITS.vertices ? ' Undo a corner to change the outline.' : ''}</p>
    {issues.length > 0 && <p className="studio-error" role="alert">{[...new Set(issues.map(issue => issue.message))].slice(0, 2).join(' ')}</p>}
    <p className="studio-hint">Using this outline replaces the current walls, doors and windows. You can undo it after applying. Cancel to keep your room and edit corner coordinates with the keyboard.</p>
    <div className="studio-button-row"><Action disabled={!points.length} onClick={() => setPoints(previous => previous.slice(0, -1))}>Undo corner</Action><Action disabled={!points.length} onClick={() => setPoints([])}>Clear drawing</Action><Action variant="primary" disabled={corners.length < 3 || issues.length > 0} onClick={accept}>Use drawn outline</Action><Action variant="quiet" onClick={onCancel}>Cancel drawing</Action></div>
  </div>;
}
