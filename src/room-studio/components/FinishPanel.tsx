import { useEffect, useId, useMemo, useState } from 'react';
import type { ArtworkCalibration, ArtworkFinish, ArtworkPanel, FinishAsset, PaintFinish, RoomProject } from '../types.ts';
import { APPEARANCE_PRESETS, artworkProofDataUrl, assignFinishBand, customArtwork, linkFinishWallRun, calibrationErrors, checkEmbeddedArtwork, normaliseHex, proportionalMuralCalibration, readArtworkFile, rotatedCropSize, saveFinish } from '../finishes.ts';
import { bauwerkCatalogue, bauwerkFamilies, findBauwerkShades, type BauwerkShade } from '../catalogue/index.ts';
import { catalogueProducts, selectCatalogueFinish } from '../catalogue-products.ts';
import { artworkCoverageIssues } from '../wall-runs.ts';
import { sourceQualityIssues } from '../quality.ts';
import { isBauwerkProductUrl, validateFinishAssets } from '../validation.ts';

interface Props { project: RoomProject; selectedWallId: string; onChange: (project: RoomProject) => boolean | void; }
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
  const [panelMode, setPanelMode] = useState(false);
  const [chosenWalls, setChosenWalls] = useState<string[]>([]);
  const [application, setApplication] = useState<'feature' | 'selected' | 'whole'>('feature');
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
  const sourceDetail = draft && safeDraftImage && !calibrationErrors(draft.calibration).length ? rotatedCropSize(draft.texture.widthPx, draft.texture.heightPx, draft.calibration) : null;
  const wallIndex = project.room.vertices.findIndex(vertex => vertex.wallId === selectedWallId);
  const shades = useMemo(() => findBauwerkShades(query, family, favouritesOnly ? favourites : undefined), [query, family, favouritesOnly, favourites]);
  const say = (text: string) => { setMessage(text); setError(''); };
  const commit = (next: RoomProject) => {
    if (onChange(next) !== false) return true;
    setMessage('');
    setError('This change was not saved. Check the room message, then try again.');
    return false;
  };
  const coverage = artworkCoverageIssues(project);
  const detailWarnings = sourceQualityIssues(project);
  const updateCalibration = (patch: Partial<ArtworkCalibration>) => {
    setError(''); setRightsConfirmed(false); setDraft(current => current ? customArtwork(current, { calibration: current.type === 'mural' ? proportionalMuralCalibration(current.texture, current.calibration, patch) : { ...current.calibration, ...patch, proofAccepted: false } }) : null);
  };
  const updateCrop = (key: keyof ArtworkCalibration['crop'], value: number) => {
    if (draft) updateCalibration({ crop: { ...draft.calibration.crop, [key]: value / 100 } });
  };

  async function upload(files: File[]) {
    const file = files[0]; if (!file) return;
    setReading(true); setError(''); setProof(''); setRightsConfirmed(false);
    try {
      if (files.length > 24 || files.reduce((sum, value) => sum + value.size, 0) > 80 * 1024 * 1024) throw new Error('Choose up to 24 numbered panels, with at most 80 MB combined to leave room for project files.');
      const textures = [];
      for (const source of (panelMode ? files : [file])) textures.push(await readArtworkFile(source));
      const texture = textures[0];
      const calibration = defaultCalibration(artworkType === 'mural');
      if (artworkType === 'mural') { const size = rotatedCropSize(texture.widthPx, texture.heightPx, calibration); calibration.widthMm = Math.max(1, Math.round(3000 * size.width / Math.max(size.width, size.height))); }
      const panels: ArtworkPanel[] | undefined = panelMode ? textures.map((value, index) => ({ id: id(), number: index + 1, texture: value, heightMm: 2400, widthMm: Math.round(2400 * value.widthPx / value.heightPx * 10) / 10 })) : undefined;
      setDraft({ id: id(), type: panelMode ? 'mural' : artworkType, name: file.name.replace(/\.[^.]+$/, ''), texture, calibration: panels ? { ...calibration, widthMm: panels[0].widthMm, heightMm: panels[0].heightMm } : artworkType === 'mural' ? proportionalMuralCalibration(texture, calibration) : calibration, ...(panels ? { panels } : {}) });
      say('Artwork loaded. Set its crop, orientation and real dimensions, then check the proof.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be loaded.'); }
    finally { setReading(false); }
  }

  function storeArtwork() {
    if (!draft) return;
    const errors = calibrationErrors(draft.calibration);
    if (errors.length || !rightsConfirmed || !proof || proofLoading) { setError(errors[0] ?? 'Check the proof and confirm that you may use this artwork.'); return; }
    const finish: ArtworkFinish = { ...draft, name: draft.name.trim() || 'My artwork', calibration: { ...draft.calibration, proofAccepted: true } };
    try { const issues = validateFinishAssets([finish]); if (issues.length) throw new Error(issues[0].message); if (!commit(saveFinish(project, finish))) return; setFinishId(finish.id); setDraft(null); say('Artwork and repeat proof saved. Apply it to a wall below.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be saved.'); }
  }

  function storePaint() {
    const colour = normaliseHex(paintHex);
    if (!colour) { setError('Enter a six-digit HEX colour, for example #E8E1D2.'); return; }
    const finish: PaintFinish = { id: id(), type: 'paint', name: paintName.trim() || colour, colour, sheen };
    try { if (!commit(saveFinish(project, finish))) return; setFinishId(finish.id); say('Paint colour saved. Apply it to a wall below.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be saved.'); }
  }

  function selectBauwerk(shade: BauwerkShade) {
    const finish: FinishAsset = { id: `bauwerk-${shade.id}`, type: 'bauwerk', name: shade.name, colour: shade.colour, shadeId: shade.id, catalogueVersion: bauwerkCatalogue.version, productUrl: shade.productUrl, colourProvenance: 'manufacturer', seed: Number(shade.id.slice(-8)) };
    const previousUnused = selectedFinish?.type === 'bauwerk' && !project.assignments.some(a => a.finishId === selectedFinish.id) && !project.schemes.some(scheme => scheme.finishes.some(f => f.id === selectedFinish.id));
    const next = previousUnused ? { ...project, finishes: project.finishes.filter(f => f.id !== selectedFinish.id) } : project;
    try { if (!commit(saveFinish(next, finish))) return; setFinishId(finish.id); say(`${shade.name} selected. Apply this limewash shade to a wall below.`); }
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
      const vertices = project.room.vertices, start = Math.max(0, vertices.findIndex(vertex => vertex.wallId === selectedWallId));
      const ordered = vertices.map((_, index) => vertices[(start + index) % vertices.length].wallId);
      const wallIds = allWalls ? ordered : application === 'selected' ? ordered.filter(wallId => chosenWalls.includes(wallId)) : [selectedWallId];
      if (!wallIds.length) throw new Error('Choose at least one wall.');
      let next = project;
      for (const wallId of wallIds) next = assignFinishBand(next, { id: id(), wallId, finishId: selectedFinish.id, fromMm: band ? from : 0, toMm: band ? to : null, offsetXmm: offsetX, offsetYmm: offsetY });
      if ((selectedFinish.type === 'wallpaper' && allWalls) || (selectedFinish.type === 'mural' && selectedFinish.panels?.length)) next = linkFinishWallRun(next, selectedFinish.id, wallIds, offsetX, { fromMm: band ? from : 0, toMm: band ? to : null });
      if (!commit(next)) return; say(`${selectedFinish.name} applied to ${allWalls ? 'all walls' : `wall ${wallIndex + 1}`}${band ? ' in the selected band' : ''}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The finish could not be applied.'); }
  }

  function centre() {
    if (!selectedFinish || (selectedFinish.type !== 'wallpaper' && selectedFinish.type !== 'mural') || wallIndex < 0) return;
    const a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length];
    setOffsetX(Math.round((Math.hypot(b.x - a.x, b.z - a.z) - selectedFinish.calibration.widthMm) / 2));
    setOffsetY(Math.round(((band ? to - from : project.room.heightMm) - selectedFinish.calibration.heightMm) / 2 + (band ? from : 0)));
    say('Artwork centred on the selected wall or band. Apply to save the placement.');
  }

  function continuePattern() {
    if (selectedFinish?.type !== 'wallpaper') return;
    try {
      const seeds = project.assignments.filter(value => value.wallId === selectedWallId && value.finishId === selectedFinish.id);
      if (seeds.length !== 1) throw new Error('Select a wall with one saved band of this wallpaper to start the connected run.');
      const seed = seeds[0], wallIds = [selectedWallId];
      for (let step = 1; step < project.room.vertices.length; step++) {
        const current = project.room.vertices[(wallIndex + step) % project.room.vertices.length];
        if (!project.assignments.some(value => value.wallId === current.wallId && value.finishId === selectedFinish.id && value.fromMm === seed.fromMm && value.toMm === seed.toMm)) break;
        wallIds.push(current.wallId);
      }
      const next = linkFinishWallRun(project, selectedFinish.id, wallIds, seed.offsetXmm, { fromMm: seed.fromMm, toMm: seed.toMm });
      if (next === project) { say('No placement change needed. Only adjoining walls already using this wallpaper in the same height band are linked.'); return; }
      if (!commit(next)) return;
      say('Pattern placement continues from this wall through adjoining walls with the same wallpaper and height band. Vertical placement is unchanged; check the closing join.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The wallpaper run could not be continued.'); }
  }

  function changePanels(panels: ArtworkPanel[]) {
    if (!draft || !panels.length) return;
    const numbered = panels.map((panel, index) => ({ ...panel, number: index + 1 }));
    setDraft(customArtwork(draft, { panels: numbered, texture: numbered[0].texture, calibration: { ...draft.calibration, widthMm: numbered[0].widthMm, heightMm: numbered[0].heightMm, proofAccepted: false } }));
    setRightsConfirmed(false);
  }
  function updateAppearance(patch: ArtworkFinish['appearance']) {
    if (!selectedFinish || (selectedFinish.type !== 'wallpaper' && selectedFinish.type !== 'mural')) return;
    if (!commit(saveFinish(project, customArtwork(selectedFinish, { appearance: patch })))) return;
    say('Illustrative material response saved. Test a physical sample for the actual surface.');
  }

  return <section className="studio-finish-panel" aria-labelledby={`${uid}-title`}>
    <h3 id={`${uid}-title`}>Choose your finish</h3>
    <div className="studio-button-row" role="group" aria-label="Finish type">
      <button type="button" className={action(tab === 'paint' ? 'primary' : 'secondary')} aria-pressed={tab === 'paint'} onClick={() => setTab('paint')}>Paint</button>
      <button type="button" className={action(tab === 'artwork' ? 'primary' : 'secondary')} aria-pressed={tab === 'artwork'} onClick={() => setTab('artwork')}>Wallpaper / mural</button>
      <button type="button" className={action(tab === 'bauwerk' ? 'primary' : 'secondary')} aria-pressed={tab === 'bauwerk'} onClick={() => setTab('bauwerk')}>Bauwerk limewash</button>
    </div>

    <details><summary>Try an original catalogue design</summary><p className="studio-help">Rights-cleared original studies. Manufacturer designs become available after approved source files and specifications are supplied.</p>{catalogueProducts.map(product => <button key={`${product.productId}-${product.version}`} type="button" className={action()} onClick={() => { const finish = selectCatalogueFinish(product.productId, product.version, id()); if (!commit(saveFinish(project, finish))) return; setFinishId(finish.id); say(`${finish.name} selected from catalogue version ${product.version}.`); }}>{(product.finish.type === 'wallpaper' || product.finish.type === 'mural') && <img src={product.finish.texture.dataUrl} width={56} height={56} alt="" style={{ objectFit: 'cover', borderRadius: 4, marginRight: 8 }} />}{product.name}</button>)}</details>

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
      <label className="studio-field">Artwork type<select value={artworkType} onChange={event => { const type = event.target.value as ArtworkFinish['type']; setArtworkType(type); setPanelMode(false); setDraft(null); }}><option value="wallpaper">Repeating wallpaper</option><option value="mural">Single mural</option></select></label>
      {artworkType === 'mural' && <label className="studio-check"><input type="checkbox" checked={panelMode} onChange={event => { setPanelMode(event.target.checked); setDraft(null); }} />Upload a finite numbered panel sequence</label>}
      <label className="studio-field">Upload your artwork<input type="file" accept="image/png,image/jpeg,image/webp" multiple={panelMode} disabled={reading} onChange={event => { void upload(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
      <p className="studio-help">PNG, JPEG or WebP, up to 20 MB. Upload the design you may use, without room photography or sample-card borders. Files stay in this project.</p>
      {reading && <p role="status">Reading artwork…</p>}
      {draft && <fieldset className="studio-artwork-calibration"><legend>Calibrate {draft.type === 'mural' ? 'the mural' : 'the repeat'}</legend>
        <label className="studio-field">Artwork name<input value={draft.name} maxLength={100} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        {!draft.panels?.length && <><label className="studio-field">Orientation<select value={draft.calibration.rotation} onChange={event => updateCalibration({ rotation: Number(event.target.value) as ArtworkCalibration['rotation'] })}>{[0, 90, 180, 270].map(rotation => <option key={rotation} value={rotation}>{rotation}° clockwise</option>)}</select></label>
        <p className="studio-help">Crop the original image first. Dimensions below describe that selected crop after rotation.</p>
        {safeDraftImage && <figure className="studio-crop-source"><svg viewBox={`0 0 ${draft.texture.widthPx} ${draft.texture.heightPx}`} role="img" aria-label="Original artwork with selected crop outlined"><image href={draft.texture.dataUrl} width={draft.texture.widthPx} height={draft.texture.heightPx} /><rect x={draft.calibration.crop.x * draft.texture.widthPx} y={draft.calibration.crop.y * draft.texture.heightPx} width={draft.calibration.crop.width * draft.texture.widthPx} height={draft.calibration.crop.height * draft.texture.heightPx} fill="none" stroke="#fff" strokeWidth={Math.max(draft.texture.widthPx, draft.texture.heightPx) / 100} /><rect x={draft.calibration.crop.x * draft.texture.widthPx} y={draft.calibration.crop.y * draft.texture.heightPx} width={draft.calibration.crop.width * draft.texture.widthPx} height={draft.calibration.crop.height * draft.texture.heightPx} fill="none" stroke="#26352a" strokeWidth={Math.max(draft.texture.widthPx, draft.texture.heightPx) / 220} /></svg><figcaption>Original image; outlined area becomes the selected crop.</figcaption></figure>}
        <div className="studio-row">{(['x', 'y', 'width', 'height'] as const).map(key => <label className="studio-field" key={key}>{({ x: 'Crop left', y: 'Crop top', width: 'Crop width', height: 'Crop height' })[key]} (%)<input type="number" min={key === 'x' || key === 'y' ? 0 : .1} max={100} step={.1} value={Math.round(draft.calibration.crop[key] * 1000) / 10} onChange={event => updateCrop(key, Number(event.target.value))} /></label>)}</div>
        <div className="studio-row"><label className="studio-field">Real width (mm)<input type="number" min={1} max={30000} step={.1} value={draft.calibration.widthMm} onChange={event => updateCalibration({ widthMm: Number(event.target.value) })} /></label><label className="studio-field">Real height (mm)<input type="number" min={1} max={30000} step={.1} value={draft.calibration.heightMm} onChange={event => updateCalibration({ heightMm: Number(event.target.value) })} /></label></div>
        </>}
        {draft.panels?.length ? <div className="studio-panels"><p className="studio-help">Panels are finite and placed left to right in numbered order. Set the real size of each full panel; proportions stay linked. Add enough artwork for the selected wall run.</p>{draft.panels.map((panel, index) => <fieldset key={panel.id}><legend>Panel {panel.number}</legend><img src={panel.texture.dataUrl} width={80} height={100} style={{ objectFit: 'contain' }} alt={`Panel ${panel.number} artwork`} /><div className="studio-row">{(['widthMm', 'heightMm'] as const).map(key => <label key={key} className="studio-field">{key === 'widthMm' ? 'Real width (mm)' : 'Real height (mm)'}<input type="number" min={1} max={30000} step={.1} value={panel[key]} onChange={event => { const value = Number(event.target.value), size = key === 'widthMm' ? { widthMm: value, heightMm: Math.round(value * panel.texture.heightPx / panel.texture.widthPx * 10) / 10 } : { heightMm: value, widthMm: Math.round(value * panel.texture.widthPx / panel.texture.heightPx * 10) / 10 }; changePanels(draft.panels!.map((item, offset) => offset === index ? { ...item, ...size } : item)); }} /></label>)}</div><div className="studio-button-row"><button type="button" className={action()} disabled={index === 0} onClick={() => { const next = [...draft.panels!]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; changePanels(next); }}>Move panel earlier</button><button type="button" className={action('quiet')} disabled={draft.panels!.length === 1} onClick={() => changePanels(draft.panels!.filter(item => item.id !== panel.id))}>Remove panel</button></div></fieldset>)}</div> : null}
        {sourceDetail && <div className="studio-source-detail" aria-label="Artwork source detail">
          <p className="studio-help">Selected crop: {sourceDetail.width} × {sourceDetail.height} pixels over {draft.calibration.widthMm} × {draft.calibration.heightMm} mm ({Math.round(sourceDetail.width * 1000 / draft.calibration.widthMm)} × {Math.round(sourceDetail.height * 1000 / draft.calibration.heightMm)} pixels per metre).</p>
          {(sourceDetail.width < 1024 || sourceDetail.height < 1024) && <p className="studio-notice">Below our 1,024-pixel detail guide on at least one side. A larger original may look clearer in close views. This is an illustrative guide, not a print-quality assessment.</p>}
          <p className="studio-help">Final stills are 1920 × 1080 pixels and the panorama is 4096 × 2048 pixels. Larger exports cannot restore detail missing from the original artwork.</p>
        </div>}
        {draft.type === 'mural' && !draft.panels?.length && <p className="studio-help">Mural proportions stay linked to the selected crop. Change either real dimension to resize it; orientation swaps width and height.</p>}
        {draft.type === 'wallpaper' && <>
          <label className="studio-field">Image represents<select value={draft.calibration.repeatKind} onChange={event => updateCalibration({ repeatKind: event.target.value as ArtworkCalibration['repeatKind'] })}><option value="tile">A complete seamless repeat tile</option><option value="strip">One wallpaper strip / repeat</option></select></label>
          <label className="studio-field">Pattern match<select value={draft.calibration.match} onChange={event => updateCalibration({ match: event.target.value as ArtworkCalibration['match'] })}><option value="straight">Straight / free match</option><option value="half-drop">Half-drop</option></select></label>
          {draft.calibration.match === 'half-drop' && <label className="studio-check"><input type="checkbox" checked={draft.calibration.offsetAlreadyIncluded} onChange={event => updateCalibration({ offsetAlreadyIncluded: event.target.checked })} />The stagger is already included in this artwork tile</label>}
          {draft.calibration.match === 'half-drop' && draft.calibration.repeatKind === 'tile' && !draft.calibration.offsetAlreadyIncluded && <p className="studio-help">For a single strip needing alternate drops, select “One wallpaper strip”. A complete seamless tile repeats as supplied.</p>}
        </>}
        {calibrationErrors(draft.calibration).map(text => <p className="studio-error" key={text}>{text}</p>)}
        {proofLoading && <p role="status">Preparing the pattern proof…</p>}
        {proof && <figure className="studio-repeat-proof"><img src={proof} width={720} height={420} alt={draft.type === 'mural' ? `Cropped and rotated proof of ${draft.name}` : `Four strips of ${draft.name}, showing the selected repeat and alternate drop`} /><figcaption>{draft.type === 'mural' ? draft.panels?.length ? 'Finite numbered panel proof' : 'Mural artwork proof' : 'Repeat proof: four widths; dashed lines mark strip boundaries'}. Selected artwork: {draft.calibration.widthMm} × {draft.calibration.heightMm} mm. Check direction, scale and joins.</figcaption></figure>}
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
      {selectedFinish?.catalogue && <p className="studio-help">Catalogue {selectedFinish.catalogue.productId}, version {selectedFinish.catalogue.version}. {selectedFinish.catalogue.verification === 'custom' ? 'Custom finish: product parameters have been edited.' : 'Approved original source and calibration.'}</p>}
      {selectedFinish && !project.assignments.some(a => a.finishId === selectedFinish.id) && !project.schemes.some(scheme => scheme.finishes.some(f => f.id === selectedFinish.id)) && <button type="button" className={action('quiet')} onClick={() => { if (!commit({ ...project, finishes: project.finishes.filter(f => f.id !== selectedFinish.id) })) return; setFinishId(''); say('Unused finish removed.'); }}>Remove unused finish</button>}
      {selectedFinish?.type === 'bauwerk' && (isBauwerkProductUrl(selectedFinish.productUrl) ? <p><a href={selectedFinish.productUrl} target="_blank" rel="noreferrer">{selectedFinish.name}: product and physical samples ↗</a></p> : <p className="studio-error" role="status">This saved shade has an invalid product link. Select its shade from the verified Bauwerk palette to replace it.</p>)}
      {(selectedFinish?.type === 'wallpaper' || selectedFinish?.type === 'mural') && <button type="button" className={action('quiet')} onClick={() => { setTab('artwork'); setDraft(customArtwork(selectedFinish, { calibration: selectedFinish.type === 'mural' ? proportionalMuralCalibration(selectedFinish.texture, selectedFinish.calibration) : { ...selectedFinish.calibration, crop: { ...selectedFinish.calibration.crop }, proofAccepted: false } })); setRightsConfirmed(false); setPanelMode(Boolean(selectedFinish.panels?.length)); setArtworkType(selectedFinish.type); }}>Edit crop and repeat proof</button>}
      <p>{wallIndex >= 0 ? `Selected: wall ${wallIndex + 1}. Select another wall in the plan.` : 'Select a wall in the plan.'}</p>
      <label className="studio-field">Wall selection<select value={application} onChange={event => { const next = event.target.value as typeof application; setApplication(next); setAllWalls(next === 'whole'); }}><option value="feature">Feature wall · selected in plan</option><option value="selected">Selected walls</option><option value="whole">Whole room</option></select></label>
      {application === 'selected' && <fieldset><legend>Choose walls</legend>{project.room.vertices.map((vertex, index) => <label key={vertex.wallId} className="studio-check"><input type="checkbox" checked={chosenWalls.includes(vertex.wallId)} onChange={event => setChosenWalls(event.target.checked ? [...chosenWalls, vertex.wallId] : chosenWalls.filter(value => value !== vertex.wallId))} />Wall {index + 1}</label>)}<p className="studio-help">Finite panel sequences need adjoining walls in surveyed order, starting at the wall selected in the plan.</p></fieldset>}
      <label className="studio-check"><input type="checkbox" checked={allWalls} onChange={event => { setAllWalls(event.target.checked); setApplication(event.target.checked ? 'whole' : 'feature'); }} />Apply to all walls</label>
      <label className="studio-check"><input type="checkbox" checked={band} onChange={event => setBand(event.target.checked)} />Apply within a horizontal band</label>
      {band && <div className="studio-row"><label className="studio-field">Band bottom above floor (mm)<input type="number" min={0} max={project.room.heightMm} value={from} onChange={event => setFrom(Number(event.target.value))} /></label><label className="studio-field">Band top above floor (mm)<input type="number" min={1} max={project.room.heightMm} value={to} onChange={event => setTo(Number(event.target.value))} /></label></div>}
      {(selectedFinish?.type === 'wallpaper' || selectedFinish?.type === 'mural') && <>
        <div className="studio-row"><label className="studio-field">Horizontal start from wall left (mm)<input type="number" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label><label className="studio-field">Vertical start above floor (mm)<input type="number" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label></div>
        <button type="button" className={action('secondary')} disabled={wallIndex < 0 || allWalls} onClick={centre}>Centre artwork on selected wall</button>
        {selectedFinish.type === 'wallpaper' && <><button type="button" className={action('secondary')} disabled={wallIndex < 0 || !project.assignments.some(assignment => assignment.wallId === selectedWallId && assignment.finishId === selectedFinish.id)} onClick={continuePattern}>Continue pattern around corners</button><p className="studio-help">Starts from this wall’s saved placement and links adjoining walls already using the same wallpaper and height band.</p></>}
      </>}
      {(selectedFinish?.type === 'wallpaper' || selectedFinish?.type === 'mural') && <fieldset><legend>Illustrative material response</legend><p className="studio-help">These controls illustrate reflection and depth. They are not manufacturer measurements. Changing a catalogue material saves a custom finish.</p><div className="studio-button-row">{Object.entries(APPEARANCE_PRESETS).map(([key, value]) => <button key={key} type="button" className={action()} onClick={() => updateAppearance(structuredClone(value))}>{key.charAt(0).toUpperCase() + key.slice(1)}</button>)}</div><details><summary>Advanced material controls</summary><div className="studio-row">{(['roughness', 'metalness'] as const).map(key => <label key={key} className="studio-field">{key === 'roughness' ? 'Roughness' : 'Metallic response'}<input type="number" min={0} max={1} step={.05} value={selectedFinish.appearance?.[key] ?? (key === 'roughness' ? .88 : 0)} onChange={event => updateAppearance({ roughness: selectedFinish.appearance?.roughness ?? .88, metalness: selectedFinish.appearance?.metalness ?? 0, ...selectedFinish.appearance, [key]: Math.max(0, Math.min(1, Number(event.target.value))) })} /></label>)}</div><label className="studio-field">Raised profile<select value={selectedFinish.appearance?.relief?.kind ?? 'none'} onChange={event => { const { relief, ...appearance } = selectedFinish.appearance ?? { roughness: .88, metalness: 0 }; updateAppearance({ ...appearance, ...(event.target.value === 'none' ? {} : { relief: { kind: event.target.value as 'coffered' | 'faceted', depthMm: 6, columns: 4, rows: 4 } }) }); }}><option value="none">Flat</option><option value="coffered">Coffered</option><option value="faceted">Faceted</option></select></label>{selectedFinish.appearance?.relief && <div className="studio-row">{(['depthMm', 'columns', 'rows'] as const).map(key => <label className="studio-field" key={key}>{({ depthMm: 'Depth (mm)', columns: 'Columns per artwork width', rows: 'Rows per artwork height' })[key]}<input type="number" min={key === 'depthMm' ? .1 : 1} max={key === 'depthMm' ? 20 : 24} step={key === 'depthMm' ? .1 : 1} value={selectedFinish.appearance!.relief![key]} onChange={event => { const value = Number(event.target.value), next = key === 'depthMm' ? Math.round(Math.max(.1, Math.min(20, value)) * 10) / 10 : Math.round(Math.max(1, Math.min(24, value))); updateAppearance({ ...selectedFinish.appearance!, relief: { ...selectedFinish.appearance!.relief!, [key]: next } }); }} /></label>)}</div>}</details></fieldset>}
      <button type="button" className={action('primary')} disabled={!selectedFinish || (!allWalls && wallIndex < 0)} onClick={apply}>Apply finish</button>
    </fieldset>
    {coverage.length > 0 && <div className="studio-notice" role="status"><strong>Artwork coverage needs attention before rendering</strong>{coverage.map((issue, index) => <p key={index}>{issue.message}</p>)}</div>}
    {detailWarnings.length > 0 && <details><summary>Artwork detail guidance</summary>{detailWarnings.map((issue, index) => <p key={index} className="studio-help">{issue.message}</p>)}</details>}
    {error && <p className="studio-error" role="alert">{error}</p>}
    {message && <p className="studio-status" role="status">{message}</p>}
  </section>;
}
