import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FinishAsset } from '../types.ts';
import type { PhotoMaskStroke, PhotoPoint, PhotoProject, PhotoSurface } from '../photo-types.ts';
import { PHOTO_LIMITS } from '../photo-types.ts';
import { clamp, isPhysicalPhotoScale, photoExportSize, photoSourceDetailWarning, quadError } from '../photo-math.ts';
import { photoPngBlob, readRoomPhoto, renderPhotoComposite } from '../photo-compositor.ts';
import { deletePhotoDraft, loadPhotoDraft, savePhotoDraft } from '../photo-storage.ts';
import { PhotoDraftAutosave } from '../photo-autosave.ts';
import { assertPortableJson, portableJsonBytes, serializePortableJson, PORTABLE_DOCUMENT_BUDGET_BYTES, PORTABLE_PROJECT_MAX_BYTES } from '../portable.ts';
import { assertPhotoEditBudget, collectPhotoTextures, validatePhotoProject } from '../photo-validation.ts';
import { checkEmbeddedArtwork } from '../finishes.ts';
import PhotoFinishPicker from './PhotoFinishPicker.tsx';
import PhotoCloudPanel from './PhotoCloudPanel.tsx';
import '../room-photo.css';

const action = (primary = false) => `mw-action mw-action--${primary ? 'primary' : 'secondary'}`;
const now = () => new Date().toISOString();
const names = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];
const makeSurface = (index: number): PhotoSurface => ({ id: crypto.randomUUID(), name: `Wall ${index + 1}`, corners: [{ x: .15, y: .15 }, { x: .85, y: .15 }, { x: .85, y: .8 }, { x: .15, y: .8 }], strokes: [], finishId: null, widthMm: null, heightMm: null, scale: 1, offsetXmm: 0, offsetYmm: 0, shading: .65 });
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function assertLocalProject(project: PhotoProject, enforcePortable = true) {
  const issues = validatePhotoProject(project); if (issues.length) throw new Error(issues[0].message);
  if (enforcePortable) assertPortableJson(project, PORTABLE_DOCUMENT_BUDGET_BYTES);
  let bytes = 0; const seen = new Set<string>();
  for (const texture of collectPhotoTextures(project)) { checkEmbeddedArtwork(texture); if (!seen.has(texture.sha256)) { bytes += Math.ceil((texture.dataUrl?.split(',')[1].length || 0) * 3 / 4); seen.add(texture.sha256); } }
  if (bytes > PHOTO_LIMITS.projectBytes) throw new Error('This project exceeds 100 MB of source images. Remove unused artwork or use smaller originals.');
}

