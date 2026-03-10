// ── AI Engine for TTT Arena ──────────────────────────────
// Supports Classic (3x3), Ultimate (9 boards), and MEGA (81 boards)
// Difficulties: easy (random), medium (tactical), hard (minimax/heuristic with mistakes), unbeatable (perfect)

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkWin(cells) {
  for (const [a,b,c] of WIN_LINES) {
    if (cells[a] && cells[a] !== "T" && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? "T" : null;
}

function empties(cells) {
  return cells.reduce((a, c, i) => c ? a : [...a, i], []);
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Classic AI ──────────────────────────────────────────

function classicMinimax(cells, player, depth, alpha, beta) {
  const w = checkWin(cells);
  if (w === "O") return 10 - depth;
  if (w === "X") return depth - 10;
  if (w === "T") return 0;

  const empty = empties(cells);
  if (player === "O") {
    let best = -Infinity;
    for (const i of empty) {
      cells[i] = "O";
      best = Math.max(best, classicMinimax(cells, "X", depth + 1, alpha, beta));
      cells[i] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const i of empty) {
      cells[i] = "X";
      best = Math.min(best, classicMinimax(cells, "O", depth + 1, alpha, beta));
      cells[i] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function classicFindWinOrBlock(cells, player) {
  const empty = empties(cells);
  for (const i of empty) {
    cells[i] = player;
    if (checkWin(cells) === player) { cells[i] = null; return i; }
    cells[i] = null;
  }
  return -1;
}

export function classicAI(cells, difficulty) {
  const empty = empties(cells);
  if (!empty.length) return -1;

  if (difficulty === "easy") {
    return randomPick(empty);
  }

  if (difficulty === "medium") {
    // Win if possible
    const win = classicFindWinOrBlock(cells, "O");
    if (win >= 0) return win;
    // Block opponent win
    const block = classicFindWinOrBlock(cells, "X");
    if (block >= 0) return block;
    // Take center
    if (!cells[4]) return 4;
    // Random corner or edge
    const corners = [0,2,6,8].filter(i => !cells[i]);
    if (corners.length) return randomPick(corners);
    return randomPick(empty);
  }

  // hard and unbeatable both use minimax
  const board = [...cells];
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const i of empty) {
    board[i] = "O";
    const score = classicMinimax(board, "X", 0, -Infinity, Infinity);
    board[i] = null;
    if (score > bestScore) { bestScore = score; bestMoves = [i]; }
    else if (score === bestScore) bestMoves.push(i);
  }

  if (difficulty === "hard") {
    // 25% chance of random move instead of best
    if (Math.random() < 0.25) return randomPick(empty);
  }

  return randomPick(bestMoves);
}

// ── Ultimate AI ─────────────────────────────────────────

function ultimateValidMoves(boards, bWins, active) {
  const moves = [];
  for (let bi = 0; bi < 9; bi++) {
    if (bWins[bi]) continue;
    if (active !== null && active !== bi) continue;
    for (let ci = 0; ci < 9; ci++) {
      if (!boards[bi][ci]) moves.push([bi, ci]);
    }
  }
  return moves;
}

function evalLine(cells, a, b, c, player) {
  const opp = player === "O" ? "X" : "O";
  const vals = [cells[a], cells[b], cells[c]];
  const mine = vals.filter(v => v === player).length;
  const theirs = vals.filter(v => v === opp).length;
  const empty = vals.filter(v => !v).length;
  if (mine === 3) return 100;
  if (theirs === 3) return -100;
  if (mine === 2 && empty === 1) return 10;
  if (theirs === 2 && empty === 1) return -10;
  if (mine === 1 && empty === 2) return 1;
  if (theirs === 1 && empty === 2) return -1;
  return 0;
}

function evalBoard(cells, player) {
  let score = 0;
  for (const [a,b,c] of WIN_LINES) score += evalLine(cells, a, b, c, player);
  // Center bonus
  if (cells[4] === player) score += 3;
  else if (cells[4] && cells[4] !== player) score -= 3;
  return score;
}

function ultimateEval(boards, bWins, player) {
  let score = 0;
  // Evaluate meta-board (who's winning boards)
  score += evalBoard(bWins.map(w => w === "T" ? null : w), player) * 50;
  // Evaluate individual boards
  for (let bi = 0; bi < 9; bi++) {
    if (bWins[bi]) continue;
    score += evalBoard(boards[bi], player) * 2;
  }
  return score;
}

function ultimateApply(boards, bWins, bi, ci, player) {
  const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? player : c) : [...b]);
  const nw = bWins.map((w, i) => (i === bi && !w) ? checkWin(nb[i]) : w);
  const mw = checkWin(nw);
  const nextActive = nw[ci] ? null : ci;
  return { nb, nw, mw, nextActive };
}

function ultimateFindWinOrBlock(boards, bWins, active, player) {
  const moves = ultimateValidMoves(boards, bWins, active);
  for (const [bi, ci] of moves) {
    const { nw, mw } = ultimateApply(boards, bWins, bi, ci, player);
    if (mw === player) return [bi, ci];
    // Win a board
    if (!bWins[bi] && nw[bi] === player) return [bi, ci];
  }
  return null;
}

export function ultimateAI(boards, bWins, active, difficulty) {
  const moves = ultimateValidMoves(boards, bWins, active);
  if (!moves.length) return null;

  if (difficulty === "easy") {
    return randomPick(moves);
  }

  if (difficulty === "medium") {
    // Win the game or a board
    const win = ultimateFindWinOrBlock(boards, bWins, active, "O");
    if (win) return win;
    // Block opponent from winning game or board
    const block = ultimateFindWinOrBlock(boards, bWins, active, "X");
    if (block) return block;
    // Prefer center cells and center board
    const centerMoves = moves.filter(([bi, ci]) => ci === 4);
    if (centerMoves.length) return randomPick(centerMoves);
    return randomPick(moves);
  }

  // Hard / Unbeatable: 1-ply lookahead with heuristic eval
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const [bi, ci] of moves) {
    const { nb, nw, mw, nextActive } = ultimateApply(boards, bWins, bi, ci, "O");
    let score = 0;

    if (mw === "O") score = 10000;
    else if (mw === "T") score = 0;
    else {
      score = ultimateEval(nb, nw, "O");
      // Penalty for sending opponent to a board they can win
      if (nextActive !== null) {
        const oppMoves = ultimateValidMoves(nb, nw, nextActive);
        for (const [obi, oci] of oppMoves) {
          const oppResult = ultimateApply(nb, nw, obi, oci, "X");
          if (oppResult.mw === "X") score -= 500;
          if (oppResult.nw[obi] === "X") score -= 100;
        }
      }
      // Bonus for winning a board
      if (nw[bi] === "O") score += 200;
      // Prefer not sending to open boards
      if (nextActive !== null && !nw[nextActive]) {
        const oppBoardEmpty = nb[nextActive].filter(c => !c).length;
        if (oppBoardEmpty > 6) score -= 20;
      }
    }

    if (score > bestScore) { bestScore = score; bestMoves = [[bi, ci]]; }
    else if (score === bestScore) bestMoves.push([bi, ci]);
  }

  if (difficulty === "hard" && Math.random() < 0.2) {
    return randomPick(moves);
  }

  return randomPick(bestMoves);
}

// ── MEGA AI ─────────────────────────────────────────────

function megaValidMoves(cells, smallW, midW, aMid, aSmall, metaW) {
  if (metaW) return [];
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

function megaApply(cells, smallW, midW, mi, si, ci, player) {
  const nc = cells.map((m, m2) => m.map((s, s2) => (m2 === mi && s2 === si) ? s.map((c, c2) => c2 === ci ? player : c) : [...s]));
  const nsw = smallW.map((m, m2) => m.map((w, s2) => (m2 === mi && s2 === si && !w) ? checkWin(nc[m2][s2]) : w));
  const nmw = midW.map((w, m2) => (m2 === mi && !w) ? checkWin(nsw[m2]) : w);
  const nm = checkWin(nmw);
  const nextMid = nmw[ci] ? null : ci;
  const nextSmall = nextMid === null ? null : (nsw[nextMid][ci] ? null : ci);
  return { nc, nsw, nmw, nm, nextMid, nextSmall };
}

function megaEval(smallW, midW, player) {
  let score = 0;
  score += evalBoard(midW.map(w => w === "T" ? null : w), player) * 200;
  for (let mi = 0; mi < 9; mi++) {
    if (midW[mi]) continue;
    score += evalBoard(smallW[mi].map(w => w === "T" ? null : w), player) * 8;
  }
  return score;
}

function megaFindWin(cells, smallW, midW, aMid, aSmall, metaW, player) {
  const moves = megaValidMoves(cells, smallW, midW, aMid, aSmall, metaW);
  // First check for game wins
  for (const [mi, si, ci] of moves) {
    const { nm } = megaApply(cells, smallW, midW, mi, si, ci, player);
    if (nm === player) return [mi, si, ci];
  }
  // Then check for mid-board wins
  for (const [mi, si, ci] of moves) {
    const { nmw } = megaApply(cells, smallW, midW, mi, si, ci, player);
    if (!midW[mi] && nmw[mi] === player) return [mi, si, ci];
  }
  // Then check for small-board wins
  for (const [mi, si, ci] of moves) {
    const { nsw } = megaApply(cells, smallW, midW, mi, si, ci, player);
    if (!smallW[mi][si] && nsw[mi][si] === player) return [mi, si, ci];
  }
  return null;
}

export function megaAI(cells, smallW, midW, aMid, aSmall, metaW, difficulty) {
  const moves = megaValidMoves(cells, smallW, midW, aMid, aSmall, metaW);
  if (!moves.length) return null;

  if (difficulty === "easy") {
    return randomPick(moves);
  }

  if (difficulty === "medium") {
    const win = megaFindWin(cells, smallW, midW, aMid, aSmall, metaW, "O");
    if (win) return win;
    const block = megaFindWin(cells, smallW, midW, aMid, aSmall, metaW, "X");
    if (block) return block;
    // Prefer center cells
    const centerMoves = moves.filter(([,, ci]) => ci === 4);
    if (centerMoves.length) return randomPick(centerMoves);
    return randomPick(moves);
  }

  // Hard / Unbeatable: heuristic eval (full minimax is not feasible for MEGA)
  // Sample a subset of moves for efficiency since MEGA can have thousands of valid moves
  const sample = moves.length > 60 ? moves.sort(() => Math.random() - 0.5).slice(0, 60) : moves;

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const [mi, si, ci] of sample) {
    const { nsw, nmw, nm, nextMid, nextSmall } = megaApply(cells, smallW, midW, mi, si, ci, "O");
    let score = 0;

    if (nm === "O") score = 100000;
    else if (nm === "T") score = 0;
    else {
      score = megaEval(nsw, nmw, "O");
      // Bonus for winning boards
      if (nmw[mi] === "O" && !midW[mi]) score += 1000;
      if (nsw[mi][si] === "O" && !smallW[mi][si]) score += 100;
      // Penalty for giving opponent good position
      if (nextMid !== null && nextSmall !== null) {
        // Check if we're sending them somewhere restricted
        const oppMoves = megaValidMoves(cells, nsw, nmw, nextMid, nextSmall, nm);
        if (oppMoves.length < 3) score += 30;
      }
    }

    if (score > bestScore) { bestScore = score; bestMoves = [[mi, si, ci]]; }
    else if (score === bestScore) bestMoves.push([mi, si, ci]);
  }

  // Also always consider winning/blocking moves not in sample
  const win = megaFindWin(cells, smallW, midW, aMid, aSmall, metaW, "O");
  if (win) return win;
  const block = megaFindWin(cells, smallW, midW, aMid, aSmall, metaW, "X");
  if (block && difficulty === "unbeatable") return block;
  if (block && difficulty === "hard" && Math.random() > 0.3) return block;

  if (difficulty === "hard" && Math.random() < 0.2) {
    return randomPick(moves);
  }

  return randomPick(bestMoves);
}
