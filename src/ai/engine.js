import { WIN_LINES, checkWin, getValidMoves } from '../lib/gameLogic';

// ─── SHARED CONSTANTS ─────────────────────────────────────

const BOARD_WEIGHTS = [2, 1, 2, 1, 3, 1, 2, 1, 2]; // corner=2, edge=1, center=3
const CELL_WEIGHTS  = [1.2, 1, 1.2, 1, 1.5, 1, 1.2, 1, 1.2];

// ─── SHARED UTILITIES ─────────────────────────────────────

function weightedRandomPick(moves, weightFn) {
  const weights = moves.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return moves[Math.floor(Math.random() * moves.length)];
  let r = Math.random() * total;
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (r <= 0) return moves[i];
  }
  return moves[moves.length - 1];
}

// Count threats for a 3x3 grid — only open lines (not blocked by opponent)
function countThreats(cells, player) {
  let two = 0, one = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const mine = line.filter(x => x === player).length;
    const blocked = line.filter(x => x !== null && x !== player && x !== 'T').length;
    const empty = line.filter(x => x === null).length;
    if (blocked > 0) continue;
    if (mine === 2 && empty === 1) two++;
    else if (mine === 1 && empty === 2) one++;
  }
  return { two, one };
}

// Count how many meta-level lines have 2-in-a-row (fork = 2+ of these)
function countMetaForks(bWins, player) {
  let forkCount = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [bWins[a], bWins[b], bWins[c]];
    const mine = line.filter(x => x === player).length;
    const empty = line.filter(x => x === null).length;
    if (mine === 2 && empty === 1) forkCount++;
  }
  return forkCount;
}

function findWinningMove(cells, player) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const count = line.filter(x => x === player).length;
    const empty = line.filter(x => x === null).length;
    if (count === 2 && empty === 1) {
      if (!cells[a]) return a;
      if (!cells[b]) return b;
      if (!cells[c]) return c;
    }
  }
  return -1;
}

// ─── CLASSIC AI ────────────────────────────────────────────
// Perfect minimax — no changes needed

