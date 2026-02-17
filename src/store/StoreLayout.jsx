import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import SellerNavbar from "./StoreNavbar";
import SellerSidebar from "./StoreSidebar";

const StoreLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 transition-colors duration-500 overflow-hidden">
      <SellerNavbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 h-[calc(100vh-84px)]
          transform transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          lg:transform-none
          ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:translate-x-0 opacity-100'}
        `}>
          <SellerSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-500 custom-scrollbar relative">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

          <div className={`${location.pathname.includes('/store/ventas') ? 'p-0' : 'p-4 sm:p-6 lg:p-8'} min-h-full ${location.pathname.includes('/store/ventas') ? 'max-w-none' : 'max-w-[1600px]'} mx-auto relative z-10`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default StoreLayout;
