import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Common/Loading';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <Loading />;

    if (!user) {
        // Redirigir al login si no está autenticado
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
        // Redirigir si no tiene el rol permitido (ej: ir al dashboard principal)
        return <Navigate to="/store" replace />;
    }

    return children;
};

export default ProtectedRoute;
