/** Derived audio is valid only for the exact audio-edit revision that produced it. */
export class RenderRevision {
  private revision = 0;
  invalidate(): void { this.revision++; }
  capture(): number { return this.revision; }
  isCurrent(token: number): boolean { return token === this.revision; }
}
