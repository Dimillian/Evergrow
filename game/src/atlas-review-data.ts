import type { Exploration } from './exploration.ts';

/** Development-only sample travel coverage; never writes the user's chart. */
export const ATLAS_REVIEW_BOUNDS = Object.freeze({ x: -11100, y: -8500, width: 22200, height: 17000 });

export function stageAtlasExploration(chart: Pick<Exploration, 'reveal'>, seed: number) {
  const phase = seed % 1009 / 1009 * Math.PI * 2;
  // Overlapping traveled circles form a broad, uneven surveyed interior with
  // unexplored bays and several narrow excursions beyond its frontier.
  for (let y = -8500; y <= 8500; y += 850) for (let x = -11000; x <= 11000; x += 850) {
    const angle = Math.atan2(y / 7200, x / 9400);
    const frontier = .89 + Math.sin(angle * 3 + phase) * .105 + Math.cos(angle * 5 - phase) * .07;
    const distance = Math.hypot(x / 9400, y / 7200);
    const inlet = x > 2800 && y > 1300 && Math.hypot((x - 6400) / 2300, (y - 5000) / 1550) < 1;
    if (distance > frontier || inlet) continue;
    const bend = Math.sin(x / 1200 + phase) * 120;
    chart.reveal(x, y + bend, 685);
  }
  for (let spoke = 0; spoke < 5; spoke++) {
    const angle = spoke / 5 * Math.PI * 2 + phase * .17;
    for (let distance = 5000; distance < 10700; distance += 220) {
      const bend = Math.sin(distance / 900 + spoke) * 300;
      chart.reveal(Math.cos(angle) * distance + Math.sin(angle) * bend,
        Math.sin(angle) * distance * .78 + Math.cos(angle) * bend, 280);
    }
  }
  chart.reveal(0, 0, 520);
}

