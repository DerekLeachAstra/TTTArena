import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Confirm from '../components/ui/Confirm';

// Mock useFocusTrap to return a simple ref
vi.mock('../hooks/useFocusTrap', () => ({
  default: () => ({ current: null }),
}));

const noop = () => {};

describe('Confirm', () => {
  it('has alertdialog role with aria-modal', () => {
    render(<Confirm title="Delete?" msg="This cannot be undone." onConfirm={noop} onCancel={noop} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby and aria-describedby', () => {
    render(<Confirm title="Delete?" msg="This cannot be undone." onConfirm={noop} onCancel={noop} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-msg');
  });

  it('displays title and message', () => {
    render(<Confirm title="Delete?" msg="This cannot be undone." onConfirm={noop} onCancel={noop} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<Confirm title="Delete?" msg="Sure?" onConfirm={noop} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<Confirm title="Delete?" msg="Sure?" onConfirm={onConfirm} onCancel={noop} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(<Confirm title="Delete?" msg="Sure?" onConfirm={noop} onCancel={onCancel} />);
    // Click the outer overlay div (first child of container)
    fireEvent.click(container.firstChild);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
