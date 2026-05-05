import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SellerNavbar from "./StoreNavbar";
import SellerSidebar from "./StoreSidebar";
import ElectronTitleBar from "../Components/ElectronTitleBar";

const StoreLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const location = useLocation();
  const isElectron = !!window.electronAPI?.isDesktop;
  // Fix #43: Account for title bar height in Electron
  const titleBarHeight = isElectron ? 32 : 0;
  const navbarHeight = 84;
  const contentOffset = titleBarHeight + navbarHeight;

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  // Fix #49: Make window width reactive
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // AUTOMATIC MODAL DETECTION (Professional Blur System)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      const hasModal = document.querySelector('.modal-overlay') || 
                       document.querySelector('[role="dialog"]') ||
                       document.querySelector('.fixed.inset-0.z-\\[1000\\]'); // Specific to POS arqueo
      
      if (hasModal) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-open');
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 transition-colors duration-500 overflow-hidden">
      {/* Electron Title Bar removed here - already rendered in App.jsx root */}
      
      {/* Header should also blur if requested */}
      <div className="layout-content-wrapper z-40">
        <SellerNavbar 
          onMenuToggle={() => {
            if (windowWidth >= 1024) {
              setIsCollapsed(!isCollapsed);
            } else {
              setSidebarOpen(!sidebarOpen);
            }
          }} 
          sidebarOpen={sidebarOpen} 
          isCollapsed={isCollapsed}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar with Transition */}
        <motion.div 
          initial={false}
          animate={{ 
            width: isCollapsed ? 84 : 280,
            x: (windowWidth < 1024 && !sidebarOpen) ? -300 : 0,
            opacity: (windowWidth < 1024 && !sidebarOpen) ? 0 : 1
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800
            layout-content-wrapper border-none
          `}
          style={{ height: `calc(100vh - ${contentOffset}px)`, top: `${contentOffset}px` }}
        >
          <SellerSidebar 
            onClose={() => setSidebarOpen(false)} 
            isCollapsed={isCollapsed} 
          />
        </motion.div>

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

