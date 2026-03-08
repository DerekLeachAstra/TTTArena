import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditModal from '../components/manage/EditModal';

// Mock useFocusTrap to return a simple ref
vi.mock('../hooks/useFocusTrap', () => ({
  default: () => ({ current: null }),
}));

const basePlayer = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Smith',
  nickname: 'Ace',
  cw: 5, cl: 3, ct: 1,
  sw: 10, sl: 2, st: 0,
  mw: 1, ml: 0, mt: 0,
};

const noop = () => {};

describe('EditModal', () => {
  it('renders with player data', () => {
    render(<EditModal p={basePlayer} onSave={noop} onDel={noop} onClose={noop} />);
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ace')).toBeInTheDocument();
  });

  it('has a dialog role with aria-modal', () => {
    render(<EditModal p={basePlayer} onSave={noop} onDel={noop} onClose={noop} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('clamps negative stat values to 0', () => {
    render(<EditModal p={basePlayer} onSave={noop} onDel={noop} onClose={noop} />);
    // Find one of the W inputs (Classic W should be 5)
    const wInput = screen.getByDisplayValue('5');
    fireEvent.change(wInput, { target: { value: '-10' } });
    expect(wInput.value).toBe('0');
  });

  it('allows valid positive values', () => {
    render(<EditModal p={basePlayer} onSave={noop} onDel={noop} onClose={noop} />);
    const wInput = screen.getByDisplayValue('5');
    fireEvent.change(wInput, { target: { value: '20' } });
    expect(wInput.value).toBe('20');
  });

  it('calls onSave with updated player on Save', () => {
    const onSave = vi.fn();
    render(<EditModal p={basePlayer} onSave={onSave} onDel={noop} onClose={noop} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: 1, firstName: 'Alice' });
  });

  it('calls onClose on Cancel', () => {
    const onClose = vi.fn();
    render(<EditModal p={basePlayer} onSave={noop} onDel={noop} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDel with player id on Delete', () => {
    const onDel = vi.fn();
    render(<EditModal p={basePlayer} onSave={noop} onDel={onDel} onClose={noop} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDel).toHaveBeenCalledWith(1);
  });
});