function classicMinimax(cells, isMax, alpha, beta, depth) {
  const w = checkWin(cells);
  if (w === 'X') return -10 + depth;
  if (w === 'O') return 10 - depth;
  if (w === 'T') return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = 'O';
      best = Math.max(best, classicMinimax(cells, false, alpha, beta, depth + 1));
      cells[i] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = 'X';
      best = Math.min(best, classicMinimax(cells, true, alpha, beta, depth + 1));
      cells[i] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function classicAI(cells, turn, difficulty) {
  const valid = getValidMoves(cells);
  if (valid.length === 0) return -1;

  if (difficulty === 'easy') {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  if (difficulty === 'medium') {
    const win = findWinningMove(cells, turn);
    if (win >= 0) return win;
    const opp = turn === 'X' ? 'O' : 'X';
    const block = findWinningMove(cells, opp);
    if (block >= 0) return block;
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // hard & unbeatable: minimax
  const isO = turn === 'O';
  let bestScore = isO ? -Infinity : Infinity;
  let bestMove = valid[0];

  for (const i of valid) {
    const copy = [...cells];
    copy[i] = turn;
    const s = classicMinimax(copy, !isO, -Infinity, Infinity, 0);
    if (isO ? s > bestScore : s < bestScore) {
      bestScore = s;
      bestMove = i;
    }
  }
  return bestMove;
}

// ─── ULTIMATE AI ───────────────────────────────────────────

function getUltimateMoves(boards, bWins, active) {
  const moves = [];
  const boardsToCheck = active !== null ? [active] : Array.from({ length: 9 }, (_, i) => i);
  for (const bi of boardsToCheck) {
    if (bWins[bi]) continue;
    for (let ci = 0; ci < 9; ci++) {
      if (!boards[bi][ci]) moves.push([bi, ci]);
    }
  }
  return moves;
}

// Enhanced evaluation: board wins, meta-threats, fork detection, internal board strength
function evalUltimate(boards, bWins, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  let sc = 0;

  // Check for meta win/loss first
  const mw = checkWin(bWins);
  if (mw === turn) return 10000;
  if (mw === opp) return -10000;

  // Board-level evaluation
  for (let i = 0; i < 9; i++) {
    const w = BOARD_WEIGHTS[i];
    if (bWins[i] === turn) {
      sc += 50 * w;
    } else if (bWins[i] === opp) {
      sc -= 50 * w;
    } else if (bWins[i] === 'T') {
      continue;
    } else {
      // Active board — evaluate internal threats
      const myT = countThreats(boards[i], turn);
      const oppT = countThreats(boards[i], opp);
      sc += (myT.two * 8 + myT.one * 2) * w * 0.4;
      sc -= (oppT.two * 8 + oppT.one * 2) * w * 0.4;
      // Piece advantage within contested boards
      const myPcs = boards[i].filter(x => x === turn).length;
      const oppPcs = boards[i].filter(x => x === opp).length;
      sc += (myPcs - oppPcs) * w * 0.3;
    }
  }

  // Meta-board evaluation — two-in-a-row at meta level is very powerful
  const myMeta = countThreats(bWins, turn);
  const oppMeta = countThreats(bWins, opp);
  sc += myMeta.two * 150;
  sc -= oppMeta.two * 150;
  sc += myMeta.one * 30;
  sc -= oppMeta.one * 30;

  // Fork detection: 2+ meta-threats is devastating (opponent can't block both)
  if (myMeta.two >= 2) sc += 300;
  if (oppMeta.two >= 2) sc -= 300;

  return sc;
}

// Evaluate where a move sends the opponent (board ci)
function routingScore(bWins, boards, ci, turn) {
  const opp = turn === 'X' ? 'O' : 'X';

  // Sending to a won/tied board = opponent gets free choice — bad
  if (bWins[ci]) return -15;

  let sc = 0;
  const oppT = countThreats(boards[ci], opp);
  const myT = countThreats(boards[ci], turn);

  // Good: send to a board where we're dominant
  sc += myT.two * 8;
  sc += myT.one * 2;
  // Bad: send to a board where opponent is close to winning
  sc -= oppT.two * 10;
  sc -= oppT.one * 3;
  // Center board gives opponent most strategic value
  sc -= BOARD_WEIGHTS[ci] * 0.5;

  return sc;
}

// Order moves by likely quality for better alpha-beta pruning
function orderUltimateMoves(moves, boards, bWins, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  const scored = moves.map(([bi, ci]) => {
    let p = 0;

    // Winning a board = highest priority
    const tb = [...boards[bi]];
    tb[ci] = turn;
    if (checkWin(tb) === turn) {
      p += 1000;
      const tw = [...bWins]; tw[bi] = turn;
      if (checkWin(tw) === turn) p += 5000;
      else if (countMetaForks(tw, turn) >= 2) p += 2000;
    }

    // Blocking opponent board win
    const ob = [...boards[bi]];
    ob[ci] = opp;
    if (checkWin(ob) === opp) {
      p += 500;
      const tw = [...bWins]; tw[bi] = opp;
      if (checkWin(tw) === opp) p += 3000; // critical block
    }

    // Positional + routing
    p += CELL_WEIGHTS[ci] * BOARD_WEIGHTS[bi] * 2;
    p += routingScore(bWins, boards, ci, turn) * 0.5;

    return { move: [bi, ci], p };
  });
  scored.sort((a, b) => b.p - a.p);
  return scored.map(s => s.move);
}

// Alpha-beta search for Ultimate mode
function ultimateAB(boards, bWins, active, turn, aiPlayer, depth, alpha, beta, isMax) {
  const mw = checkWin(bWins);
  if (mw === aiPlayer) return 10000 - (4 - depth) * 10;
  if (mw && mw !== 'T') return -10000 + (4 - depth) * 10;
  if (mw === 'T') return 0;
  if (depth <= 0) return evalUltimate(boards, bWins, aiPlayer);

  const moves = getUltimateMoves(boards, bWins, active);
  if (moves.length === 0) return evalUltimate(boards, bWins, aiPlayer);

  const ordered = orderUltimateMoves(moves, boards, bWins, turn);
  const opp = turn === 'X' ? 'O' : 'X';

  if (isMax) {
    let best = -Infinity;
    for (const [bi, ci] of ordered) {
      const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? turn : c) : [...b]);
      const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
      const na = nw[ci] ? null : ci;
      best = Math.max(best, ultimateAB(nb, nw, na, opp, aiPlayer, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [bi, ci] of ordered) {
      const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? turn : c) : [...b]);
      const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
      const na = nw[ci] ? null : ci;
      best = Math.min(best, ultimateAB(nb, nw, na, opp, aiPlayer, depth - 1, alpha, beta, true));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function ultimateAI(boards, bWins, active, turn, difficulty) {
  const moves = getUltimateMoves(boards, bWins, active);
  if (moves.length === 0) return null;

  const opp = turn === 'X' ? 'O' : 'X';

  // ── Easy: weighted random, occasionally finds wins
  if (difficulty === 'easy') {
    if (Math.random() < 0.3) {
      for (const [bi, ci] of moves) {
        const tb = [...boards[bi]]; tb[ci] = turn;
        if (checkWin(tb) === turn) return [bi, ci];
      }
    }
    return weightedRandomPick(moves, ([bi, ci]) => CELL_WEIGHTS[ci] * BOARD_WEIGHTS[bi]);
  }

  // ── Medium: meta-board awareness, routing, scored selection
  if (difficulty === 'medium') {
    let bestScore = -Infinity;
    let bestMoves = [moves[0]];

    for (const [bi, ci] of moves) {
      let sc = 0;
      const tb = [...boards[bi]]; tb[ci] = turn;

      // Winning a board
      if (checkWin(tb) === turn) {
        sc += 100 * BOARD_WEIGHTS[bi];
        const tw = [...bWins]; tw[bi] = turn;
        if (checkWin(tw) === turn) sc += 5000;
        if (countMetaForks(tw, turn) >= 2) sc += 500;
      }
      // Blocking opponent board win
      const ob = [...boards[bi]]; ob[ci] = opp;
      if (checkWin(ob) === opp) {
        sc += 80 * BOARD_WEIGHTS[bi];
        const tw = [...bWins]; tw[bi] = opp;
        if (checkWin(tw) === opp) sc += 4000;
      }
      // Positional + routing
      sc += CELL_WEIGHTS[ci] * BOARD_WEIGHTS[bi] * 3;
      sc += routingScore(bWins, boards, ci, turn) * 2;
      sc += Math.random() * 5; // slight randomness

      if (sc > bestScore) { bestScore = sc; bestMoves = [[bi, ci]]; }
      else if (Math.abs(sc - bestScore) < 1) bestMoves.push([bi, ci]);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── Hard: 3-ply alpha-beta with enhanced evaluation + routing
  if (difficulty === 'hard') {
    const ordered = orderUltimateMoves(moves, boards, bWins, turn);
    let bestScore = -Infinity;
    let bestMoves = [ordered[0]];

    for (const [bi, ci] of ordered) {
      const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? turn : c) : [...b]);
      const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
      if (checkWin(nw) === turn) return [bi, ci]; // instant meta-win
      const na = nw[ci] ? null : ci;

      let sc = ultimateAB(nb, nw, na, opp, turn, 2, -Infinity, Infinity, false);
      sc += routingScore(bWins, boards, ci, turn) * 0.3;

      if (sc > bestScore) { bestScore = sc; bestMoves = [[bi, ci]]; }
      else if (sc === bestScore) bestMoves.push([bi, ci]);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── Unbeatable: iterative deepening — 2-ply all, then 4-ply on top candidates
  {
    const ordered = orderUltimateMoves(moves, boards, bWins, turn);

    // Phase 1: 2-ply on all moves
    const phase1 = [];
    for (const [bi, ci] of ordered) {
      const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? turn : c) : [...b]);
      const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
      if (checkWin(nw) === turn) return [bi, ci]; // instant win
      const na = nw[ci] ? null : ci;

      let sc = ultimateAB(nb, nw, na, opp, turn, 1, -Infinity, Infinity, false);
      sc += routingScore(bWins, boards, ci, turn) * 0.2;
      phase1.push({ move: [bi, ci], sc, nb, nw, na });
    }

    // Phase 2: 4-ply on top ~40% of candidates (min 8)
    phase1.sort((a, b) => b.sc - a.sc);
    const topN = Math.min(phase1.length, Math.max(8, Math.ceil(phase1.length * 0.4)));

    let bestScore = -Infinity;
    let bestMoves = [phase1[0].move];

    for (let i = 0; i < topN; i++) {
      const { move, nb, nw, na } = phase1[i];
      let sc = ultimateAB(nb, nw, na, opp, turn, 3, bestScore - 1, Infinity, false);
      sc += routingScore(bWins, boards, move[1], turn) * 0.2;

      if (sc > bestScore) { bestScore = sc; bestMoves = [move]; }
      else if (sc === bestScore) bestMoves.push(move);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
}

// ─── MEGA AI ───────────────────────────────────────────────

function getMegaMoves(cells, smallW, midW, aMid, aSmall) {
  const moves = [];
  for (let mi = 0; mi < 9; mi++) {
    if (midW[mi]) continue;
    if (aMid !== null && aMid !== mi) continue;
    for (let si = 0; si < 9; si++) {
      if (smallW[mi][si]) continue;
      if (aMid === mi && aSmall !== null && aSmall !== si) continue;
      for (let ci = 0; ci < 9; ci++) {
        if (!cells[mi][si][ci]) moves.push([mi, si, ci]);
      }
    }
  }
  return moves;
}

// Enhanced MEGA evaluation: multi-layer analysis + meta-fork detection
function evalMega(cells, smallW, midW, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  let sc = 0;

  // Check meta win/loss first
  const mw = checkWin(midW);
  if (mw === turn) return 10000;
  if (mw === opp) return -10000;

  // Meta-board threats (mid-board → overall game)
  const myMeta = countThreats(midW, turn);
  const oppMeta = countThreats(midW, opp);
  sc += myMeta.two * 200;
  sc -= oppMeta.two * 200;
  sc += myMeta.one * 40;
  sc -= oppMeta.one * 40;
  if (myMeta.two >= 2) sc += 400;
  if (oppMeta.two >= 2) sc -= 400;

  // Mid-board evaluation (small-board wins → mid-board)
  for (let mi = 0; mi < 9; mi++) {
    const mwt = BOARD_WEIGHTS[mi];
    if (midW[mi] === turn) {
      sc += 80 * mwt;
    } else if (midW[mi] === opp) {
      sc -= 80 * mwt;
    } else if (midW[mi] === 'T') {
      continue;
    } else {
      // Small-board-level threats within this mid-board
      const mySmT = countThreats(smallW[mi], turn);
      const oppSmT = countThreats(smallW[mi], opp);
      sc += mySmT.two * 12 * mwt;
      sc -= oppSmT.two * 12 * mwt;
      sc += mySmT.one * 3 * mwt;
      sc -= oppSmT.one * 3 * mwt;
      // Individual small board wins
      for (let si = 0; si < 9; si++) {
        if (smallW[mi][si] === turn) sc += 3 * BOARD_WEIGHTS[si] * mwt * 0.3;
        else if (smallW[mi][si] === opp) sc -= 3 * BOARD_WEIGHTS[si] * mwt * 0.3;
      }
    }
  }

  return sc;
}

// Categorize MEGA moves: critical > tactical > other
function categorizeMegaMoves(moves, cells, smallW, midW, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  const critical = [];
  const tactical = [];
  const other = [];

  for (const move of moves) {
    const [mi, si, ci] = move;
    let isCritical = false;

    // Check if this wins a small board
    const tc = [...cells[mi][si]]; tc[ci] = turn;
    if (checkWin(tc) === turn) {
      isCritical = true;
      // Check mid-board / meta-win
      const ts = [...smallW[mi]]; ts[si] = turn;
      if (checkWin(ts) === turn) {
        const tm = [...midW]; tm[mi] = turn;
        if (checkWin(tm) === turn) { critical.unshift(move); continue; } // meta-win first
      }
    }

    // Check if opponent would win a small board (block needed)
    const oc = [...cells[mi][si]]; oc[ci] = opp;
    if (checkWin(oc) === opp) isCritical = true;

    if (isCritical) {
      critical.push(move);
    } else if (ci === 4 || si === 4 || CELL_WEIGHTS[ci] > 1 || BOARD_WEIGHTS[si] > 1) {
      tactical.push(move);
    } else {
      other.push(move);
    }
  }
  return { critical, tactical, other };
}

// MEGA routing: evaluate where [mi, si, ci] sends the opponent (to mid si, small ci)
function megaRoutingScore(smallW, midW, cells, si, ci, turn) {
  const opp = turn === 'X' ? 'O' : 'X';

  // Sending to won mid-board = free choice → bad
  if (midW[si]) return -10;
  // Sending to won small-board = free small-board choice within that mid → less bad
  if (smallW[si] && smallW[si][ci]) return -5;

  let sc = 0;
  if (cells[si] && cells[si][ci]) {
    const oppT = countThreats(cells[si][ci], opp);
    const myT = countThreats(cells[si][ci], turn);
    sc += myT.two * 5;
    sc -= oppT.two * 7;
    sc += myT.one * 1;
    sc -= oppT.one * 2;
  }
  return sc;
}

// Apply a MEGA move and return new state
function applyMegaMove(cells, smallW, midW, mi, si, ci, player) {
  const nc = cells.map((m, m2) => m.map((s, s2) =>
    (m2 === mi && s2 === si) ? s.map((c, c2) => c2 === ci ? player : c) : [...s]
  ));
  const nsw = smallW.map((m, m2) => m.map((w, s2) =>
    (m2 === mi && s2 === si && !w) ? checkWin(nc[m2][s2]) : w
  ));
  const nmw = midW.map((w, m2) => (m2 === mi && !w) ? checkWin(nsw[m2]) : w);
  return { nc, nsw, nmw };
}

// Compute next active constraints after a MEGA move
function megaNextActive(nmw, nsw, si, ci) {
  const nextAMid = nmw[si] ? null : si;
  const nextASmall = (nextAMid === si && nsw[si][ci]) ? null : (nextAMid === si ? ci : null);
  return { nextAMid, nextASmall };
}

export function megaAI(cells, smallW, midW, aMid, aSmall, turn, difficulty) {
  const moves = getMegaMoves(cells, smallW, midW, aMid, aSmall);
  if (moves.length === 0) return null;

  const opp = turn === 'X' ? 'O' : 'X';

  // ── Easy: weighted random, occasionally finds wins
  if (difficulty === 'easy') {
    if (Math.random() < 0.25) {
      for (const [mi, si, ci] of moves) {
        const tc = [...cells[mi][si]]; tc[ci] = turn;
        if (checkWin(tc) === turn) return [mi, si, ci];
      }
    }
    return weightedRandomPick(moves, ([mi, si, ci]) =>
      CELL_WEIGHTS[ci] * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi]
    );
  }

  // ── Medium: multi-level threat detection (small → mid → meta)
  if (difficulty === 'medium') {
    let bestScore = -Infinity;
    let bestMoves = [moves[0]];

    for (const [mi, si, ci] of moves) {
      let sc = 0;

      // Win small board
      const tc = [...cells[mi][si]]; tc[ci] = turn;
      if (checkWin(tc) === turn) {
        sc += 50 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi];
        const ts = [...smallW[mi]]; ts[si] = turn;
        if (checkWin(ts) === turn) {
          sc += 200 * BOARD_WEIGHTS[mi];
          const tm = [...midW]; tm[mi] = turn;
          if (checkWin(tm) === turn) sc += 10000;
        }
      }

      // Block opponent small board win
      const oc = [...cells[mi][si]]; oc[ci] = opp;
      if (checkWin(oc) === opp) {
        sc += 40 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi];
        const ts = [...smallW[mi]]; ts[si] = opp;
        if (checkWin(ts) === opp) sc += 150 * BOARD_WEIGHTS[mi];
      }

      // Positional
      sc += CELL_WEIGHTS[ci] * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 2;
      sc += Math.random() * 3;

      if (sc > bestScore) { bestScore = sc; bestMoves = [[mi, si, ci]]; }
      else if (Math.abs(sc - bestScore) < 1) bestMoves.push([mi, si, ci]);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── Hard: 1-ply lookahead with smart move categorization
  if (difficulty === 'hard') {
    const { critical, tactical, other } = categorizeMegaMoves(moves, cells, smallW, midW, turn);

    // Always evaluate all critical + sample of tactical + fill to ~40 with other
    const tacLimit = 25;
    const otherLimit = Math.max(0, 40 - critical.length - Math.min(tactical.length, tacLimit));
    const toEval = [...critical, ...tactical.slice(0, tacLimit), ...other.slice(0, otherLimit)];
    if (toEval.length === 0) toEval.push(moves[0]);

    let bestScore = -Infinity;
    let bestMoves = [toEval[0]];

    for (const [mi, si, ci] of toEval) {
      const { nc, nsw, nmw } = applyMegaMove(cells, smallW, midW, mi, si, ci, turn);
      if (checkWin(nmw) === turn) return [mi, si, ci]; // instant meta-win

      let sc = evalMega(nc, nsw, nmw, turn);
      sc += megaRoutingScore(smallW, midW, cells, si, ci, turn) * 1.5;

      // 1-ply: evaluate opponent's best response
      const { nextAMid, nextASmall } = megaNextActive(nmw, nsw, si, ci);
      const oppMoves = getMegaMoves(nc, nsw, nmw, nextAMid, nextASmall);

      if (oppMoves.length > 0) {
        const { critical: oc, tactical: ot } = categorizeMegaMoves(oppMoves, nc, nsw, nmw, opp);
        const oppSample = [...oc, ...ot.slice(0, 10)].slice(0, 15);
        if (oppSample.length === 0) oppSample.push(oppMoves[0]);

        let worst = Infinity;
        for (const [omi, osi, oci] of oppSample) {
          const { nc: onc, nsw: onsw, nmw: onmw } = applyMegaMove(nc, nsw, nmw, omi, osi, oci, opp);
          worst = Math.min(worst, evalMega(onc, onsw, onmw, turn));
        }
        sc = sc * 0.3 + worst * 0.7;
      }

      if (sc > bestScore) { bestScore = sc; bestMoves = [[mi, si, ci]]; }
      else if (sc === bestScore) bestMoves.push([mi, si, ci]);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── Unbeatable: 2-ply phased search (0-ply all → 1-ply top 30 → 2-ply top 10)
  {
    const { critical, tactical, other } = categorizeMegaMoves(moves, cells, smallW, midW, turn);
    const allMoves = [...critical, ...tactical, ...other];

    // Phase 1: 0-ply evaluation of all moves
    const phase1 = [];
    for (const [mi, si, ci] of allMoves) {
      const { nc, nsw, nmw } = applyMegaMove(cells, smallW, midW, mi, si, ci, turn);
      if (checkWin(nmw) === turn) return [mi, si, ci]; // instant win

      let sc = evalMega(nc, nsw, nmw, turn);
      sc += megaRoutingScore(smallW, midW, cells, si, ci, turn);
      if (checkWin(nc[mi][si]) === turn) sc += 15 * BOARD_WEIGHTS[si];
      if (checkWin(nsw[mi]) === turn) sc += 40 * BOARD_WEIGHTS[mi];

      phase1.push({ move: [mi, si, ci], sc, nc, nsw, nmw });
    }

    // Phase 2: 1-ply on top 30
    phase1.sort((a, b) => b.sc - a.sc);
    const top30 = phase1.slice(0, 30);
    const phase2 = [];

    for (const entry of top30) {
      const { move, nc, nsw, nmw } = entry;
      const [, si, ci] = move;

      const { nextAMid, nextASmall } = megaNextActive(nmw, nsw, si, ci);
      const oppMoves = getMegaMoves(nc, nsw, nmw, nextAMid, nextASmall);

      let sc = entry.sc;
      if (oppMoves.length > 0) {
        const { critical: oc, tactical: ot } = categorizeMegaMoves(oppMoves, nc, nsw, nmw, opp);
        const oppSample = [...oc, ...ot.slice(0, 12)].slice(0, 20);
        if (oppSample.length === 0) oppSample.push(oppMoves[0]);

        let worst = Infinity;
        for (const [omi, osi, oci] of oppSample) {
          const { nc: onc, nsw: onsw, nmw: onmw } = applyMegaMove(nc, nsw, nmw, omi, osi, oci, opp);
          worst = Math.min(worst, evalMega(onc, onsw, onmw, turn));
        }
        sc = sc * 0.3 + worst * 0.7;
      }
      phase2.push({ move, sc, nc, nsw, nmw });
    }

    // Phase 3: 2-ply on top 10
    phase2.sort((a, b) => b.sc - a.sc);
    const top10 = phase2.slice(0, 10);

    let bestScore = -Infinity;
    let bestMoves = [top10[0].move];

    for (const entry of top10) {
      const { move, nc, nsw, nmw } = entry;
      const [, si, ci] = move;

      const { nextAMid, nextASmall } = megaNextActive(nmw, nsw, si, ci);
      const oppMoves = getMegaMoves(nc, nsw, nmw, nextAMid, nextASmall);

      let sc = evalMega(nc, nsw, nmw, turn);

      if (oppMoves.length > 0) {
        const { critical: oc, tactical: ot } = categorizeMegaMoves(oppMoves, nc, nsw, nmw, opp);
        const oppSample = [...oc, ...ot.slice(0, 8)].slice(0, 12);
        if (oppSample.length === 0) oppSample.push(oppMoves[0]);

        let worst = Infinity;
        for (const [omi, osi, oci] of oppSample) {
          const { nc: onc, nsw: onsw, nmw: onmw } = applyMegaMove(nc, nsw, nmw, omi, osi, oci, opp);

          // 2nd ply: our best response
          const na2 = megaNextActive(onmw, onsw, osi, oci);
          const ourMoves = getMegaMoves(onc, onsw, onmw, na2.nextAMid, na2.nextASmall);

          let bestResp = -Infinity;
          const { critical: uc, tactical: ut } = categorizeMegaMoves(ourMoves, onc, onsw, onmw, turn);
          const ourSample = [...uc, ...ut.slice(0, 5)].slice(0, 8);

          for (const [umi, usi, uci] of ourSample) {
            const { nc: unc, nsw: unsw, nmw: unmw } = applyMegaMove(onc, onsw, onmw, umi, usi, uci, turn);
            bestResp = Math.max(bestResp, evalMega(unc, unsw, unmw, turn));
          }

          if (ourSample.length > 0) {
            worst = Math.min(worst, bestResp);
          } else {
            worst = Math.min(worst, evalMega(onc, onsw, onmw, turn));
          }
        }
        sc = sc * 0.2 + worst * 0.8;
      }

      if (sc > bestScore) { bestScore = sc; bestMoves = [move]; }
      else if (sc === bestScore) bestMoves.push(move);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
}

// ─── Unified AI interface ──────────────────────────────────

export function getAIMove(mode, gameState, turn, difficulty) {
  return new Promise(resolve => {
    const delay = 300 + Math.random() * 300;
    setTimeout(() => {
      // requestAnimationFrame lets the thinking indicator render before heavy computation
      requestAnimationFrame(() => {
        if (mode === 'classic') {
          resolve(classicAI(gameState.cells, turn, difficulty));
        } else if (mode === 'ultimate') {
          resolve(ultimateAI(gameState.boards, gameState.bWins, gameState.active, turn, difficulty));
        } else if (mode === 'mega') {
          resolve(megaAI(gameState.cells, gameState.smallW, gameState.midW, gameState.aMid, gameState.aSmall, turn, difficulty));
        }
      });
    }, delay);
  });
}
