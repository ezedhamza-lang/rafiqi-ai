import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gameResultSchema, GAME_CODES as VALIDATOR_GAMES } from '../src/validators/playZone.js';

/**
 * Regression guard for the 01-10-2026 outage of PlayZone scoring:
 * the UI offered 9 games (QUICK_MATH, WORD_BUILD, MEMORY + science/arabic/french)
 * while the backend whitelist still only knew the original 3, so every finished
 * round of the 6 newer games came back 400 and the score was lost.
 * Read the three whitelists as source text so a game added to the UI without the
 * backend (or vice versa) fails the suite instead of production.
 */
const repoRoot = path.resolve(process.cwd(), '..');

function readArray(file, name) {
  const src = readFileSync(path.join(repoRoot, file), 'utf8');
  const match = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!match) throw new Error(`${name} array not found in ${file}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
}

const frontendGames = readArray('frontend/src/pages/student/PlayZone.jsx', 'GAME_CODES');
const routeGames = readArray('backend/src/routes/playZone.js', 'VALID_GAMES');

describe('PlayZone game whitelists stay in sync', () => {
  it('reads a non-empty game list from the UI and from the route', () => {
    expect(frontendGames.length).toBeGreaterThanOrEqual(3);
    expect(routeGames.length).toBeGreaterThanOrEqual(3);
    expect(frontendGames).toEqual(expect.arrayContaining(['QUICK_MATH', 'WORD_BUILD', 'MEMORY']));
  });

  it('every game the UI offers passes the backend validator', () => {
    for (const game of frontendGames) {
      const parsed = gameResultSchema.safeParse({ game, score: 5, correct: 5, total: 8 });
      expect(parsed.success, `validator rejects UI game ${game}`).toBe(true);
    }
  });

  it('the route whitelist covers every game the UI offers', () => {
    for (const game of frontendGames) {
      expect(routeGames, `route rejects UI game ${game}`).toContain(game);
    }
  });

  it('the route whitelist and the validator whitelist agree', () => {
    expect(new Set(routeGames)).toEqual(new Set(VALIDATOR_GAMES));
  });

  it('an unknown game is still rejected', () => {
    expect(gameResultSchema.safeParse({ game: 'NOT_A_GAME' }).success).toBe(false);
  });
});
