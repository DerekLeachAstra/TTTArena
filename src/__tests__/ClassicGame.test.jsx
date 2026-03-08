import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClassicGame from '../components/games/ClassicGame';

// Mock AI engine
vi.mock('../ai/engine', () => ({
  getAIMove: vi.fn().mockResolvedValue(-1),
}));

// Mock probability
vi.mock('../ai/probability', () => ({
  classicProbability: vi.fn(() => ({ x: 50, o: 50 })),
}));

const pX = { id: 1, firstName: 'Alice', nickname: '' };
const pO = { id: 2, firstName: 'Bob', nickname: '' };
const noop = () => {};

describe('ClassicGame', () => {
  it('renders 9 cells', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    const cells = screen.getAllByRole('button', { name: /Row \d, Column \d/ });
    expect(cells.length).toBe(9);
  });

  it('all cells start as empty', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    const cells = screen.getAllByRole('button', { name: /empty/ });
    expect(cells.length).toBe(9);
  });

  it('clicking a cell places X', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    const cells = screen.getAllByRole('button', { name: /Row 1, Column 1/ });
    fireEvent.click(cells[0]);
    // After click, the cell should now show X
    expect(screen.getByRole('button', { name: /Row 1, Column 1, X/ })).toBeInTheDocument();
  });

  it('alternates turns after placing a mark', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    // Place X
    fireEvent.click(screen.getByRole('button', { name: /Row 1, Column 1, empty/ }));
    // Place O
    fireEvent.click(screen.getByRole('button', { name: /Row 1, Column 2, empty/ }));
    // Verify both marks placed
    expect(screen.getByRole('button', { name: /Row 1, Column 1, X/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Row 1, Column 2, O/ })).toBeInTheDocument();
  });

  it('prevents clicking an occupied cell', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    const cell = screen.getByRole('button', { name: /Row 1, Column 1, empty/ });
    fireEvent.click(cell);
    // Cell is now X and disabled
    const xCell = screen.getByRole('button', { name: /Row 1, Column 1, X/ });
    expect(xCell).toBeDisabled();
  });

  it('has an Abandon button', () => {
    const abandon = vi.fn();
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={abandon} />);
    const btn = screen.getByRole('button', { name: /Abandon/ });
    expect(btn).toBeInTheDocument();
  });

  it('has a grid with proper ARIA role', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    expect(screen.getByRole('grid', { name: /Classic Tic-Tac-Toe board/ })).toBeInTheDocument();
  });

  it('has a live region for announcements', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows win overlay when X wins', () => {
    render(<ClassicGame pX={pX} pO={pO} onEnd={noop} onAbandon={noop} />);
    // Play a winning sequence for X: top row
    // X at (0,0)
    fireEvent.click(screen.getByRole('button', { name: /Row 1, Column 1, empty/ }));
    // O at (1,0)
    fireEvent.click(screen.getByRole('button', { name: /Row 2, Column 1, empty/ }));
    // X at (0,1)
    fireEvent.click(screen.getByRole('button', { name: /Row 1, Column 2, empty/ }));
    // O at (2,0)
    fireEvent.click(screen.getByRole('button', { name: /Row 2, Column 2, empty/ }));
    // X at (0,2) — wins!
    fireEvent.click(screen.getByRole('button', { name: /Row 1, Column 3, empty/ }));

    expect(screen.getByText(/Alice Wins!/)).toBeInTheDocument();
  });
});
