/** Serializes local writes and erasure. A pending timer or an already running
 * write must never recreate a photograph after the customer has deleted it. */
export class PhotoDraftAutosave<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sequence: Promise<void> = Promise.resolve();
  private generation = 0;
  private deletion: Promise<void> | null = null;
  private disposed = false;
  private readonly write: (value: T) => Promise<unknown>;
  private readonly remove: () => Promise<unknown>;
  private readonly delayMs: number;
  constructor(write: (value: T) => Promise<unknown>, remove: () => Promise<unknown>, delayMs = 600) { this.write = write; this.remove = remove; this.delayMs = delayMs; }
  get deleting() { return this.deletion !== null; }
  cancelPending() { this.generation++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
  schedule(value: T, onSaved: () => void, onError: (error: unknown) => void): boolean {
    if (this.disposed || this.deleting) return false;
    this.cancelPending(); const generation = this.generation;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sequence = this.sequence.then(async () => {
        if (this.disposed || this.deleting || generation !== this.generation) return;
        await this.write(value);
        if (!this.disposed && !this.deleting && generation === this.generation) onSaved();
      }).catch(error => { if (!this.disposed && !this.deleting && generation === this.generation) onError(error); });
    }, this.delayMs);
    return true;
  }
  delete(): Promise<void> {
    if (this.deletion) return this.deletion;
    this.cancelPending();
    // Set the gate synchronously, before yielding to an IndexedDB open or any
    // other asynchronous operation. Existing queued writes check this gate.
    this.deletion = this.sequence.then(async () => { await this.remove(); }).finally(() => { this.deletion = null; });
    return this.deletion;
  }
  dispose() { this.disposed = true; this.cancelPending(); }
}
