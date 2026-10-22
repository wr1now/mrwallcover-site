import { useEffect, useState } from 'react';
import { artworkProofDataUrl, calibrationErrors, normaliseHex, proportionalMuralCalibration, readArtworkFile } from '../finishes.ts';
import { bauwerkCatalogue, bauwerkFamilies, findBauwerkShades } from '../catalogue/index.ts';
import type { ArtworkCalibration, ArtworkFinish, FinishAsset } from '../types.ts';
import { catalogueProducts, selectCatalogueFinish } from '../catalogue-products.ts';
const action = (primary = false) => `mw-action mw-action--${primary ? 'primary' : 'secondary'}`;
export default function PhotoFinishPicker({ finishes, selectedId, removableIds, onSave, onSelect, onRemove }: { finishes: FinishAsset[]; selectedId: string | null; removableIds: string[]; onSave: (finish: FinishAsset) => boolean; onSelect: (id: string | null) => void; onRemove: (id: string) => void }) {
  const [tab, setTab] = useState<'wallpaper' | 'paint' | 'bauwerk'>('wallpaper'), [draft, setDraft] = useState<ArtworkFinish | null>(null), [proof, setProof] = useState(''), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [paint, setPaint] = useState('#C6BDA8'), [paintName, setPaintName] = useState('Warm stone'), [query, setQuery] = useState(''), [family, setFamily] = useState('');
  const [shadeLimit, setShadeLimit] = useState(30);
  useEffect(() => setShadeLimit(30), [query, family]);
  useEffect(() => { let live = true; setProof(''); if (draft && !calibrationErrors(draft.calibration).length) void artworkProofDataUrl(draft).then(value => { if (live) setProof(value); }).catch(reason => { if (live) setError(reason.message); }); return () => { live = false; }; }, [draft]);
  function patch(change: Partial<ArtworkCalibration>) {
    if (!draft) return; setConsent(false); setError('');
    setDraft({ ...draft, calibration: draft.type === 'mural' ? proportionalMuralCalibration(draft.texture, draft.calibration, change) : { ...draft.calibration, ...change, proofAccepted: false } });
  }
  async function upload(file?: File) {
    if (!file) return; setBusy(true); setError(''); setConsent(false);
    try { const texture = await readArtworkFile(file); setDraft({ id: crypto.randomUUID(), type: 'wallpaper', name: file.name.replace(/\.[^.]+$/, '').slice(0, 100), texture, calibration: { widthMm: 520, heightMm: 640, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'tile', match: 'straight', offsetAlreadyIncluded: false, proofAccepted: false } }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The artwork could not be read.'); } finally { setBusy(false); }
  }
  async function original(index: number) {
    setBusy(true); setError(''); try { const { createExampleProject } = await import('../examples.ts'); const ids = ['willow-chimney', 'ochre-lshape', 'indigo-bay'] as const; const finish = createExampleProject(ids[index]).finishes.find(f => f.type === 'wallpaper')!; onSave(finish); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Example artwork unavailable.'); } finally { setBusy(false); }
  }
  const shades = findBauwerkShades(query, family);
  return <div className="photo-finish-picker">
    <label className="photo-field">Selected finish<select value={selectedId || ''} onChange={e => onSelect(e.target.value || null)}><option value="">Original wall photograph</option>{finishes.map(f => <option value={f.id} key={f.id}>{f.name} · {f.type}</option>)}</select></label>
    {finishes.length > 0 && <details className="photo-disclosure"><summary>Manage saved finishes ({finishes.length}/48)</summary><p className="photo-help">Remove finishes that are unused by every wall and saved comparison to free space. Select “Original wall photograph” to remove a finish from the selected wall.</p><div className="photo-finish-manager">{finishes.map(f => <div key={f.id}><span>{f.name}</span><button type="button" className={action()} disabled={!removableIds.includes(f.id)} aria-label={`Remove unused finish ${f.name}`} onClick={() => onRemove(f.id)}>Remove</button>{!removableIds.includes(f.id) && <small>Used by a wall or saved comparison</small>}</div>)}</div></details>}
    <div className="photo-button-row" role="group" aria-label="Add a finish">{(['wallpaper', 'paint', 'bauwerk'] as const).map(value => <button type="button" key={value} className={action(tab === value)} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'wallpaper' ? 'Wallpaper' : value === 'bauwerk' ? 'Bauwerk' : 'Paint'}</button>)}</div>
    {tab === 'wallpaper' && <>
      <label className="photo-upload">Upload wallpaper or mural<input data-photo-artwork type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <p className="photo-help">Upload artwork you may use, without sample-card borders. PNG, JPEG or WebP; up to 20 MB and 25 megapixels.</p>
      <details className="photo-disclosure"><summary>Approved catalogue</summary>{catalogueProducts.map(product => <div key={`${product.productId}-${product.version}`}><p className="photo-help">{product.provenance}</p><button type="button" className={action()} onClick={() => onSave(selectCatalogueFinish(product.productId, product.version, crypto.randomUUID()))}>Use {product.name}</button></div>)}</details>
      <details className="photo-disclosure"><summary>Try original example patterns</summary><p className="photo-help">Original illustrative designs with calibrated repeats; no manufacturer association.</p><div className="photo-example-patterns">{['Willow botanical', 'Ochre weave', 'Indigo geometry'].map((name, index) => <button type="button" className={action()} key={name} disabled={busy} onClick={() => void original(index)}>{name}</button>)}</div></details>
      {draft && <fieldset><legend>Check the artwork proof</legend>
        <label className="photo-field">Design name<input value={draft.name} maxLength={100} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="photo-field">Artwork type<select value={draft.type} onChange={e => { const type = e.target.value as ArtworkFinish['type']; setDraft({ ...draft, type, calibration: type === 'mural' ? proportionalMuralCalibration(draft.texture, draft.calibration) : { ...draft.calibration, proofAccepted: false } }); setConsent(false); }}><option value="wallpaper">Repeating wallpaper</option><option value="mural">Finite mural</option></select></label>
        <label className="photo-field">Orientation<select value={draft.calibration.rotation} onChange={e => patch({ rotation: Number(e.target.value) as ArtworkCalibration['rotation'] })}>{[0, 90, 180, 270].map(value => <option value={value} key={value}>{value}° clockwise</option>)}</select></label>
        <details className="photo-disclosure"><summary>Crop sample-card borders</summary><div className="photo-two-col">{(['x', 'y', 'width', 'height'] as const).map(key => <label className="photo-field" key={key}>Crop {key === 'x' ? 'left' : key === 'y' ? 'top' : key} (%)<input type="number" min={key === 'x' || key === 'y' ? 0 : .1} max={100} step={.1} value={Math.round(draft.calibration.crop[key] * 1000) / 10} onChange={e => patch({ crop: { ...draft.calibration.crop, [key]: Number(e.target.value) / 100 } })} /></label>)}</div></details>
        <div className="photo-two-col"><label className="photo-field">Artwork width (mm)<input type="number" min={1} max={30000} step={.1} value={draft.calibration.widthMm} onChange={e => patch({ widthMm: Number(e.target.value) })} /></label><label className="photo-field">Artwork height (mm)<input type="number" min={1} max={30000} step={.1} value={draft.calibration.heightMm} onChange={e => patch({ heightMm: Number(e.target.value) })} /></label></div>
        {draft.type === 'mural' ? <p className="photo-help">Finite artwork keeps its proportions. Areas beyond it retain the original wall; it is never repeated.</p> : <>
          <label className="photo-field">Image represents<select value={draft.calibration.repeatKind} onChange={e => patch({ repeatKind: e.target.value as ArtworkCalibration['repeatKind'] })}><option value="tile">Complete seamless repeat tile</option><option value="strip">Single strip repeat</option></select></label>
          <label className="photo-field">Pattern match<select value={draft.calibration.match} onChange={e => patch({ match: e.target.value as ArtworkCalibration['match'] })}><option value="straight">Straight match</option><option value="half-drop">Half-drop</option></select></label>
          {draft.calibration.match === 'half-drop' && <label className="photo-check"><input type="checkbox" checked={draft.calibration.offsetAlreadyIncluded} onChange={e => patch({ offsetAlreadyIncluded: e.target.checked })} />Artwork already includes the offset</label>}
        </>}
        {calibrationErrors(draft.calibration).map(message => <p className="photo-error" key={message}>{message}</p>)}
        {proof && <figure className="photo-proof"><img src={proof} width={720} height={420} alt={`Crop and repeat proof of ${draft.name}`} /><figcaption>{draft.type === 'mural' ? 'Finite mural' : 'Four-width repeat'} proof. Check the size, direction and joins.</figcaption></figure>}
        <label className="photo-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I may use this artwork and have checked its physical dimensions and repeat proof.</label>
        <button type="button" className={action(true)} disabled={!consent || !proof || !!calibrationErrors(draft.calibration).length} onClick={() => { if (onSave({ ...draft, calibration: { ...draft.calibration, proofAccepted: true } })) { setDraft(null); setConsent(false); } }}>Accept proof and use finish</button>
      </fieldset>}
    </>}
    {tab === 'paint' && <>
      <label className="photo-field">Paint name<input value={paintName} maxLength={100} onChange={e => setPaintName(e.target.value)} /></label><div className="photo-two-col"><label className="photo-field">Colour<input type="color" value={normaliseHex(paint) || '#C6BDA8'} onChange={e => setPaint(e.target.value.toUpperCase())} /></label><label className="photo-field">HEX<input value={paint} maxLength={7} onChange={e => setPaint(e.target.value)} /></label></div>
      <button type="button" className={action(true)} disabled={!normaliseHex(paint)} onClick={() => onSave({ id: crypto.randomUUID(), type: 'paint', name: paintName.trim() || paint, colour: normaliseHex(paint)!, sheen: 'matte' })}>Use paint colour</button><p className="photo-help">Digital colour and lighting are approximate. Check a physical sample.</p>
    </>}
    {tab === 'bauwerk' && <>
      <label className="photo-field">Find a Bauwerk shade<input type="search" placeholder="Bone, Olive, Paprika…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="photo-field">Colour family<select value={family} onChange={e => setFamily(e.target.value)}><option value="">All families</option>{bauwerkFamilies.map(f => <option value={f} key={f}>{f}</option>)}</select></label>
      <p className="photo-help">{shades.length} matching shades; showing {Math.min(shadeLimit, shades.length)}. Refine the name or family, or show more below.</p><div className="photo-shades">{shades.slice(0, shadeLimit).map(shade => <button type="button" key={shade.id} className="photo-shade" onClick={() => onSave({ id: `bauwerk-${shade.id}`, type: 'bauwerk', name: shade.name, colour: shade.colour, shadeId: shade.id, catalogueVersion: bauwerkCatalogue.version, productUrl: shade.productUrl, colourProvenance: 'manufacturer', seed: Number(shade.id.slice(-8)) })}><span style={{ backgroundColor: shade.colour }} />{shade.name}</button>)}</div>{shadeLimit < shades.length && <button type="button" className={action()} onClick={() => setShadeLimit(shadeLimit + 30)}>Show more Bauwerk shades</button>}<p className="photo-help">Colour and limewash movement are approximate. Test a sample in your room before ordering. <a href={bauwerkCatalogue.collectionUrl} target="_blank" rel="noreferrer">Bauwerk UK samples</a></p>
    </>}
    {busy && <p role="status">Preparing artwork…</p>}{error && <p className="photo-error" role="alert">{error}</p>}
  </div>;
}
