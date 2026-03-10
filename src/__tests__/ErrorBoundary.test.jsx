import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Suppress error boundary console.error noise
const originalError = console.error;
beforeEach(() => { console.error = vi.fn(); });
afterEach(() => { console.error = originalError; });

function ThrowingComponent() {
  throw new Error('Test explosion');
}

function SafeComponent() {
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText(/Refresh Page/)).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    // Should show the error message in a <pre> block
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
    process.env.NODE_ENV = origEnv;
  });
});
