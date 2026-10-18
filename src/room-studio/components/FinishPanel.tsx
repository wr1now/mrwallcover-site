import { useEffect, useId, useMemo, useState } from 'react';
import type { ArtworkCalibration, ArtworkFinish, FinishAsset, PaintFinish, RoomProject } from '../types.ts';
import { artworkProofDataUrl, assignFinishBand, calibrationErrors, checkEmbeddedArtwork, normaliseHex, proportionalMuralCalibration, readArtworkFile, rotatedCropSize, saveFinish } from '../finishes.ts';
import { bauwerkCatalogue, bauwerkFamilies, findBauwerkShades, type BauwerkShade } from '../catalogue/index.ts';
import { isBauwerkProductUrl } from '../validation.ts';

interface Props { project: RoomProject; selectedWallId: string; onChange: (project: RoomProject) => void; }
const action = (variant = 'secondary') => `mw-action mw-action--${variant}`;
const id = () => crypto.randomUUID();
const defaultCalibration = (mural = false): ArtworkCalibration => ({ widthMm: mural ? 3000 : 530, heightMm: mural ? 2400 : 640, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'tile', match: 'straight', offsetAlreadyIncluded: false, proofAccepted: false });

export default function FinishPanel({ project, selectedWallId, onChange }: Props) {
  const uid = useId();
  const [tab, setTab] = useState<'paint' | 'artwork' | 'bauwerk'>('paint');
  const [finishId, setFinishId] = useState('');
  const [paintName, setPaintName] = useState('My paint colour');
  const [paintHex, setPaintHex] = useState('#E8E1D2');
  const [sheen, setSheen] = useState<PaintFinish['sheen']>('matte');
  const [artworkType, setArtworkType] = useState<ArtworkFinish['type']>('wallpaper');
  const [draft, setDraft] = useState<ArtworkFinish | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [proof, setProof] = useState('');
  const [reading, setReading] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [band, setBand] = useState(false);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(project.room.heightMm);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [allWalls, setAllWalls] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem('mw-studio-bauwerk-favourites') ?? '[]'); if (Array.isArray(stored)) setFavourites(new Set(stored.filter(item => typeof item === 'string'))); } catch { /* Preferences are optional. */ }
  }, []);
  useEffect(() => { setTo(project.room.heightMm); }, [project.room.heightMm]);
  useEffect(() => {
    let cancelled = false;
    setProof('');
    if (!draft || calibrationErrors(draft.calibration).length) return;
    setProofLoading(true);
    artworkProofDataUrl(draft).then(url => { if (!cancelled) { setProof(url); setProofLoading(false); } }).catch(reason => { if (!cancelled) { setError(reason.message); setProofLoading(false); } });
    return () => { cancelled = true; };
  }, [draft]);

  const selectedFinish = project.finishes.find(finish => finish.id === finishId);
  const safeDraftImage = useMemo(() => { if (!draft) return false; try { checkEmbeddedArtwork(draft.texture); return true; } catch { return false; } }, [draft?.texture]);
  const wallIndex = project.room.vertices.findIndex(vertex => vertex.wallId === selectedWallId);
  const shades = useMemo(() => findBauwerkShades(query, family, favouritesOnly ? favourites : undefined), [query, family, favouritesOnly, favourites]);
  const say = (text: string) => { setMessage(text); setError(''); };
  const updateCalibration = (patch: Partial<ArtworkCalibration>) => {
    setError(''); setRightsConfirmed(false); setDraft(current => current ? { ...current, calibration: current.type === 'mural' ? proportionalMuralCalibration(current.texture, current.calibration, patch) : { ...current.calibration, ...patch, proofAccepted: false } } : null);
  };
  const updateCrop = (key: keyof ArtworkCalibration['crop'], value: number) => {
    if (draft) updateCalibration({ crop: { ...draft.calibration.crop, [key]: value / 100 } });
  };

  async function upload(file?: File) {
    if (!file) return;
    setReading(true); setError(''); setProof(''); setRightsConfirmed(false);
    try {
      const texture = await readArtworkFile(file);
      const calibration = defaultCalibration(artworkType === 'mural');
      if (artworkType === 'mural') { const size = rotatedCropSize(texture.widthPx, texture.heightPx, calibration); calibration.widthMm = Math.max(1, Math.round(3000 * size.width / Math.max(size.width, size.height))); }
      setDraft({ id: id(), type: artworkType, name: file.name.replace(/\.[^.]+$/, ''), texture, calibration: artworkType === 'mural' ? proportionalMuralCalibration(texture, calibration) : calibration });
      say('Artwork loaded. Set its crop, orientation and real dimensions, then check the proof.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be loaded.'); }
    finally { setReading(false); }
  }

  function storeArtwork() {
    if (!draft) return;
    const errors = calibrationErrors(draft.calibration);
    if (errors.length || !rightsConfirmed || !proof || proofLoading) { setError(errors[0] ?? 'Check the proof and confirm that you may use this artwork.'); return; }
    const finish: ArtworkFinish = { ...draft, name: draft.name.trim() || 'My artwork', calibration: { ...draft.calibration, proofAccepted: true } };
    try { onChange(saveFinish(project, finish)); setFinishId(finish.id); setDraft(null); say('Artwork and repeat proof saved. Apply it to a wall below.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be saved.'); }
  }

  function storePaint() {
    const colour = normaliseHex(paintHex);
    if (!colour) { setError('Enter a six-digit HEX colour, for example #E8E1D2.'); return; }
    const finish: PaintFinish = { id: id(), type: 'paint', name: paintName.trim() || colour, colour, sheen };
    try { onChange(saveFinish(project, finish)); setFinishId(finish.id); say('Paint colour saved. Apply it to a wall below.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be saved.'); }
  }

  function selectBauwerk(shade: BauwerkShade) {
    const finish: FinishAsset = { id: `bauwerk-${shade.id}`, type: 'bauwerk', name: shade.name, colour: shade.colour, shadeId: shade.id, catalogueVersion: bauwerkCatalogue.version, productUrl: shade.productUrl, colourProvenance: 'manufacturer', seed: Number(shade.id.slice(-8)) };
    const previousUnused = selectedFinish?.type === 'bauwerk' && !project.assignments.some(a => a.finishId === selectedFinish.id) && !project.schemes.some(scheme => scheme.finishes.some(f => f.id === selectedFinish.id));
    const next = previousUnused ? { ...project, finishes: project.finishes.filter(f => f.id !== selectedFinish.id) } : project;
    try { onChange(saveFinish(next, finish)); setFinishId(finish.id); say(`${shade.name} selected. Apply this limewash shade to a wall below.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be saved.'); }
  }

  function toggleFavourite(shadeId: string) {
    const next = new Set(favourites); next.has(shadeId) ? next.delete(shadeId) : next.add(shadeId); setFavourites(next);
    try { localStorage.setItem('mw-studio-bauwerk-favourites', JSON.stringify([...next])); } catch { /* Private browsing may disable preference storage. */ }
  }

  function apply() {
    if (!selectedFinish) { setError('Choose a saved finish first.'); return; }
    if ((selectedFinish.type === 'wallpaper' || selectedFinish.type === 'mural') && !selectedFinish.calibration.proofAccepted) { setError('Confirm the artwork proof before applying it.'); return; }
    try {
      const wallIds = allWalls ? project.room.vertices.map(vertex => vertex.wallId) : [selectedWallId];
      let next = project;
      for (const wallId of wallIds) next = assignFinishBand(next, { id: id(), wallId, finishId: selectedFinish.id, fromMm: band ? from : 0, toMm: band ? to : null, offsetXmm: offsetX, offsetYmm: offsetY });
      onChange(next); say(`${selectedFinish.name} applied to ${allWalls ? 'all walls' : `wall ${wallIndex + 1}`}${band ? ' in the selected band' : ''}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be applied.'); }
  }

  function centre() {
    if (!selectedFinish || (selectedFinish.type !== 'wallpaper' && selectedFinish.type !== 'mural') || wallIndex < 0) return;
    const a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length];
    setOffsetX(Math.round((Math.hypot(b.x - a.x, b.z - a.z) - selectedFinish.calibration.widthMm) / 2));
    setOffsetY(Math.round(((band ? to - from : project.room.heightMm) - selectedFinish.calibration.heightMm) / 2 + (band ? from : 0)));
    say('Artwork centred on the selected wall or band. Apply to save the placement.');
  }

  return <section className="studio-finish-panel" aria-labelledby={`${uid}-title`}>
    <h3 id={`${uid}-title`}>Choose your finish</h3>
    <div className="studio-button-row" role="group" aria-label="Finish type">
      <button type="button" className={action(tab === 'paint' ? 'primary' : 'secondary')} aria-pressed={tab === 'paint'} onClick={() => setTab('paint')}>Paint</button>
      <button type="button" className={action(tab === 'artwork' ? 'primary' : 'secondary')} aria-pressed={tab === 'artwork'} onClick={() => setTab('artwork')}>Wallpaper / mural</button>
      <button type="button" className={action(tab === 'bauwerk' ? 'primary' : 'secondary')} aria-pressed={tab === 'bauwerk'} onClick={() => setTab('bauwerk')}>Bauwerk limewash</button>
    </div>

    {tab === 'paint' && <div className="studio-finish-editor">
      <p>Save your own colours, then combine painted walls with wallpaper.</p>
      <label className="studio-field">Colour name<input value={paintName} maxLength={100} onChange={event => setPaintName(event.target.value)} /></label>
      <div className="studio-row">
        <label className="studio-field">Colour<input type="color" value={normaliseHex(paintHex) ?? '#E8E1D2'} onChange={event => setPaintHex(event.target.value.toUpperCase())} /></label>
        <label className="studio-field">HEX<input value={paintHex} pattern="#[0-9a-fA-F]{6}" maxLength={7} onChange={event => setPaintHex(event.target.value)} /></label>
      </div>
      <label className="studio-field">Finish<select value={sheen} onChange={event => setSheen(event.target.value as PaintFinish['sheen'])}><option value="matte">Matte</option><option value="eggshell">Eggshell</option></select></label>
      <button type="button" className={action('primary')} onClick={storePaint}>Save paint colour</button>
      <p className="studio-help">A custom digital colour is a visual reference. Check a physical paint sample for the final choice.</p>
    </div>}

    {tab === 'artwork' && <div className="studio-finish-editor">
      <label className="studio-field">Artwork type<select value={artworkType} onChange={event => { const type = event.target.value as ArtworkFinish['type']; setArtworkType(type); setDraft(null); }}><option value="wallpaper">Repeating wallpaper</option><option value="mural">Single mural</option></select></label>
      <label className="studio-field">Upload your artwork<input type="file" accept="image/png,image/jpeg,image/webp" disabled={reading} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <p className="studio-help">PNG, JPEG or WebP, up to 20 MB. Upload the design you may use, without room photography or sample-card borders. Files stay in this project.</p>
      {reading && <p role="status">Reading artwork…</p>}
      {draft && <fieldset className="studio-artwork-calibration"><legend>Calibrate {draft.type === 'mural' ? 'the mural' : 'the repeat'}</legend>
        <label className="studio-field">Artwork name<input value={draft.name} maxLength={100} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="studio-field">Orientation<select value={draft.calibration.rotation} onChange={event => updateCalibration({ rotation: Number(event.target.value) as ArtworkCalibration['rotation'] })}>{[0, 90, 180, 270].map(rotation => <option key={rotation} value={rotation}>{rotation}° clockwise</option>)}</select></label>
        <p className="studio-help">Crop the original image first. Dimensions below describe that selected crop after rotation.</p>
        {safeDraftImage && <figure className="studio-crop-source"><svg viewBox={`0 0 ${draft.texture.widthPx} ${draft.texture.heightPx}`} role="img" aria-label="Original artwork with selected crop outlined"><image href={draft.texture.dataUrl} width={draft.texture.widthPx} height={draft.texture.heightPx} /><rect x={draft.calibration.crop.x * draft.texture.widthPx} y={draft.calibration.crop.y * draft.texture.heightPx} width={draft.calibration.crop.width * draft.texture.widthPx} height={draft.calibration.crop.height * draft.texture.heightPx} fill="none" stroke="#fff" strokeWidth={Math.max(draft.texture.widthPx, draft.texture.heightPx) / 100} /><rect x={draft.calibration.crop.x * draft.texture.widthPx} y={draft.calibration.crop.y * draft.texture.heightPx} width={draft.calibration.crop.width * draft.texture.widthPx} height={draft.calibration.crop.height * draft.texture.heightPx} fill="none" stroke="#26352a" strokeWidth={Math.max(draft.texture.widthPx, draft.texture.heightPx) / 220} /></svg><figcaption>Original image; outlined area becomes the selected crop.</figcaption></figure>}
        <div className="studio-row">{(['x', 'y', 'width', 'height'] as const).map(key => <label className="studio-field" key={key}>{({ x: 'Crop left', y: 'Crop top', width: 'Crop width', height: 'Crop height' })[key]} (%)<input type="number" min={key === 'x' || key === 'y' ? 0 : .1} max={100} step={.1} value={Math.round(draft.calibration.crop[key] * 1000) / 10} onChange={event => updateCrop(key, Number(event.target.value))} /></label>)}</div>
        <div className="studio-row"><label className="studio-field">Real width (mm)<input type="number" min={1} max={30000} value={draft.calibration.widthMm} onChange={event => updateCalibration({ widthMm: Number(event.target.value) })} /></label><label className="studio-field">Real height (mm)<input type="number" min={1} max={30000} value={draft.calibration.heightMm} onChange={event => updateCalibration({ heightMm: Number(event.target.value) })} /></label></div>
        {draft.type === 'mural' && <p className="studio-help">Mural proportions stay linked to the selected crop. Change either real dimension to resize it; orientation swaps width and height.</p>}
        {draft.type === 'wallpaper' && <>
          <label className="studio-field">Image represents<select value={draft.calibration.repeatKind} onChange={event => updateCalibration({ repeatKind: event.target.value as ArtworkCalibration['repeatKind'] })}><option value="tile">A complete seamless repeat tile</option><option value="strip">One wallpaper strip / repeat</option></select></label>
          <label className="studio-field">Pattern match<select value={draft.calibration.match} onChange={event => updateCalibration({ match: event.target.value as ArtworkCalibration['match'] })}><option value="straight">Straight / free match</option><option value="half-drop">Half-drop</option></select></label>
          {draft.calibration.match === 'half-drop' && <label className="studio-check"><input type="checkbox" checked={draft.calibration.offsetAlreadyIncluded} onChange={event => updateCalibration({ offsetAlreadyIncluded: event.target.checked })} />The stagger is already included in this artwork tile</label>}
          {draft.calibration.match === 'half-drop' && draft.calibration.repeatKind === 'tile' && !draft.calibration.offsetAlreadyIncluded && <p className="studio-help">For a single strip needing alternate drops, select “One wallpaper strip”. A complete seamless tile repeats as supplied.</p>}
        </>}
        {calibrationErrors(draft.calibration).map(text => <p className="studio-error" key={text}>{text}</p>)}
        {proofLoading && <p role="status">Preparing the pattern proof…</p>}
        {proof && <figure className="studio-repeat-proof"><img src={proof} width={720} height={420} alt={draft.type === 'mural' ? `Cropped and rotated proof of ${draft.name}` : `Four strips of ${draft.name}, showing the selected repeat and alternate drop`} /><figcaption>{draft.type === 'mural' ? 'Mural artwork proof' : 'Repeat proof: four widths; dashed lines mark strip boundaries'}. Selected artwork: {draft.calibration.widthMm} × {draft.calibration.heightMm} mm. Check direction, scale and joins.</figcaption></figure>}
        <label className="studio-check"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)} />I may use this artwork and have checked the crop, real size and repeat proof.</label>
        <button type="button" className={action('primary')} disabled={!proof || proofLoading || !rightsConfirmed || calibrationErrors(draft.calibration).length > 0} onClick={storeArtwork}>Accept proof and save artwork</button>
      </fieldset>}
    </div>}

    {tab === 'bauwerk' && <div className="studio-finish-editor">
      <p>{bauwerkCatalogue.shadeCount} Bauwerk shades. UK palette checked {new Date(`${bauwerkCatalogue.checkedAt}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}. Colour and limewash movement are approximate.</p>
      <label className="studio-field">Find a Bauwerk shade<input type="search" value={query} placeholder="Try Bone, Olive, Paprika…" onChange={event => setQuery(event.target.value)} /></label>
      <label className="studio-field">Colour family<select value={family} onChange={event => setFamily(event.target.value)}><option value="">All colour families</option>{bauwerkFamilies.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
      <label className="studio-check"><input type="checkbox" checked={favouritesOnly} onChange={event => setFavouritesOnly(event.target.checked)} />Show my favourites</label>
      <p className="studio-help" aria-live="polite">{shades.length} {shades.length === 1 ? 'shade' : 'shades'}</p>
      <div className="studio-shade-list" aria-label="Bauwerk limewash shades">{shades.map(shade => <div className="studio-shade-row" key={shade.id}>
        <button type="button" className={`studio-shade ${finishId === `bauwerk-${shade.id}` ? 'is-selected' : ''}`} aria-pressed={finishId === `bauwerk-${shade.id}`} onClick={() => selectBauwerk(shade)}><span className="studio-swatch" style={{ backgroundColor: shade.colour }} aria-hidden="true" /><span>{shade.name}</span></button>
        <button type="button" className={action('quiet')} aria-label={`${favourites.has(shade.id) ? 'Remove' : 'Add'} ${shade.name} ${favourites.has(shade.id) ? 'from' : 'to'} favourites`} aria-pressed={favourites.has(shade.id)} onClick={() => toggleFavourite(shade.id)}>{favourites.has(shade.id) ? '★' : '☆'}</button>
      </div>)}</div>
      {shades.length === 0 && <p>No matching shades. Clear the name or family filter to browse all colours.</p>}
      <p className="studio-help">Browse the official <a href={bauwerkCatalogue.collectionUrl} target="_blank" rel="noreferrer">Bauwerk Colour UK range</a>. <a href="https://www.bauwerkcolour.com/en-gb/ai-policy" target="_blank" rel="noreferrer">Why samples matter</a>.</p>
    </div>}

    <fieldset className="studio-finish-application"><legend>Apply to your room</legend>
      <label className="studio-field">Saved finish<select value={finishId} onChange={event => setFinishId(event.target.value)}><option value="">Choose a saved finish</option>{project.finishes.map(finish => <option key={finish.id} value={finish.id}>{finish.name} · {finish.type === 'bauwerk' ? 'Bauwerk limewash' : finish.type}</option>)}</select></label>
      {selectedFinish && !project.assignments.some(a => a.finishId === selectedFinish.id) && !project.schemes.some(scheme => scheme.finishes.some(f => f.id === selectedFinish.id)) && <button type="button" className={action('quiet')} onClick={() => { onChange({ ...project, finishes: project.finishes.filter(f => f.id !== selectedFinish.id) }); setFinishId(''); say('Unused finish removed.'); }}>Remove unused finish</button>}
      {selectedFinish?.type === 'bauwerk' && (isBauwerkProductUrl(selectedFinish.productUrl) ? <p><a href={selectedFinish.productUrl} target="_blank" rel="noreferrer">{selectedFinish.name}: product and physical samples ↗</a></p> : <p className="studio-error" role="status">This saved shade has an invalid product link. Select its shade from the verified Bauwerk palette to replace it.</p>)}
      {(selectedFinish?.type === 'wallpaper' || selectedFinish?.type === 'mural') && <button type="button" className={action('quiet')} onClick={() => { setTab('artwork'); setDraft({ ...selectedFinish, calibration: selectedFinish.type === 'mural' ? proportionalMuralCalibration(selectedFinish.texture, selectedFinish.calibration) : { ...selectedFinish.calibration, crop: { ...selectedFinish.calibration.crop }, proofAccepted: false } }); setRightsConfirmed(false); }}>Edit crop and repeat proof</button>}
      <p>{wallIndex >= 0 ? `Selected: wall ${wallIndex + 1}. Select another wall in the plan.` : 'Select a wall in the plan.'}</p>
      <label className="studio-check"><input type="checkbox" checked={allWalls} onChange={event => setAllWalls(event.target.checked)} />Apply to all walls</label>
      <label className="studio-check"><input type="checkbox" checked={band} onChange={event => setBand(event.target.checked)} />Apply within a horizontal band</label>
      {band && <div className="studio-row"><label className="studio-field">Band bottom above floor (mm)<input type="number" min={0} max={project.room.heightMm} value={from} onChange={event => setFrom(Number(event.target.value))} /></label><label className="studio-field">Band top above floor (mm)<input type="number" min={1} max={project.room.heightMm} value={to} onChange={event => setTo(Number(event.target.value))} /></label></div>}
      {(selectedFinish?.type === 'wallpaper' || selectedFinish?.type === 'mural') && <>
        <div className="studio-row"><label className="studio-field">Horizontal start from wall left (mm)<input type="number" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label><label className="studio-field">Vertical start above floor (mm)<input type="number" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label></div>
        <button type="button" className={action('secondary')} disabled={wallIndex < 0 || allWalls} onClick={centre}>Centre artwork on selected wall</button>
      </>}
      <button type="button" className={action('primary')} disabled={!selectedFinish || (!allWalls && wallIndex < 0)} onClick={apply}>Apply finish</button>
    </fieldset>
    {error && <p className="studio-error" role="alert">{error}</p>}
    {message && <p className="studio-status" role="status">{message}</p>}
  </section>;
}
