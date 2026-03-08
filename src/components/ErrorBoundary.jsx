import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#e0e0e0',
          fontFamily: "'DM Sans', sans-serif",
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
          }}>
            &#9888;
          </div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 8,
            color: '#fff',
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: 14,
            color: '#888',
            maxWidth: 420,
            marginBottom: 24,
            lineHeight: 1.5,
          }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #6c5ce7)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: 24,
              padding: 16,
              background: '#1a1a2e',
              borderRadius: 8,
              fontSize: 12,
              color: '#f87171',
              maxWidth: '80vw',
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