export default function PhotoStudio({ onReturnTo3D }: { onReturnTo3D?: () => void }) {
  const [project, setProject] = useState<PhotoProject | null>(null), [loaded, setLoaded] = useState(false), [selectedId, setSelectedId] = useState('');
  const [step, setStep] = useState<'walls' | 'finishes' | 'save'>('walls'), [tool, setTool] = useState<'corners' | 'erase' | 'restore'>('corners'), [zoom, setZoom] = useState(1), [brush, setBrush] = useState(.025), [showOriginal, setShowOriginal] = useState(false), [showGuides, setShowGuides] = useState(true);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [saveStatus, setSaveStatus] = useState(''), [busy, setBusy] = useState(false), [rendering, setRendering] = useState(false), [comparisonName, setComparisonName] = useState('');
  const [past, setPast] = useState<PhotoProject[]>([]), [future, setFuture] = useState<PhotoProject[]>([]), [liveStroke, setLiveStroke] = useState<PhotoMaskStroke | null>(null);
  const [handleRadius, setHandleRadius] = useState(20);
  const [deletingLocal, setDeletingLocal] = useState(false);
  const [autosaveAllowed, setAutosaveAllowed] = useState(false);
  const localDeletion = useRef(false), autosave = useRef<PhotoDraftAutosave<PhotoProject> | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), overlay = useRef<SVGSVGElement>(null), current = useRef(project), gesture = useRef<{ before: PhotoProject; wallId: string; corner?: number; stroke?: PhotoMaskStroke } | null>(null), uploadToken = useRef(0);
  current.current = project;
  const selected = project?.surfaces.find(s => s.id === selectedId) || project?.surfaces[0];
  const finish = project?.finishes.find(f => f.id === selected?.finishId);
  const size = project ? photoExportSize(project.source.widthPx, project.source.heightPx) : null;
  const qualityWarning = selected && size ? photoSourceDetailWarning(selected, finish, size.width, size.height) : null;
  const removableFinishIds = project?.finishes.filter(f => !project.surfaces.some(s => s.finishId === f.id) && !project.comparisons.some(c => c.finishes.some(value => value.id === f.id))).map(f => f.id) || [];
  const portableBytes = useMemo(() => project ? portableJsonBytes(project) : 0, [project]);

  useEffect(() => { autosave.current = new PhotoDraftAutosave(savePhotoDraft, deletePhotoDraft); return () => { autosave.current?.dispose(); autosave.current = null; }; }, []);
  useEffect(() => { let active = true; void loadPhotoDraft().then(saved => { if (!active || uploadToken.current) return; if (saved) { assertLocalProject(saved, false); const portable = portableJsonBytes(saved) <= PORTABLE_DOCUMENT_BUDGET_BYTES; setAutosaveAllowed(portable); if (!portable) setSaveStatus('Original saved draft preserved'); setProject(saved); setSelectedId(saved.surfaces[0]?.id || ''); setMessage('Your locally saved photo project is ready.'); } }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoaded(true); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const writer = autosave.current; if (!project || !loaded || !autosaveAllowed || localDeletion.current || !writer) return; setSaveStatus('Saving on this device…');
    writer.schedule(project, () => setSaveStatus('Saved on this device'), reason => { setSaveStatus('Local save unavailable'); setError(reason instanceof Error ? reason.message : 'Your browser could not save this photograph. Download an editable copy.'); });
    return () => writer.cancelPending();
  }, [project, loaded, autosaveAllowed]);
  useEffect(() => {
    if (!project) return; const controller = new AbortController(); setRendering(true);
    const timer = setTimeout(() => { void renderPhotoComposite(project, { maxEdge: 1440, original: showOriginal, signal: controller.signal }).then(result => {
      if (controller.signal.aborted || !canvas.current) return; canvas.current.width = result.width; canvas.current.height = result.height; canvas.current.getContext('2d')?.drawImage(result, 0, 0); canvas.current.dataset.photoMode = showOriginal ? 'original' : 'composite'; canvas.current.dataset.photoRevision = String(project.revision); setRendering(false);
    }).catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setRendering(false); } }); }, 130);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [project, showOriginal]);
  useEffect(() => { const element = overlay.current; if (!element || !project) return; const update = () => setHandleRadius(22 * project.source.widthPx / Math.max(1, element.clientWidth)); update(); const observer = new ResizeObserver(update); observer.observe(element); return () => observer.disconnect(); }, [project?.id, showGuides, showOriginal, zoom]);

  function commit(next: PhotoProject, before = current.current) {
    if (!before || localDeletion.current) return false;
    try { const accepted = { ...next, revision: Math.min(100000, before.revision + 1), updatedAt: now() }; assertLocalProject(accepted, false); assertPhotoEditBudget(before, accepted); setPast(previous => [...previous.slice(-19), before]); setFuture([]); setProject(accepted); setAutosaveAllowed(true); setError(''); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This change could not be saved.'); setMessage(''); setProject(before); return false; }
  }
  function patchSurface(patch: Partial<PhotoSurface>) { if (!project || !selected) return; commit({ ...project, surfaces: project.surfaces.map(s => s.id === selected.id ? { ...s, ...patch } : s) }); }
  function undo() { if (!project || !past.length) return; const previous = past[past.length - 1]; setFuture(values => [project, ...values].slice(0, 20)); setPast(values => values.slice(0, -1)); setProject(previous); setError(''); }
  function redo() { if (!project || !future.length) return; setPast(values => [...values.slice(-19), project]); setProject(future[0]); setFuture(values => values.slice(1)); setError(''); }
  async function upload(file?: File) {
    if (!file || localDeletion.current) return; const token = ++uploadToken.current; setBusy(true); setError('');
    try { const source = await readRoomPhoto(file); if (token !== uploadToken.current) return; const surface = makeSurface(0); const p: PhotoProject = { kind: 'photo', schemaVersion: 1, id: crypto.randomUUID(), ownerId: null, name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'My room photograph', source, surfaces: [surface], finishes: [], comparisons: [], revision: 1, updatedAt: now() }; assertLocalProject(p); setPast([]); setFuture([]); setProject(p); setAutosaveAllowed(true); setSelectedId(surface.id); setStep('walls'); setZoom(1); setShowOriginal(false); setMessage('Photo prepared. Drag the four corners onto the first wall.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The photograph could not be read.'); } finally { if (token === uploadToken.current) setBusy(false); }
  }
  async function importProject(file?: File) {
    if (!file || localDeletion.current) return; const token = ++uploadToken.current; setBusy(true); setError('');
    try { if (file.size > PORTABLE_PROJECT_MAX_BYTES) throw new Error('Choose an editable photo project up to 160 MB. Image files remain limited to 20 MB each.'); const next = JSON.parse(await file.text()) as PhotoProject; if (token !== uploadToken.current || localDeletion.current) return; assertLocalProject(next); setProject(next); setAutosaveAllowed(true); setSelectedId(next.surfaces[0]?.id || ''); setPast([]); setFuture([]); setStep('walls'); setMessage('Editable photo project opened.'); }
    catch (reason) { if (token === uploadToken.current) setError(reason instanceof Error ? reason.message : 'This photo project could not be opened.'); } finally { if (token === uploadToken.current) setBusy(false); }
  }
  function pointerPosition(event: ReactPointerEvent<SVGElement>): PhotoPoint { const bounds = overlay.current!.getBoundingClientRect(); return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) }; }
  function beginCorner(event: ReactPointerEvent<SVGCircleElement>, wall: PhotoSurface, corner: number) {
    if (!project || tool !== 'corners') return; event.preventDefault(); event.stopPropagation(); setSelectedId(wall.id); gesture.current = { before: project, wallId: wall.id, corner }; overlay.current?.setPointerCapture(event.pointerId);
  }
  function beginBrush(event: ReactPointerEvent<SVGSVGElement>) {
    if (!project || !selected || tool === 'corners') return; event.preventDefault();
    if (selected.strokes.length >= PHOTO_LIMITS.strokes) { setError('This wall has 500 brush strokes. Clear its protection mask before adding more.'); return; }
    const stroke: PhotoMaskStroke = { id: crypto.randomUUID(), mode: tool, radius: brush, points: [pointerPosition(event)] }; gesture.current = { before: project, wallId: selected.id, stroke }; setLiveStroke(stroke); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current; if (!g) return; const point = pointerPosition(event);
    if (g.corner !== undefined) { const next = { ...g.before, surfaces: g.before.surfaces.map(s => s.id === g.wallId ? { ...s, corners: s.corners.map((c, i) => i === g.corner ? point : c) as PhotoSurface['corners'] } : s) }; current.current = next; setProject(next); }
    else if (g.stroke && g.stroke.points.length < 2000) { const previous = g.stroke.points[g.stroke.points.length - 1]; if (Math.hypot(previous.x - point.x, previous.y - point.y) >= .001) { g.stroke = { ...g.stroke, points: [...g.stroke.points, point] }; setLiveStroke(g.stroke); } }
  }
  function endPointer(event: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    const g = gesture.current; if (!g) return; gesture.current = null; setLiveStroke(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) { setProject(g.before); return; }
    const next = g.stroke ? { ...g.before, surfaces: g.before.surfaces.map(s => s.id === g.wallId ? { ...s, strokes: [...s.strokes, g.stroke!] } : s) } : current.current!;
    commit(next, g.before);
  }
  function saveFinish(value: FinishAsset) {
    const active = current.current; if (!project || !selected || !active || active.id !== project.id || localDeletion.current) return false;
    if (!active.surfaces.some(s => s.id === selected.id)) return false;
    if (!active.finishes.some(f => f.id === value.id) && active.finishes.length >= PHOTO_LIMITS.finishes) { setError('This project has 48 finishes. Remove an unused finish before adding another.'); return false; }
    const accepted = commit({ ...active, finishes: [...active.finishes.filter(f => f.id !== value.id), value], surfaces: active.surfaces.map(s => s.id === selected.id ? { ...s, finishId: value.id, offsetYmm: value.type === 'mural' ? (s.heightMm || 2400) - value.calibration.heightMm : s.offsetYmm } : s) }); if (accepted) setMessage(`${value.name} applied to ${selected.name}.`); return accepted;
  }
  function removeFinish(finishId: string) { const active = current.current; if (!active || localDeletion.current) return; if (active.surfaces.some(s => s.finishId === finishId) || active.comparisons.some(c => c.finishes.some(f => f.id === finishId))) { setError('This finish is still used by a wall or saved comparison. Remove those uses first.'); return; } if (commit({ ...active, finishes: active.finishes.filter(f => f.id !== finishId) })) setMessage('Unused finish removed from this photo project.'); }
  async function eraseLocalPhoto() {
    if (localDeletion.current || !autosave.current) return;
    localDeletion.current = true; ++uploadToken.current; setDeletingLocal(true); setBusy(true); setError(''); setSaveStatus('Removing local photo…');
    // The writer gates new work and cancels the pending debounce synchronously,
    // then drains any already running IndexedDB write before deleting.
    const deletion = autosave.current.delete();
    try { await deletion; current.current = null; gesture.current = null; setProject(null); setAutosaveAllowed(false); setPast([]); setFuture([]); setSelectedId(''); setLiveStroke(null); setMessage('Local photo project removed.'); setSaveStatus(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The local photo could not be removed. Try again.'); setSaveStatus('Local deletion failed'); }
    finally { localDeletion.current = false; setDeletingLocal(false); setBusy(false); }
  }
  async function exportPng() {
    if (!project) return; setBusy(true); setError(''); try { const result = await renderPhotoComposite(project); download(await photoPngBlob(result), `${project.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 80)}-preview.png`); setMessage(`PNG exported at ${result.width} × ${result.height} pixels.`); } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be exported.'); } finally { setBusy(false); }
  }
  const fullWidth = project?.source.widthPx || 1, fullHeight = project?.source.heightPx || 1;
  const pointString = (points: PhotoPoint[]) => points.map(p => `${p.x * fullWidth},${p.y * fullHeight}`).join(' ');
  const cornerRadius = handleRadius;
  return <section className="photo-studio" aria-label="View wallpaper in your room photograph" aria-busy={deletingLocal} data-dock-clearance data-photo-revision={project?.revision || 0} data-photo-mode={showOriginal ? 'original' : 'composite'} data-photo-rendering={rendering}>
    <header className="photo-heading"><div><span className="photo-eyebrow">Your room. Your finish.</span><h2>View in your room</h2><p>Keep your furniture, light and architecture. Try a different finish on the walls.</p></div>{onReturnTo3D && <button type="button" className={action()} onClick={onReturnTo3D}>Build a measured 3D room</button>}</header>
    <div className="photo-toolbar"><div className="photo-button-row"><label className="mw-action mw-action--secondary photo-file-action">{project ? 'New room photo' : 'Upload room photograph'}<input data-photo-source type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label><label className="mw-action mw-action--secondary photo-file-action">Open photo project<input data-photo-import type="file" accept=".json,application/json" disabled={busy} onChange={e => { void importProject(e.target.files?.[0]); e.target.value = ''; }} /></label></div><span className="photo-local-status" role="status">{busy ? 'Preparing…' : saveStatus || 'Private on this device'}</span></div>
    {project && portableBytes > PORTABLE_DOCUMENT_BUDGET_BYTES && <div className="photo-recovery-notice" role="status"><strong>This saved photo needs a smaller editable file.</strong><p>Its editable data is approximately {Math.ceil(portableBytes / 1024 / 1024)} MB. Remove saved comparisons or unused artwork to bring it below 160 MB. While it is above that limit, edits must reduce its file size.</p><p>{autosaveAllowed ? 'Your cleanup changes are saved on this device. Editable downloads become available once the project fits the limit.' : 'Your original saved draft stays untouched until you make a reduction.'}</p></div>}
    {!project ? <div className="photo-empty"><svg viewBox="0 0 480 280" role="img" aria-label="Select a photograph, mark the wall corners, then apply your chosen finish"><path d="M35 230V55L240 90V230Z" fill="#ded6c5" stroke="#8a8f7c" strokeWidth="2"/><path d="M240 90L440 55V230H240Z" fill="#e9e3d7" stroke="#8a8f7c" strokeWidth="2"/><path d="M35 230L240 200L440 230L300 265H170Z" fill="#bda78c"/><rect x="330" y="106" width="55" height="72" fill="#f8f5ed" stroke="#8a8f7c" strokeWidth="3"/><path d="M358 106V178M330 142H385" stroke="#8a8f7c" strokeWidth="2"/><path d="M65 79L210 104V202L65 220Z" fill="#879478" fillOpacity=".22" stroke="#4d674e" strokeWidth="2" strokeDasharray="7 5"/>{[[65,79],[210,104],[210,202],[65,220]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill="#4d674e" stroke="#fff" strokeWidth="3"/>)}</svg><h3>Start with a photograph of your room</h3><p>Choose a clear, well-lit photograph. Mark the walls and protect windows, doors and furniture with the brush.</p><p className="photo-help">PNG, JPEG or WebP · 20 MB maximum · 25 megapixels. Your photo stays on this device. Photo selection is guided; automatic wall detection is not enabled.</p>{!loaded && <p role="status">Checking for your saved photo…</p>}</div> : <>
      <nav className="photo-steps" aria-label="Photo visualiser stages">{(['walls', 'finishes', 'save'] as const).map((value, index) => <button type="button" key={value} aria-current={step === value ? 'step' : undefined} onClick={() => { setStep(value); if (value === 'save') setShowGuides(false); if (value === 'walls') { setShowGuides(true); setShowOriginal(false); } }}><span>0{index + 1}</span>{value === 'walls' ? 'Mark your walls' : value === 'finishes' ? 'Try finishes' : 'Compare & download'}</button>)}</nav>
      <div className="photo-workspace" inert={deletingLocal || undefined}><div className="photo-visual-column">
        <div className="photo-view-tools"><div className="photo-button-row"><button type="button" className={action()} disabled={!past.length} onClick={undo}>Undo</button><button type="button" className={action()} disabled={!future.length} onClick={redo}>Redo</button><button type="button" className={action(showOriginal)} aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? 'Show finishes' : 'Show original'}</button></div><label className="photo-zoom">Zoom<select value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[1, 1.5, 2, 3].map(n => <option value={n} key={n}>{Math.round(n * 100)}%</option>)}</select></label></div>
        <div className="photo-canvas-viewport"><div className="photo-image-stage" style={{ width: `${zoom * 100}%`, aspectRatio: `${fullWidth}/${fullHeight}` }}><canvas ref={canvas} role="img" aria-label={showOriginal ? 'Original room photograph' : 'Room photograph with selected wall finishes'} />
          {!showOriginal && showGuides && <svg ref={overlay} className={`photo-overlay photo-tool-${tool}`} viewBox={`0 0 ${fullWidth} ${fullHeight}`} onPointerDown={beginBrush} onPointerMove={movePointer} onPointerUp={e => endPointer(e)} onPointerCancel={e => endPointer(e, true)} aria-label="Wall corner and protection editor">
            {project.surfaces.map((s, index) => <g key={s.id}><polygon points={pointString(s.corners)} fill={s.id === selected?.id ? '#4d674e0a' : 'transparent'} stroke={s.id === selected?.id ? '#2d6549' : '#fff'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray={s.id === selected?.id ? undefined : '6 5'} onClick={() => setSelectedId(s.id)} /><text x={s.corners[0].x * fullWidth + cornerRadius * 1.5} y={s.corners[0].y * fullHeight + cornerRadius * 2.5} fill="#fff" stroke="#26332b" paintOrder="stroke" strokeWidth={cornerRadius / 4} fontSize={cornerRadius * .75}>{index + 1}</text>
              {tool === 'corners' && s.id === selected?.id && s.corners.map((point, i) => <g key={i}><circle className="photo-corner-hit" cx={point.x * fullWidth} cy={point.y * fullHeight} r={cornerRadius} fill="transparent" stroke="transparent" strokeWidth="2" vectorEffect="non-scaling-stroke" tabIndex={0} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(point.x * 1000) / 10} aria-label={`${s.name} ${names[i]} corner; arrow keys move, Shift for larger steps`} aria-valuetext={`${Math.round(point.x * 1000) / 10}% across, ${Math.round(point.y * 1000) / 10}% down`} onPointerDown={e => beginCorner(e, s, i)} onKeyDown={e => { const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const direction = directions[e.key]; if (!direction) return; e.preventDefault(); const delta = e.shiftKey ? .01 : .001; const corners = s.corners.map((p, k) => k === i ? { x: clamp(p.x + direction[0] * delta), y: clamp(p.y + direction[1] * delta) } : p) as PhotoSurface['corners']; if (!quadError(corners)) patchSurface({ corners }); }} /><circle className="photo-corner-dot" cx={point.x * fullWidth} cy={point.y * fullHeight} r={cornerRadius * .28} fill="#fffdf7" stroke="#2d6549" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" aria-hidden="true" /></g>)}
            </g>)}
            {liveStroke && <polyline points={pointString(liveStroke.points)} fill="none" stroke={liveStroke.mode === 'erase' ? '#a44c41aa' : '#4e8056aa'} strokeWidth={liveStroke.radius * Math.min(fullWidth, fullHeight) * 2} strokeLinecap="round" strokeLinejoin="round" />}
          </svg>}
        </div></div>
        <div className="photo-preview-caption"><span>{rendering ? 'Updating finish preview…' : showOriginal ? 'Original photograph' : 'Illustrative room-photo preview'}</span><button type="button" className={action()} aria-pressed={showGuides} onClick={() => setShowGuides(!showGuides)}>{showGuides ? 'Hide wall guides' : 'Show wall guides'}</button></div>
        <p className="photo-help">Original photograph: {fullWidth} × {fullHeight} pixels. PNG export: {size!.width} × {size!.height} pixels. Wall masking and shading are approximate; samples remain essential.</p>
      </div><aside className="photo-controls" aria-label="Photo wall controls">
        <label className="photo-field">Project name<input value={project.name} maxLength={120} onChange={e => { const name = e.target.value; if (name.trim()) commit({ ...project, name }); }} /></label>
        <label className="photo-field">Selected wall<select value={selected?.id || ''} onChange={e => setSelectedId(e.target.value)}>{project.surfaces.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        {step === 'walls' && <>
          <h3>Mark the wall face</h3><p>Drag the corners in order: top left, top right, bottom right, bottom left. Keep the outline inside the wall.</p>
          <div className="photo-button-row"><button type="button" className={action()} disabled={project.surfaces.length >= 6} onClick={() => { const wall = makeSurface(project.surfaces.length); commit({ ...project, surfaces: [...project.surfaces, wall] }); setSelectedId(wall.id); setTool('corners'); }}>Add wall ({project.surfaces.length}/6)</button><button type="button" className={action()} disabled={!selected} onClick={() => { commit({ ...project, surfaces: project.surfaces.filter(s => s.id !== selected!.id) }); setSelectedId(project.surfaces.find(s => s.id !== selected!.id)?.id || ''); }}>Delete wall</button></div>
          {selected && <>
            <label className="photo-field">Wall name<input value={selected.name} maxLength={100} onChange={e => { if (e.target.value.trim()) patchSurface({ name: e.target.value }); }} /></label>
            <fieldset><legend>Protect furniture and openings</legend><div className="photo-button-row">{(['corners', 'erase', 'restore'] as const).map(value => <button type="button" key={value} className={action(tool === value)} aria-pressed={tool === value} onClick={() => { setTool(value); setShowGuides(true); setShowOriginal(false); }}>{value === 'corners' ? 'Move corners' : value === 'erase' ? 'Protect / erase' : 'Restore finish'}</button>)}</div><p className="photo-help">Erase over windows, doors, trim and furniture to keep their original pixels. Restore returns the finish inside the wall.</p><label className="photo-field">Brush radius ({Math.round(brush * 1000) / 10}% of photo)<input type="range" min={.003} max={.1} step={.001} value={brush} onChange={e => setBrush(Number(e.target.value))} /></label><button type="button" className={action()} disabled={!selected.strokes.length} onClick={() => patchSurface({ strokes: [] })}>Clear wall protection</button></fieldset>
            <details className="photo-disclosure"><summary>Precise corner positions</summary>{selected.corners.map((corner, i) => <div className="photo-two-col" key={i}>{(['x', 'y'] as const).map(axis => <label className="photo-field" key={axis}>{names[i]} {axis === 'x' ? 'across' : 'down'} (%)<input type="number" min={0} max={100} step={.1} value={Math.round(corner[axis] * 1000) / 10} onChange={e => { const corners = selected.corners.map((p, k) => k === i ? { ...p, [axis]: Number(e.target.value) / 100 } : p) as PhotoSurface['corners']; patchSurface({ corners }); }} /></label>)}</div>)}</details>
            <h3>Wall measurements</h3><p className="photo-help">Enter both dimensions to calibrate an accepted wallpaper repeat. Leave unknown dimensions blank for illustrative placement.</p><div className="photo-two-col">{(['widthMm', 'heightMm'] as const).map(key => <label className="photo-field" key={key}>Wall {key === 'widthMm' ? 'width' : 'height'} (mm)<input type="number" min={1} max={30000} step={1} value={selected[key] || ''} placeholder="Unknown" onChange={e => patchSurface({ [key]: e.target.value ? Number(e.target.value) : null })} /></label>)}</div>
            <button type="button" className={action(true)} onClick={() => { setStep('finishes'); setTool('corners'); }}>Choose a finish</button>
          </>}
        </>}
        {step === 'finishes' && (selected ? <>
          <h3>Find your finish</h3><PhotoFinishPicker finishes={project.finishes} selectedId={selected.finishId} removableIds={removableFinishIds} onSave={saveFinish} onSelect={id => patchSurface({ finishId: id })} onRemove={removeFinish} />
          {finish && <fieldset><legend>Place {finish.name}</legend><p className={`photo-scale-status ${isPhysicalPhotoScale(selected, finish) ? 'is-measured' : ''}`}>{isPhysicalPhotoScale(selected, finish) ? 'Physically calibrated scale: both wall dimensions and artwork proof recorded.' : finish.type === 'paint' || finish.type === 'bauwerk' ? 'Illustrative colour and surface movement' : 'Illustrative scale: enter both wall dimensions and check the artwork proof.'}</p>
            {(finish.type === 'wallpaper' || finish.type === 'mural') && <p className="photo-help">Artwork source: {finish.texture.widthPx} × {finish.texture.heightPx} pixels. Fine detail depends on the original image and the size of the pattern in your view; a larger PNG cannot recover missing detail.</p>}
            {qualityWarning && <p className="photo-scale-status">{qualityWarning}</p>}
            {(finish.type === 'wallpaper' || finish.type === 'mural') && <><label className="photo-field">Pattern scale ({Math.round(selected.scale * 100)}%)<input type="range" min={.25} max={3} step={.05} value={selected.scale} onChange={e => patchSurface({ scale: Number(e.target.value) })} /></label><button type="button" className={action()} onClick={() => patchSurface({ scale: 1 })}>Use calibrated scale</button><div className="photo-two-col"><label className="photo-field">Horizontal start (mm)<input type="number" min={-60000} max={60000} step={1} value={selected.offsetXmm} onChange={e => patchSurface({ offsetXmm: Number(e.target.value) })} /></label><label className="photo-field">Start above wall bottom (mm)<input type="number" min={-60000} max={60000} step={1} value={selected.offsetYmm} onChange={e => patchSurface({ offsetYmm: Number(e.target.value) })} /></label></div><p className="photo-help">Artwork is positioned from the wall's bottom left. Murals retain original wall pixels beyond their finite artwork.</p></>}
            <label className="photo-field">Retain photograph shading ({Math.round(selected.shading * 100)}%)<input type="range" min={0} max={1} step={.05} value={selected.shading} onChange={e => patchSurface({ shading: Number(e.target.value) })} /></label><p className="photo-help">Approximate light and shadow from your photograph. This cannot predict metallic reflections or physical relief.</p>
            {finish.type === 'bauwerk' && <p className="photo-help"><a href={finish.productUrl} target="_blank" rel="noreferrer">{finish.name}: product and sample</a></p>}
          </fieldset>}
          <button type="button" className={action(true)} onClick={() => { setStep('save'); setShowGuides(false); }}>Compare & download</button>
        </> : <p>Add a wall before choosing a finish.</p>)}
        {step === 'save' && <>
          <h3>Keep your favourite</h3><p>Save a comparison, adjust the finishes, then switch between your ideas.</p><label className="photo-field">Comparison name<input value={comparisonName} maxLength={100} placeholder={`Idea ${project.comparisons.length + 1}`} onChange={e => setComparisonName(e.target.value)} /></label><button type="button" className={action()} disabled={project.comparisons.length >= PHOTO_LIMITS.comparisons} onClick={() => { if (commit({ ...project, comparisons: [...project.comparisons, { id: crypto.randomUUID(), name: comparisonName.trim() || `Idea ${project.comparisons.length + 1}`, createdAt: now(), surfaces: structuredClone(project.surfaces), finishes: structuredClone(project.finishes) }] })) { setComparisonName(''); setMessage('Comparison saved on this device.'); } }}>Save comparison ({project.comparisons.length}/8)</button>
          <div className="photo-comparisons">{project.comparisons.map(comparison => <div key={comparison.id}><button type="button" className={action()} onClick={() => { if (commit({ ...project, surfaces: structuredClone(comparison.surfaces), finishes: structuredClone(comparison.finishes) })) { setSelectedId(comparison.surfaces[0]?.id || ''); setMessage(`${comparison.name} restored. Undo returns to the previous design.`); } }}>{comparison.name}</button><button type="button" className={action()} aria-label={`Delete comparison ${comparison.name}`} onClick={() => commit({ ...project, comparisons: project.comparisons.filter(c => c.id !== comparison.id) })}>Delete</button></div>)}</div>
          <div className="photo-downloads"><button type="button" className={action(true)} disabled={busy} onClick={() => void exportPng()}>Download room preview PNG</button><p className="photo-help">{size!.width} × {size!.height} pixels. Source detail is preserved without upscaling. Output size cannot restore missing artwork detail.</p><button type="button" className={action()} onClick={() => { try { download(new Blob([serializePortableJson(project)], { type: 'application/json' }), 'my-room.photo.json'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'This editable photo could not be downloaded.'); } }}>Download editable photo project</button><p className="photo-help">Editable downloads are capped at 160 MB, including saved comparisons. Individual images remain limited to 20 MB; source images in a project remain limited to 100 MB.</p></div>
          <p className="photo-help">This photo preview shows the surfaces visible in one photograph. Build a measured 3D room for additional viewpoints and a 360° panorama.</p>{onReturnTo3D && <button type="button" className={action()} onClick={onReturnTo3D}>Build my room in 3D</button>}
          <details className="photo-disclosure"><summary>Remove this photo from this device</summary><p>Download an editable copy first if you want to keep it. This removes the current local photo and its comparisons.</p><button type="button" className={action()} disabled={busy || deletingLocal} onClick={() => void eraseLocalPhoto()}>Delete local photo project</button></details>
          <PhotoCloudPanel project={project} onOpen={next => { if (localDeletion.current || current.current !== project) throw new Error('Your photo changed while this saved project was loading. Open the saved photo again.'); assertLocalProject(next, false); setProject(next); setAutosaveAllowed(portableJsonBytes(next) <= PORTABLE_DOCUMENT_BUDGET_BYTES); setSelectedId(next.surfaces[0]?.id || ''); setPast([]); setFuture([]); }} />
        </>}
      </aside></div>
    </>}
    {error && <p className="photo-error" role="alert">{error}</p>}{message && <p className="photo-message" role="status">{message}</p>}
  </section>;
}
