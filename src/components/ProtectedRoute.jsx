import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="ai-thinking"><span>Loading</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return children;
}
