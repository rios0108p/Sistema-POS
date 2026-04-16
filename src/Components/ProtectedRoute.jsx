import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Common/Loading';

const ProtectedRoute = ({ children, allowedRoles = [], requiredPermission = null }) => {
    const { user, loading, hasPermission } = useAuth();
    const location = useLocation();

    if (loading) return <Loading />;

    if (!user) {
        // Redirigir al login si no está autenticado
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
        // Redirigir al dashboard si no tiene el rol, o al login si algo falla
        return <Navigate to="/store" replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        // Si no tiene permiso para la ruta actual, redirigir a la primera ruta permitida
        if (hasPermission('ventas')) return <Navigate to="/store/ventas" replace />;
        if (hasPermission('inventario')) return <Navigate to="/store/manage-product" replace />;
        
        if (location.pathname === '/store') {
             return <Navigate to="/login" replace />;
        }
        return <Navigate to="/store" replace />;
    }

    return children;
};

export default ProtectedRoute;
