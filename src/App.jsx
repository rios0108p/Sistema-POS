import { useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./Components/ProtectedRoute";
import ScrollToTop from "./Components/Common/ScrollToTop";
import Loading from "./Components/Common/Loading";
import Login from "./Pages/Login"; // Keep Login static for faster initial render

// Lazy Imports for Code Splitting
const StoreLayout = lazy(() => import("./store/StoreLayout"));
const Dashboard = lazy(() => import("./store/Dashboard"));
const StoreAddProduct = lazy(() => import("./store/StoreAddProduct"));
const StoreManageProducts = lazy(() => import("./store/StoreManageProducts"));
const StoreOrders = lazy(() => import("./store/StoreOrders"));
const RegistrarCompras = lazy(() => import("./store/RegistrarCompras"));
const RegistrarVentas = lazy(() => import("./store/RegistrarVentas"));
const Inventario = lazy(() => import("./store/Inventario"));
const StoreManageSuppliers = lazy(() => import("./store/StoreManageSuppliers"));
const ManageCustomers = lazy(() => import("./store/ManageCustomers"));
const ManageUsers = lazy(() => import("./store/ManageUsers"));
const ProfileSettings = lazy(() => import("./store/ProfileSettings"));
const StoreSettings = lazy(() => import("./store/StoreSettings"));
const CorteCaja = lazy(() => import("./store/CorteCaja"));
const ManageTiendas = lazy(() => import("./store/ManageTiendas"));
const MovementHistory = lazy(() => import("./store/MovementHistory"));
const ManagePromociones = lazy(() => import("./store/ManagePromociones"));
const ManageGastos = lazy(() => import("./store/ManageGastos"));


function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { storeConfig, user, loading } = useAuth();

  // Detección robusta de Electron
  const isElectron = navigator.userAgent.toLowerCase().includes('electron');

  useEffect(() => {
    // No redirigir mientras se está cargando la sesión inicial
    if (loading) return;

    // Si no hay usuario y no estamos en login, redirigir a login
    if (!user && location.pathname !== '/' && location.pathname !== '/login') {
      navigate('/', { replace: true });
    }

    if (storeConfig) {
      document.title = storeConfig.nombre_tienda || "Sistema POS";

      // Update favicon
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = storeConfig.logoUrl || "/favicon.ico";
    }
  }, [storeConfig, user, location.pathname]);


  return (
    <>
      <ScrollToTop />
      <Toaster position="top-right" />
      <main>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Ruta principal es el Login */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />

            {/* Redirigir cualquier ruta no encontrada al login o al store si está autenticado */}
            <Route path="*" element={<Navigate to={user ? "/store" : "/"} replace />} />

            {/* Rutas del sistema POS */}
            <Route path="/store" element={<ProtectedRoute><StoreLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="add-product" element={<ProtectedRoute allowedRoles={['admin']}><StoreAddProduct /></ProtectedRoute>} />
              <Route path="manage-product" element={<ProtectedRoute allowedRoles={['admin']}><StoreManageProducts /></ProtectedRoute>} />
              <Route path="orders" element={<StoreOrders />} />
              <Route path="compras" element={<ProtectedRoute allowedRoles={['admin', 'vendedor']}><RegistrarCompras /></ProtectedRoute>} />
              <Route path="ventas" element={<RegistrarVentas />} />
              <Route path="inventarios" element={<Inventario />} />
              <Route path="manage-suppliers" element={<ProtectedRoute allowedRoles={['admin']}><StoreManageSuppliers /></ProtectedRoute>} />
              <Route path="manage-customers" element={<ManageCustomers />} />
              <Route path="users" element={<ProtectedRoute allowedRoles={['admin']}><ManageUsers /></ProtectedRoute>} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><StoreSettings /></ProtectedRoute>} />
              <Route path="corte-caja" element={<ProtectedRoute allowedRoles={['admin']}><CorteCaja /></ProtectedRoute>} />
              <Route path="tiendas" element={<ProtectedRoute allowedRoles={['admin']}><ManageTiendas /></ProtectedRoute>} />
              <Route path="promociones" element={<ProtectedRoute allowedRoles={['admin']}><ManagePromociones /></ProtectedRoute>} />
              <Route path="gastos" element={<ProtectedRoute allowedRoles={['admin']}><ManageGastos /></ProtectedRoute>} />
              <Route path="history" element={<ProtectedRoute allowedRoles={['admin', 'vendedor']}><MovementHistory /></ProtectedRoute>} />
            </Route>
          </Routes>
        </Suspense>
      </main>
    </>
  );
}


function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
