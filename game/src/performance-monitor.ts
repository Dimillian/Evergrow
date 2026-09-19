import './performance-monitor.css';
import { FRAME_CAPACITY, FRAME_STRIDE, FrameProfiler, frameValue } from './frame-profiler.ts';
import { PERFORMANCE_GRAPHS, summarizeFrames } from './performance-graphs.ts';
import { GAME_FONT_STACK } from './font.ts';

interface MonitorOptions {
  continuous: boolean; releaseInput(): void; returnFocus(): void; isToggle(event: KeyboardEvent): boolean;
}

/** Nonmodal diagnostics. Owns presentation and capture controls, never gameplay or saves. */
export class PerformanceMonitor {
  readonly element = document.createElement('section');
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private selector: HTMLSelectElement;
  private legend: HTMLElement;
  private note: HTMLElement;
  private status: HTMLElement;
  private range: HTMLElement;
  private freezeButton: HTMLButtonElement;
  private values: HTMLElement[];
  private abort = new AbortController();
  private samples = new Float64Array(FRAME_CAPACITY * FRAME_STRIDE);
  private count = 0;
  private nextDraw = 0;
  private nextSummary = 0;
  private open = false;
  private frozen = false;
  private available = true;
  private phase = 'playing';
  private capturePhase = 'playing';
  private capture: ReturnType<FrameProfiler['snapshot']> | null = null;
  private profiler: FrameProfiler;
  private options: MonitorOptions;
  constructor(profiler: FrameProfiler, root: HTMLElement, options: MonitorOptions) {
    this.profiler = profiler; this.options = options;
    this.element.className = 'ui-window performance-monitor';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Gameplay performance monitor');
    this.element.innerHTML = `<header class="performance-heading"><h2>Performance</h2><span class="performance-state">LIVE</span><button type="button" class="ui-button performance-close" aria-label="Close performance monitor">×</button></header>
      <div class="performance-summary">${['FPS', 'P95 ms', 'P99 ms', '>50 ms'].map(label => `<div><strong>—</strong><span>${label}</span></div>`).join('')}</div>
      <label class="performance-select">Graph<select aria-label="Performance graph">${PERFORMANCE_GRAPHS.map(graph => `<option value="${graph.id}">${graph.label}</option>`).join('')}</select></label>
      <canvas class="performance-chart" role="img" aria-label="Live performance history"></canvas>
      <div class="performance-range"></div><div class="performance-legend"></div><p class="performance-note"></p>
      <footer class="performance-actions"><button type="button" class="ui-button" data-action="freeze" aria-pressed="false" title="Freeze the display; gameplay continues">Freeze</button><button type="button" class="ui-button" data-action="reset">Reset</button><button type="button" class="ui-button" data-action="export">Export JSON</button></footer>`;
    const find = <T extends HTMLElement>(query: string) => this.element.querySelector<T>(query)!;
    this.canvas = find<HTMLCanvasElement>('canvas');
    this.context = this.canvas.getContext('2d')!;
    this.selector = find<HTMLSelectElement>('select');
    this.legend = find('.performance-legend'); this.note = find('.performance-note');
    this.status = find('.performance-state'); this.range = find('.performance-range');
    this.freezeButton = find<HTMLButtonElement>('[data-action="freeze"]');
    this.values = [...this.element.querySelectorAll<HTMLElement>('.performance-summary strong')];
    const signal = this.abort.signal;
    find('.performance-close').addEventListener('click', () => this.setOpen(false), { signal });
    this.selector.addEventListener('change', () => { this.nextDraw = 0; this.draw(); }, { signal });
    this.freezeButton.addEventListener('click', () => {
      this.frozen = !this.frozen;
      if (this.frozen) { this.count = this.profiler.copySamples(this.samples); this.capture = this.profiler.snapshot(); this.capturePhase = this.phase; }
      else this.capture = null;
      this.refreshFreeze(); this.nextDraw = this.nextSummary = 0; this.draw();
    }, { signal });
    find('[data-action="reset"]').addEventListener('click', () => {
      this.profiler.reset(); this.capture = null; this.frozen = false; this.count = 0;
      this.refreshFreeze(); this.nextDraw = this.nextSummary = 0; this.draw();
    }, { signal });
    find('[data-action="export"]').addEventListener('click', () => this.export(), { signal });
    // Controls never latch attacks, movement, menu shortcuts or wheel zoom behind the panel.
    this.element.addEventListener('pointerdown', () => options.releaseInput(), { signal });
    this.element.addEventListener('pointerenter', () => options.releaseInput(), { signal });
    this.element.addEventListener('focusin', () => options.releaseInput(), { signal });
    this.element.addEventListener('wheel', event => event.stopPropagation(), { signal, passive: true });
    this.element.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (options.isToggle(event) || event.code === 'Escape') {
        event.preventDefault(); if (!event.repeat) this.setOpen(false);
      }
    }, { signal });
    root.append(this.element);
  }
  get bounds() { return this.element.hidden ? null : this.element.getBoundingClientRect(); }
  get isOpen() { return this.open; }
  contains(target: EventTarget | null) { return target instanceof Node && this.element.contains(target); }
  setOpen(open: boolean, restoreFocus = true) {
    this.open = open;
    this.element.hidden = !open || !this.available;
    this.profiler.setEnabled(open || this.options.continuous);
    this.frozen = false; this.capture = null; this.count = 0; this.refreshFreeze();
    this.nextDraw = this.nextSummary = 0;
    if (!open && restoreFocus) this.options.returnFocus();
  }
  update(now: number, phase: string) {
    this.available = phase !== 'ready'; this.phase = phase;
    if (!this.available && this.open) this.setOpen(false, false);
    const hidden = !this.open || !this.available;
    if (this.element.hidden !== hidden) this.element.hidden = hidden;
    if (this.element.hidden || now < this.nextDraw) return;
    this.nextDraw = now + 100;
    if (!this.frozen) this.count = this.profiler.copySamples(this.samples);
    this.draw(now >= this.nextSummary);
    if (now >= this.nextSummary) this.nextSummary = now + 500;
  }
  private refreshFreeze() {
    this.freezeButton.textContent = this.frozen ? 'Resume' : 'Freeze';
    this.freezeButton.setAttribute('aria-pressed', String(this.frozen));
  }
  private draw(summary = true) {
    if (this.element.hidden) return;
    const graph = PERFORMANCE_GRAPHS.find(graph => graph.id === this.selector.value)!;
    this.status.textContent = this.frozen ? 'FROZEN' : this.phase === 'playing' ? 'LIVE' : this.phase.toUpperCase();
    this.status.dataset.frozen = String(this.frozen);
    if (summary) {
      const stats = summarizeFrames(this.samples, this.count), ready = stats.intervals > 0;
      [ready ? stats.fps.toFixed(0) : '—', ready ? stats.p95.toFixed(1) : '—', ready ? stats.p99.toFixed(1) : '—', String(stats.hitches)]
        .forEach((value, i) => { this.values[i].textContent = value; });
    }
    const rect = this.canvas.getBoundingClientRect(), width = rect.width, height = rect.height;
    if (!width || !height || !this.context) return;
    const density = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * density), pixelHeight = Math.round(height * density);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) { this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; }
    const c = this.context;
    c.setTransform(density, 0, 0, density, 0, 0); c.clearRect(0, 0, width, height);
    const left = 35, right = width - 8, top = 10, bottom = height - 10;
    let maximum = graph.unit === 'ms' ? 20 : 10;
    for (let i = 0; i < this.count; i++) for (const item of graph.series) maximum = Math.max(maximum, frameValue(this.samples, i, item.metric) * 1.1);
    maximum = Math.ceil(maximum / 10) * 10;
    const y = (value: number) => bottom - value / maximum * (bottom - top);
    c.font = `11px ${GAME_FONT_STACK}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let step = 0; step <= 2; step++) {
      const value = maximum * step / 2;
      c.strokeStyle = '#90aabb22'; c.lineWidth = 1; c.beginPath(); c.moveTo(left, y(value)); c.lineTo(right, y(value)); c.stroke();
      c.fillStyle = '#a3b4bf'; c.fillText(String(value), left - 7, y(value));
    }
    if (graph.unit === 'ms') {
      c.setLineDash([3, 4]); c.strokeStyle = '#dfc58b66'; c.beginPath(); c.moveTo(left, y(1000 / 60)); c.lineTo(right, y(1000 / 60)); c.stroke(); c.setLineDash([]);
    }
    let duration = 0;
    for (let i = 1; i < this.count; i++) duration += frameValue(this.samples, i, 'frameInterval');
    const span = Math.max(1000, duration);
    for (const item of graph.series) {
      c.beginPath(); c.strokeStyle = item.color; c.lineWidth = 1.4;
      let elapsed = 0, pen = false;
      for (let i = 0; i < this.count; i++) {
        const interval = frameValue(this.samples, i, 'frameInterval');
        if (i > 0) elapsed += interval;
        if (interval === 0) { pen = false; if (item.metric === 'frameInterval') continue; }
        const x = right - (duration - elapsed) / span * (right - left);
        const value = frameValue(this.samples, i, item.metric);
        if (!pen) c.moveTo(x, y(value)); else c.lineTo(x, y(value));
        pen = true;
      }
      c.stroke();
    }
    if (!this.count) { c.textAlign = 'center'; c.fillStyle = '#9fb2bd'; c.fillText('Collecting frames…', (left + right) / 2, height / 2); }
    this.range.textContent = `${(duration / 1000).toFixed(1)}s history · ${this.count} frames${graph.unit === 'ms' ? ' · dashed: 60 FPS budget' : ' · count'}`;
    if (this.legend.dataset.graph !== graph.id) {
      this.legend.dataset.graph = graph.id; this.legend.replaceChildren();
      for (const item of graph.series) {
        const row = document.createElement('span'), swatch = document.createElement('i'), label = document.createElement('span'), value = document.createElement('b');
        swatch.style.backgroundColor = item.color; label.textContent = item.label;
        row.append(swatch, label, value); this.legend.append(row);
      }
    }
    const readings = this.legend.querySelectorAll('b');
    graph.series.forEach((item, i) => {
      const value = this.count ? frameValue(this.samples, this.count - 1, item.metric) : 0;
      readings[i].textContent = graph.unit === 'ms' ? value.toFixed(1) : String(Math.round(value));
    });
    this.note.textContent = graph.note;
    this.canvas.setAttribute('aria-label', `${graph.label}, ${graph.unit}. ${Array.from(this.legend.children).map(row => row.textContent).join(', ')}`);
  }
  private export() {
    const capture = this.capture ?? this.profiler.snapshot();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, capturedAt: new Date().toISOString(), phase: this.capture ? this.capturePhase : this.phase,
      description: 'CPU submission timings, not GPU time. CPU includes NPC/inventory panel rendering between game callbacks, attributed to the next frame. Render sub-stages overlap. Counters sampled at 10 Hz. Zero intervals mark capture/phase boundaries. Timeline holds 600 frames; history holds 1800 phase-labelled one-second buckets (shorter at phase changes).', ...capture }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `evergrow-performance-${Date.now()}.json`;
    this.element.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  dispose() { this.abort.abort(); this.element.remove(); }
}
