import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Predictions from './pages/Predictions';
import Approvals from './pages/Approvals';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Recruitment from './pages/Recruitment';
import ModelInsights from './pages/ModelInsights';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import RoleRoute from './components/RoleRoute';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/predictions" element={<Predictions />} />
                <Route path="/model-insights" element={<ModelInsights />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route element={<RoleRoute allow={['admin', 'hr']} />}>
                  <Route path="/audit-log" element={<AuditLog />} />
                  <Route path="/recruitment" element={<Recruitment />} />
                </Route>
                <Route element={<AdminRoute />}>
                  <Route path="/users" element={<Users />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;