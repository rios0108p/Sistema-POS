import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Package, Users, ShoppingCart, FileText, ArrowRight } from "lucide-react";
import { productosAPI, clientesAPI } from "../services/api";

const GlobalSearch = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState({ products: [], customers: [] });
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Keyboard shortcut (Ctrl+K or Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Search functionality
    useEffect(() => {
        if (!query.trim()) {
            setResults({ products: [], customers: [] });
            return;
        }

        const searchTimeout = setTimeout(async () => {
            setLoading(true);
            try {
                const [productsRes, customersRes] = await Promise.all([
                    productosAPI.getAll().catch(() => []),
                    clientesAPI.getAll().catch(() => [])
                ]);

                const q = query.toLowerCase();

                const filteredProducts = (productsRes || [])
                    .filter(p => p && (p.nombre?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)))
                    .slice(0, 5);

                const filteredCustomers = (customersRes || [])
                    .filter(c => c && (c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q)))
                    .slice(0, 3);

                setResults({
                    products: Array.isArray(filteredProducts) ? filteredProducts : [],
                    customers: Array.isArray(filteredCustomers) ? filteredCustomers : []
                });
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [query]);

    const handleSelect = (type, item) => {
        setIsOpen(false);
        setQuery("");

        switch (type) {
            case "product":
                navigate(`/store/manage-product?search=${item.nombre}`);
                break;
            case "customer":
                navigate(`/store/manage-customers?search=${item.nombre}`);
                break;
            default:
                break;
        }
    };

    const quickLinks = [
        { label: "Nueva Venta", path: "/store/ventas", icon: ShoppingCart },
        { label: "Agregar Producto", path: "/store/add-product", icon: Package },
        { label: "Ver Inventario", path: "/store/inventarios", icon: FileText },
        { label: "Gestionar Clientes", path: "/store/manage-customers", icon: Users },
    ];

    return (
        <>
            {/* Search trigger button */}
            <button
                onClick={() => setIsOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
                <Search size={16} />
                <span className="hidden md:inline">Buscar...</span>
                <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] font-mono bg-slate-200 dark:bg-slate-600 rounded">
                    Ctrl+K
                </kbd>
            </button>

            {/* Mobile search icon */}
            <button
                onClick={() => setIsOpen(true)}
                className="sm:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
                <Search size={20} className="text-slate-500 dark:text-slate-400" />
            </button>

            {/* Search modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                    {/* Search container */}
                    <div
                        ref={containerRef}
                        className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                        {/* Input area */}
                        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                            <Search size={20} className="text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar productos, clientes..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 text-lg placeholder-slate-400 outline-none"
                            />
                            {query && (
                                <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700"
                            >
                                ESC
                            </button>
                        </div>

                        {/* Results area */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {loading && (
                                <div className="p-8 text-center text-slate-400">
                                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                                    <p className="mt-2 text-sm">Buscando...</p>
                                </div>
                            )}

                            {!loading && query && results.products.length === 0 && results.customers.length === 0 && (
                                <div className="p-8 text-center text-slate-400">
                                    <Search size={40} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">No se encontraron resultados para "{query}"</p>
                                </div>
                            )}

                            {/* Products */}
                            {results.products.length > 0 && (
                                <div className="p-2">
                                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Productos
                                    </p>
                                    {results.products.map((product) => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleSelect("product", product)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                <Package size={18} className="text-indigo-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                                    {product.nombre}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    SKU: {product.sku || 'N/A'} • Stock: {product.cantidad || 0}
                                                </p>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Customers */}
                            {results.customers.length > 0 && (
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Clientes
                                    </p>
                                    {results.customers.map((customer) => (
                                        <button
                                            key={customer.id}
                                            onClick={() => handleSelect("customer", customer)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                <Users size={18} className="text-emerald-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                                    {customer.nombre}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {customer.telefono || customer.email || 'Sin contacto'}
                                                </p>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Quick links when no query */}
                            {!query && (
                                <div className="p-2">
                                    <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Accesos Rápidos
                                    </p>
                                    {quickLinks.map((link, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { navigate(link.path); setIsOpen(false); }}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                <link.icon size={18} className="text-slate-500" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {link.label}
                                            </span>
                                            <ArrowRight size={16} className="text-slate-300 ml-auto" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalSearch;
