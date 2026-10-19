import { lazy, Suspense, useEffect, useState } from 'react';
import RoomStudio from './RoomStudio.tsx';
import './studio.css';

const PhotoStudio = lazy(() => import('./components/PhotoStudio.tsx'));

/** Keep each editor mounted after first use so switching never discards a draft. */
export default function RoomStudioApp() {
  const [mode, setMode] = useState<'photo' | 'room'>('room');
  const [photoOpened, setPhotoOpened] = useState(false);
  function choose(next: 'photo' | 'room') {
    if (next === 'photo') setPhotoOpened(true);
    setMode(next);
  }
  useEffect(() => {
    const pick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-studio-mode], [data-room-example]') : null;
      if (!target) return;
      const next = target.hasAttribute('data-room-example') ? 'room' : target.dataset.studioMode;
      if (next !== 'photo' && next !== 'room') return;
      choose(next);
    };
    document.addEventListener('click', pick);
    return () => document.removeEventListener('click', pick);
  }, []);
  return <div className="studio-app" data-studio-mode-active={mode}>
    <div className="studio-start-options" role="group" aria-label="Choose how to preview your finishes">
      <button className="studio-start-option" type="button" aria-pressed={mode === 'photo'} aria-controls="studio-photo-editor" onClick={() => choose('photo')}>
        <span className="eyebrow">01 / Your photograph</span>
        <strong>View in your room</strong>
        <span>Mark your walls, try finishes and download a free photo preview.</span>
        <span className="studio-option-link">{mode === 'photo' ? 'Photo preview selected' : 'Start with a photo'} <span aria-hidden="true">↗</span></span>
      </button>
      <button className="studio-start-option" type="button" aria-pressed={mode === 'room'} aria-controls="studio-measured-editor" onClick={() => choose('room')}>
        <span className="eyebrow">02 / Your measurements</span>
        <strong>Build your room in 3D</strong>
        <span>Set the layout, place openings and explore a measured room.</span>
        <span className="studio-option-link">{mode === 'room' ? 'Measured room selected' : 'Start with measurements'} <span aria-hidden="true">↗</span></span>
      </button>
    </div>
    <div id="studio-photo-editor" hidden={mode !== 'photo'}>
      {photoOpened && <Suspense fallback={<p className="studio-page-loading" role="status">Opening your photo workspace…</p>}><PhotoStudio onReturnTo3D={() => choose('room')} /></Suspense>}
    </div>
    <div id="studio-measured-editor" hidden={mode !== 'room'}><RoomStudio /></div>
  </div>;
}
