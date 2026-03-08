import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WinProbabilityBar from '../components/WinProbabilityBar';

describe('WinProbabilityBar', () => {
  it('renders player names', () => {
    render(<WinProbabilityBar xPct={60} oPct={40} xName="Alice" oName="Bob" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders "Win Probability" label', () => {
    render(<WinProbabilityBar xPct={50} oPct={50} xName="X" oName="O" />);
    expect(screen.getByText('Win Probability')).toBeInTheDocument();
  });

  it('defaults names to X and O when not provided', () => {
    render(<WinProbabilityBar xPct={50} oPct={50} />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
  });
});
