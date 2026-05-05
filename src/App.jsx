import React, { useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NetworkProvider } from "./context/NetworkContext";
import ProtectedRoute from "./Components/ProtectedRoute";
import ScrollToTop from "./Components/Common/ScrollToTop";
import Loading from "./Components/Common/Loading";
import ElectronTitleBar from "./Components/ElectronTitleBar";
import { XCircle } from "lucide-react";
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


// Simple Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("React Error Boundary:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-10 text-center">
          <XCircle size={64} className="text-rose-500 mb-6" />
          <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">Algo salió mal</h1>
          <p className="text-slate-400 mb-4 max-w-md">La aplicación ha detectado un error técnico.</p>
          <div className="bg-white/5 p-4 rounded-xl mb-8 text-[10px] font-mono text-slate-500 max-w-lg overflow-auto">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.href = '#/'}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold transition-all"
          >
            Volver al Inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      document.title = "TENDO-POS";

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

  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      // Solo actuar si el usuario está autenticado y en la ruta de la tienda
      if (!user || !location.pathname.startsWith('/store')) return;

      // F1: Punto de Venta
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/store/ventas');
      }
      // F2: Clientes
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/store/manage-customers');
      }
      // F3: Catálogo / Productos
      if (e.key === 'F3') {
        e.preventDefault();
        navigate('/store/manage-product');
      }
      // F4: Inventario
      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/store/inventarios');
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [user, location.pathname, navigate]);


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
              <Route index element={<ProtectedRoute requiredPermission="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="add-product" element={<ProtectedRoute requiredPermission="inventario"><StoreAddProduct /></ProtectedRoute>} />
              <Route path="manage-product" element={<ProtectedRoute requiredPermission="inventario"><StoreManageProducts /></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute requiredPermission="ventas"><StoreOrders /></ProtectedRoute>} />
              <Route path="compras" element={<ProtectedRoute requiredPermission="ventas"><RegistrarCompras /></ProtectedRoute>} />
              <Route path="ventas" element={<ProtectedRoute requiredPermission="ventas"><RegistrarVentas /></ProtectedRoute>} />
              <Route path="inventarios" element={<ProtectedRoute requiredPermission="ventas"><Inventario /></ProtectedRoute>} />
              <Route path="manage-suppliers" element={<ProtectedRoute requiredPermission="inventario"><StoreManageSuppliers /></ProtectedRoute>} />
              <Route path="manage-customers" element={<ProtectedRoute requiredPermission="clientes"><ManageCustomers /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute requiredPermission="usuarios"><ManageUsers /></ProtectedRoute>} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="settings" element={<ProtectedRoute requiredPermission="configuracion"><StoreSettings /></ProtectedRoute>} />
              <Route path="corte-caja" element={<ProtectedRoute requiredPermission="ventas"><CorteCaja /></ProtectedRoute>} />
              <Route path="tiendas" element={<ProtectedRoute requiredPermission="tiendas"><ManageTiendas /></ProtectedRoute>} />
              <Route path="promociones" element={<ProtectedRoute requiredPermission="configuracion"><ManagePromociones /></ProtectedRoute>} />
              <Route path="gastos" element={<ProtectedRoute requiredPermission="gastos"><ManageGastos /></ProtectedRoute>} />
              <Route path="history" element={<ProtectedRoute requiredPermission="ventas"><MovementHistory /></ProtectedRoute>} />
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
          <NetworkProvider>
            <ErrorBoundary>
              <ElectronTitleBar />
              <AppContent />
            </ErrorBoundary>
          </NetworkProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
