import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

// Like AdminRoute, but for routes more than one role should reach (e.g. the
// audit log, which HR can also see, not just Admin). AdminRoute is kept as
// its own component rather than rewritten in terms of this one, since it's
// simpler to read at a glance for the admin-only case.
const RoleRoute = ({ allow }: { allow: UserRole[] }) => {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export default RoleRoute;