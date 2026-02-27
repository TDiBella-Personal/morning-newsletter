// Star Battles — 6x6 grid, 1 star per row/col/region
// Regions encoded as a 2D array of region IDs (0–5)
const GRID_SIZE = 6;
const STARS_PER_REGION = 1;

// Puzzle definition: region map (which region each cell belongs to)
const REGIONS = [
  [0, 0, 1, 1, 1, 2],
  [0, 0, 1, 2, 2, 2],
  [0, 3, 3, 3, 2, 2],
  [3, 3, 4, 3, 5, 5],
  [3, 4, 4, 4, 5, 5],
  [4, 4, 4, 5, 5, 5],
];

// Solution: star positions [row, col]
const SOLUTION = [
  [0, 2],
  [1, 5],
  [2, 0],
  [3, 3],
  [4, 1],
  [5, 4],
];

let board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

function buildBoard() {
  const boardEl = document.getElementById('board');
  boardEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 48px)`;
  boardEl.innerHTML = '';

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('click', () => toggleStar(r, c));
      applyRegionBorders(cell, r, c);
      boardEl.appendChild(cell);
    }
  }
}

function applyRegionBorders(cell, r, c) {
  const region = REGIONS[r][c];
  if (r === 0 || REGIONS[r - 1][c] !== region) cell.classList.add('border-top');
  if (r === GRID_SIZE - 1 || REGIONS[r + 1][c] !== region) cell.classList.add('border-bottom');
  if (c === 0 || REGIONS[r][c - 1] !== region) cell.classList.add('border-left');
  if (c === GRID_SIZE - 1 || REGIONS[r][c + 1] !== region) cell.classList.add('border-right');
}

function toggleStar(r, c) {
  board[r][c] = !board[r][c];
  const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  cell.textContent = board[r][c] ? '⭐' : '';
  cell.classList.toggle('starred', board[r][c]);
  document.getElementById('message').textContent = '';
  document.getElementById('message').className = '';
}

function resetBoard() {
  board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
  document.querySelectorAll('.cell').forEach(cell => {
    cell.textContent = '';
    cell.classList.remove('starred');
  });
  document.getElementById('message').textContent = '';
  document.getElementById('message').className = '';
}

function checkSolution() {
  const msg = document.getElementById('message');

  // Check each row has exactly 1 star
  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r].filter(Boolean).length !== STARS_PER_REGION) {
      msg.textContent = `Row ${r + 1} doesn't have exactly ${STARS_PER_REGION} star(s).`;
      msg.className = 'error';
      return;
    }
  }

  // Check each column has exactly 1 star
  for (let c = 0; c < GRID_SIZE; c++) {
    const count = board.reduce((n, row) => n + (row[c] ? 1 : 0), 0);
    if (count !== STARS_PER_REGION) {
      msg.textContent = `Column ${c + 1} doesn't have exactly ${STARS_PER_REGION} star(s).`;
      msg.className = 'error';
      return;
    }
  }

  // Check each region has exactly 1 star
  const regionCounts = Array(GRID_SIZE).fill(0);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c]) regionCounts[REGIONS[r][c]]++;
    }
  }
  for (let region = 0; region < GRID_SIZE; region++) {
    if (regionCounts[region] !== STARS_PER_REGION) {
      msg.textContent = `Region ${region + 1} doesn't have exactly ${STARS_PER_REGION} star(s).`;
      msg.className = 'error';
      return;
    }
  }

  // Check no two stars touch (including diagonally)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!board[r][c]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc]) {
            msg.textContent = `Stars at (${r + 1},${c + 1}) and (${nr + 1},${nc + 1}) are touching!`;
            msg.className = 'error';
            return;
          }
        }
      }
    }
  }

  msg.textContent = '🎉 Puzzle solved! Well done!';
  msg.className = 'success';
}

buildBoard();
