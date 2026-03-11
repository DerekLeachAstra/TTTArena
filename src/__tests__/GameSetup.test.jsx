import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameSetup from '../components/games/GameSetup';

const players = [
  { id: 1, firstName: 'Alice', lastName: 'A', nickname: '' },
  { id: 2, firstName: 'Bob', lastName: 'B', nickname: 'TheBob' },
];

describe('GameSetup', () => {
  it('renders mode title for classic', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} />);
    expect(screen.getByText('Classic Tic-Tac-Toe')).toBeInTheDocument();
  });

  it('renders mode title for ultimate', () => {
    render(<GameSetup players={players} mode="ultimate" onStart={() => {}} onStartAI={() => {}} />);
    expect(screen.getByText('Ultimate Tic-Tac-Toe')).toBeInTheDocument();
  });

  it('renders mode title for mega', () => {
    render(<GameSetup players={players} mode="mega" onStart={() => {}} onStartAI={() => {}} />);
    expect(screen.getByText('MEGA Tic-Tac-Toe')).toBeInTheDocument();
  });

  it('shows AI tab by default', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} />);
    expect(screen.getByText('Select Difficulty')).toBeInTheDocument();
  });

  it('shows 4 difficulty buttons in AI mode', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} />);
    expect(screen.getByText('easy')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('hard')).toBeInTheDocument();
    expect(screen.getByText(/unbeatable/)).toBeInTheDocument();
  });

  it('calls onStartAI with difficulty when clicked', () => {
    const onStartAI = vi.fn();
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={onStartAI} />);
    fireEvent.click(screen.getByText('easy'));
    expect(onStartAI).toHaveBeenCalledWith('easy');
  });

  it('switches to Local Play tab', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} />);
    fireEvent.click(screen.getByText('Local Play'));
    // Should show guest player name inputs
    expect(screen.getByPlaceholderText('Player X')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Player O')).toBeInTheDocument();
  });

  it('shows Ranked badge when authenticated', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} isAuthenticated={true} />);
    expect(screen.getByText('Ranked')).toBeInTheDocument();
  });

  it('does not show Ranked badge when not authenticated', () => {
    render(<GameSetup players={players} mode="classic" onStart={() => {}} onStartAI={() => {}} isAuthenticated={false} />);
    expect(screen.queryByText('Ranked')).not.toBeInTheDocument();
  });
});
