export const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function checkWin(cells) {
  for (const [a,b,c] of WIN_LINES) {
    if (cells[a] && cells[a] !== "T" && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? "T" : null;
}

export function getWinLine(cells) {
  for (const ln of WIN_LINES) {
    if (cells[ln[0]] && cells[ln[0]] !== "T" && cells[ln[0]] === cells[ln[1]] && cells[ln[0]] === cells[ln[2]]) return ln;
  }
  return [];
}

export function getValidMoves(cells) {
  return cells.reduce((acc, c, i) => c ? acc : [...acc, i], []);
}

// ELO calculation
export function calcElo(winnerRating, loserRating, isDraw) {
  if (isDraw) return { winnerDelta: 5, loserDelta: 5 };
  const winnerHigher = winnerRating >= loserRating;
  return {
    winnerDelta: winnerHigher ? 10 : 30,
    loserDelta: winnerHigher ? -30 : -10,
  };
}

// Rank badges
export function getRankBadge(elo) {
  if (elo >= 1800) return { name: 'Diamond', color: '#b9f2ff', icon: '\u2666' };
  if (elo >= 1600) return { name: 'Platinum', color: '#e5e4e2', icon: '\u2605' };
  if (elo >= 1400) return { name: 'Gold', color: '#ffd700', icon: '\u2605' };
  if (elo >= 1200) return { name: 'Silver', color: '#c0c0c0', icon: '\u2605' };
  return { name: 'Bronze', color: '#cd7f32', icon: '\u2605' };
}

// Score formula (from original app)
export function score(w, l, t) {
  const g = w + l + t;
  if (!g) return 0;
  return (w + 0.5*t)/g*50 + (w/Math.max(l,1)/16)*30 + (g/19)*20;
}
