import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { productosAPI, ventasAPI, clientesAPI, turnosAPI, tiendasAPI, movimientosAPI, promocionesAPI } from "../services/api";
import { toast } from "react-hot-toast";
import { CURRENCY_SYMBOL } from "../utils/currency";
import { useAuth } from "../context/AuthContext";
import {
  Trash, Trash2, ShoppingCart, User, Plus, Minus, History, Store,
  FileText, Pause, Play, AlertCircle, Save, Search, Package, Tag,
  Clock, DollarSign, X, Ban, CreditCard, RefreshCcw, TrendingUp, TrendingDown,
  Printer, Zap, XCircle
} from "lucide-react";
import PaymentModal from "./components/PaymentModal";
import QuickClientModal from "./components/QuickClientModal";
import PinValidationModal from "./components/PinValidationModal";
import { printTicket } from "../utils/printUtils";
import { configuracionAPI, dashboardAPI } from "../services/api";
import { useOfflineSync } from "../hooks/useOfflineSync"; // New Import

const RegistrarVentas = () => {
  // --- Auth & Router ---
  const { user, turnoActivo, updateTurnoActivo, logout, storeConfig } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isOnline, saveToQueue, pendingSales, isSyncing } = useOfflineSync();

  // --- Constants ---
  const currency = storeConfig?.moneda || '$';

  // --- Tabs ---
  // POS = Venta Normal, HISTORY = Historial, SUSPENDED = Ventas en espera
  const [activeTab, setActiveTab] = useState('POS');

  // --- Data ---
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]); // Historial
  const [cotizaciones, setCotizaciones] = useState([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState({}); // { productoId: precio }

  // --- POS State ---
  const [cart, setCart] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  // Selection for Variations
  const [prodSeleccionado, setProdSeleccionado] = useState(null); // Modal/Area para seleccionar variacion

  // Sale details
  const [clienteId, setClienteId] = useState("");
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [notas, setNotas] = useState("");

  // Suspended Carts
  const [ventasSuspendidas, setVentasSuspendidas] = useState([]);

  // --- Turno/Shift State ---
  const [turnoDetalleRaw, setTurnoDetalleRaw] = useState(null);
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [montoTurno, setMontoTurno] = useState("");

  // --- Modals State ---
  const [showPayment, setShowPayment] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [nextTicketNo, setNextTicketNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [topProductos, setTopProductos] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [selectedTiendaId, setSelectedTiendaId] = useState(user?.tienda_id || "");
  const [promociones, setPromociones] = useState([]);

  // --- Cash Count (Arqueo) ---
  const [conteoEfectivo, setConteoEfectivo] = useState({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, monedas: 0
  });

  // --- Security PIN ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'CANCEL_SALE', id: 123 }

  // --- Refs ---
  const searchInputRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    loadData();
    loadTurnoActivo();
    const suspended = localStorage.getItem('ventas_suspendidas');
    if (suspended) setVentasSuspendidas(JSON.parse(suspended));

    // Handle automated corte request from sidebar
    if (searchParams.get('openCorte') === 'true') {
      setShowTurnoModal(true);
      loadTurnoActivo();
      // Limpiar el parámetro para permitir re-activación desde el sidebar
      setSearchParams({}, { replace: true });
    }

    // Load top selling products for quick access
    dashboardAPI.getStats('month', selectedTiendaId)
      .then(data => {
        if (data.topProductos) setTopProductos(data.topProductos);
      })
      .catch(err => console.error("Error loading top products:", err));
  }, [searchParams, selectedTiendaId]);

  const loadTurnoActivo = async () => {
    try {
      const turno = await turnosAPI.getActivo(user?.id);
      updateTurnoActivo(turno);
      if (turno) {
        // Fetch detailed breakdown for the active shift
        const detail = await turnosAPI.getById(turno.id);
        setTurnoDetalleRaw(detail);
      } else {
        setTurnoDetalleRaw(null);
        // ADMIN AUTO-SHIFT logic
        if (user?.rol === 'admin') {
          handleAutoOpenShift();
        }
      }
    } catch (error) {
      console.log("No hay turno activo");
      updateTurnoActivo(null);
      setTurnoDetalleRaw(null);
      if (user?.rol === 'admin') {
        handleAutoOpenShift();
      }
    }
  };

  const handleAutoOpenShift = async () => {
    try {
      // Auto-open with 500 base
      const res = await turnosAPI.abrir({
        usuario_id: user.id,
        tienda_id: selectedTiendaId || user.tienda_id,
        monto_inicial: 500
      });
      toast.success("Turno Administrador abierto automáticamente ($500)");
      loadTurnoActivo();
    } catch (err) {
      console.error("Auto-shift error:", err);
    }
  };

  // --- Hotkeys ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F1-F4: Tab Switching
      if (e.key === 'F1') { e.preventDefault(); setActiveTab('POS'); }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('POS'); setTimeout(() => searchInputRef.current?.focus(), 50); }
      if (e.key === 'F4') { e.preventDefault(); setActiveTab('HISTORY'); }

      // F5: Reload Data
      if (e.key === 'F5') { e.preventDefault(); loadData(); toast.success("Datos actualizados"); }

      // F6: Focus Client Selector (We'll need a ref for this or just show modal)
      if (e.key === 'F6') { e.preventDefault(); setShowQuickClient(true); }

      // F7: Focus Search (Alternative to F2)
      if (e.key === 'F7') { e.preventDefault(); searchInputRef.current?.focus(); }

      // F8: Focus Discount/Notes (Quick Access)
      if (e.key === 'F8') {
        e.preventDefault();
        // Assuming we have refs for these or just document behavior
        // We can't easily focus controlled inputs without refs, but we can set activeTab or similar
        toast('F8: Atajo reservado (Futuro)');
      }

      // F9/F10: Pay
      if (e.key === 'F9' || e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      }
      // Esc: Cancel / Close Modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showPayment) setShowPayment(false);
        else if (showQuickClient) setShowQuickClient(false);
        else if (prodSeleccionado) setProdSeleccionado(null);
        else if (busqueda) setBusqueda("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cart, showPayment, showQuickClient]);

  // --- Data Loading ---
  const loadData = async () => {
    try {
      // Load clients
      const clis = await clientesAPI.getAll();
      setClientes(Array.isArray(clis) ? clis : []);

      // Load stores if admin
      if (user?.rol === 'admin') {
        const allTiendas = await tiendasAPI.getAll();
        setTiendas(Array.isArray(allTiendas) ? allTiendas : []);
      }

      // 1. Cargar productos (Tienda o Global)
      let prods = [];
      if (selectedTiendaId) {
        const tiendaProductos = await tiendasAPI.getProductos(selectedTiendaId);
        prods = tiendaProductos.map(p => ({
          id: p.producto_id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio_venta: p.precio_venta,
          precio_compra: p.precio_compra,
          categoria: p.categoria,
          marca: p.marca,
          imagenes: p.imagenes,
          codigo_barras: p.codigo_barras,
          cantidad: p.cantidad,
          stock_minimo: p.stock_minimo,
          barcodes_agrupados: p.barcodes_agrupados || [],
          variaciones: p.variaciones || []
        }));
      } else {
        prods = await productosAPI.getAll();
      }
      setProductos(Array.isArray(prods) ? prods : []);

      // 2. Cargar Clientes y Promociones
      const [cli, promos] = await Promise.all([
        clientesAPI.getAll(),
        promocionesAPI.getAll(selectedTiendaId || "")
      ]);
      setClientes(cli);
      setPromociones(promos || []);

      // 3. Calcular Siguiente Ticket (sin sobrescribir el historial visual)
      const hist = await ventasAPI.getAll({ tienda_id: selectedTiendaId });
      if (turnoActivo) {
        const shiftSales = Array.isArray(hist) ? hist.filter(v => v.turno_id === turnoActivo.id) : [];
        const maxTicket = shiftSales.reduce((max, v) => (v.ticket_numero > max ? v.ticket_numero : max), 0);
        setNextTicketNo(maxTicket + 1);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos iniciales");
    }
  };

  const fetchNextTicket = async () => {
    if (!turnoActivo) return;
    try {
      const history = await ventasAPI.getAll({ tienda_id: selectedTiendaId });
      const shiftSales = history.filter(v => v.turno_id === turnoActivo.id);
      const maxTicket = shiftSales.reduce((max, v) => (v.ticket_numero > max ? v.ticket_numero : max), 0);
      setNextTicketNo(maxTicket + 1);
    } catch (error) {
      console.error("Error al obtener el siguiente ticket:", error);
    }
  };

  const loadHistory = async () => {
    try {
      // Fetch movements (Ventas + Compras) for current shift/store, isolated by user for POS
      const movimientosData = await movimientosAPI.getAll("", "", selectedTiendaId, "", user?.id);

      // Fetch quotes separately as they are special
      const allVentasQuotes = await ventasAPI.getAll();
      const cotizacionesData = allVentasQuotes.filter(v => v.tipo === 'COTIZACION');

      // Filter movements for the active shift
      // REGRE-REQ: Only show history if a shift is active. If shift closed, history should be empty for POS.
      if (turnoActivo?.id) {
        setVentas(movimientosData.filter(m => m.turno_id === turnoActivo.id));
      } else {
        setVentas([]); // Cleanup: no shift, no history in POS tab
      }
      setCotizaciones(cotizacionesData);
    } catch (error) {
      console.log("Error loading POS history:", error);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY' || activeTab === 'QUOTES') loadHistory();
  }, [activeTab, selectedTiendaId, turnoActivo]);

  // Handle customer special prices
  useEffect(() => {
    if (clienteId) {
      clientesAPI.getPreciosEspeciales(clienteId)
        .then(data => {
          const mapping = {};
          data.forEach(p => {
            mapping[p.producto_id] = {
              precio: Number(p.precio_especial),
              min_cantidad: Number(p.min_cantidad || 1)
            };
          });
          setPreciosEspeciales(mapping);

          // Update cart prices if they already have items
          if (cart.length > 0) {
            setCart(prev => prev.map(item => {
              const rule = mapping[item.id];
              // Strict multiple rule: qty must be >= min AND a perfect multiple
              if (rule && item.cantidad >= rule.min_cantidad && item.cantidad % rule.min_cantidad === 0) {
                return { ...item, precio: rule.precio, isWholesale: true };
              }
              // If no special price or condition not met, find original product price
              const prod = productos.find(p => p.id === item.id);
              if (prod) {
                const regularPrice = prod.precio_oferta || prod.precio_venta;
                return { ...item, precio: Number(regularPrice), isWholesale: false };
              }
              return item;
            }));
          }
        })
        .catch(err => {
          console.error("Error loading special prices:", err);
          setPreciosEspeciales({});
        });
    } else {
      setPreciosEspeciales({});
      // Reset cart to regular prices if customer is cleared
      if (cart.length > 0) {
        setCart(prev => prev.map(item => {
          const prod = productos.find(p => p.id === item.id);
          if (prod) {
            const regularPrice = prod.precio_oferta || prod.precio_venta;
            return { ...item, precio: Number(regularPrice) };
          }
          return item;
        }));
      }
    }
  }, [clienteId, productos]);

  useEffect(() => {
    loadData();
  }, [selectedTiendaId]);

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    if (activeTab !== 'POS' || !queryBusqueda) return;

    // Search for exact barcode match OR check in grouped barcodes
    const match = productos.find(p =>
      p.codigo_barras === queryBusqueda ||
      (p.barcodes_agrupados && p.barcodes_agrupados.includes(queryBusqueda))
    );

    if (match) {
      if (!match.variaciones || match.variaciones.length === 0) {
        agregarAlCarrito(match, null, cantidadBusqueda);
        setBusqueda(""); // Clear search immediately
        toast.success(`${match.nombre} añadido`);
      } else {
        // If it has variations, we might need to show the selection modal
        setProdSeleccionado(match);
        setBusqueda("");
      }
    }
  }, [busqueda, productos, activeTab]);

  // --- Cart Logic ---
  const getPrecioProducto = (p, currentQty = 1) => {
    const special = preciosEspeciales[p.id];
    const originalPrice = p.precio_venta;
    const globalOffer = p.precio_oferta;

    // Strict multiple rule: qty must be a multiple of min_cantidad (e.g., 24, 48...)
    if (special && currentQty >= special.min_cantidad && currentQty % special.min_cantidad === 0) {
      return {
        precio: Number(special.precio),
        isWholesale: true,
        originalPrice: originalPrice,
        isPromo: true
      };
    }

    // PRIORITY: Special Price (for this customer) vs Global Offer
    // If we have a special price but it's not a multiple, we might still use it if it's better or defined.
    // However, user specifically mentioned that special prices (mayoreo) were being ignored in favor of global offer.

    let finalPrice = originalPrice;
    let isPromo = false;

    if (globalOffer && globalOffer > 0) {
      finalPrice = globalOffer;
      isPromo = true;
    }

    // IF CUSTOMER HAS A SPECIAL PRICE, only apply if threshold met
    if (special && special.precio > 0 && currentQty >= (special.min_cantidad || 1)) {
      finalPrice = special.precio;
      return {
        precio: Number(finalPrice),
        isWholesale: false,
        originalPrice: originalPrice,
        isPromo: true,
        promoLabel: 'PROMO CLIENTE'
      };
    }

    return {
      precio: Number(finalPrice),
      isWholesale: false,
      originalPrice: originalPrice,
      isPromo: isPromo,
      promoLabel: 'PROMO'
    };
  };

  const agregarPromoAlCarrito = (promo) => {
    if (!turnoActivo) return toast.error("Abre un turno para registrar ventas");

    // VALIDATE STOCK FOR ALL ITEMS IN COMBO
    for (const item of promo.productos) {
      const prodData = productos.find(p => Number(p.id) === Number(item.producto_id));
      if (!prodData) {
        toast.error(`Producto "${item.nombre}" no encontrado`);
        return;
      }

      const stockDisponible = prodData.cantidad;

      const alreadyInCart = cart.reduce((acc, cItem) => {
        if (Number(cItem.id) === Number(item.producto_id) && !cItem.isCombo) return acc + cItem.cantidad;
        if (cItem.isCombo) {
          const comboSubItem = cItem.items.find(si => Number(si.id) === Number(item.producto_id));
          if (comboSubItem) return acc + (comboSubItem.cantidad * cItem.cantidad);
        }
        return acc;
      }, 0);

      if (alreadyInCart + item.cantidad > stockDisponible) {
        toast.error(`Stock insuficiente para "${item.nombre}". Disponible: ${stockDisponible}, En Carrito (incl. combos): ${alreadyInCart}`);
        return;
      }
    }

    const comboItem = {
      tempId: `combo-${promo.id}-${Date.now()}`,
      id: null,
      nombre: `COMBO: ${promo.nombre}`,
      cantidad: 1,
      precio: Number(promo.precio_combo),
      isCombo: true,
      promoId: promo.id,
      items: promo.productos.map(p => ({
        id: p.producto_id,
        nombre: p.nombre,
        cantidad: p.cantidad
      }))
    };

    setCart(prev => [...prev, comboItem]);
    toast.success(`Combo "${promo.nombre}" agregado`);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const agregarAlCarrito = (producto, variacion = null, cantidad = 1) => {
    const stock = variacion ? variacion.stock : producto.cantidad;

    if (stock <= 0) {
      toast.error(`"${producto.nombre}" está AGOTADO`);
      return;
    }

    const itemsExistentes = cart.filter(i => i.id === producto.id && i.variacion_id === (variacion?.id || null) && !i.isCombo);
    const cantidadTotalExistente = itemsExistentes.reduce((acc, item) => acc + item.cantidad, 0);
    const nuevaCantidadTotal = cantidadTotalExistente + cantidad;

    if (nuevaCantidadTotal > stock) {
      toast.error(`Stock insuficiente. Disponible: ${stock}`);
      return;
    }

    // LÓGICA DE MAYOREO POR MÚLTIPLOS (SPLITTING)
    const special = preciosEspeciales[producto.id];
    let itemsToBeAdded = [];

    if (special) {
      const multiple = special.min_cantidad;
      const numMultiples = Math.floor(nuevaCantidadTotal / multiple);
      const remainder = nuevaCantidadTotal % multiple;

      if (numMultiples > 0) {
        itemsToBeAdded.push({
          tempId: `${producto.id}-${variacion?.id || 'base'}-whale`,
          id: producto.id,
          nombre: producto.nombre,
          variacion_id: variacion?.id || null,
          variacion_nombre: variacion?.nombre || null,
          cantidad: numMultiples * multiple,
          precio: Number(special.precio),
          isWholesale: true,
          stockMax: stock
        });
      }

      if (remainder > 0) {
        const { precio: regPrice } = getPrecioProducto(producto, remainder);
        itemsToBeAdded.push({
          tempId: `${producto.id}-${variacion?.id || 'base'}-reg`,
          id: producto.id,
          nombre: producto.nombre,
          variacion_id: variacion?.id || null,
          variacion_nombre: variacion?.nombre || null,
          cantidad: remainder,
          precio: regPrice,
          isWholesale: false,
          stockMax: stock
        });
      }
    } else {
      const { precio: regPrice } = getPrecioProducto(producto, nuevaCantidadTotal);
      itemsToBeAdded.push({
        tempId: `${producto.id}-${variacion?.id || 'base'}-reg`,
        id: producto.id,
        nombre: producto.nombre,
        variacion_id: variacion?.id || null,
        variacion_nombre: variacion?.nombre || null,
        cantidad: nuevaCantidadTotal,
        precio: regPrice,
        isWholesale: false,
        stockMax: stock
      });
    }

    setCart(prev => [
      ...prev.filter(i => !(i.id === producto.id && i.variacion_id === (variacion?.id || null) && !i.isCombo)),
      ...itemsToBeAdded
    ]);

    setBusqueda("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    setProdSeleccionado(null);
  };

  const updateCantidad = (tempId, delta) => {
    const item = cart.find(i => i.tempId === tempId);
    if (!item || item.isCombo) return;
    const prod = productos.find(p => p.id === item.id);
    if (!prod) return;
    agregarAlCarrito(prod, item.variacion_id ? { id: item.variacion_id, stock: item.stockMax, nombre: item.variacion_nombre } : null, delta);
  };

  const removeItem = (tempId) => {
    setCart(prev => prev.filter(i => i.tempId !== tempId));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.cantidad * item.precio), 0);
  const total = Math.max(0, subtotal - parseFloat(descuentoGlobal || 0));

  const handleSuspend = () => {
    if (cart.length === 0) return;
    const suspendida = {
      id: Date.now(),
      fecha: new Date().toLocaleString(),
      cart,
      clienteId,
      notas,
      total
    };
    const newList = [...ventasSuspendidas, suspendida];
    setVentasSuspendidas(newList);
    localStorage.setItem('ventas_suspendidas', JSON.stringify(newList));
    setCart([]);
    setClienteId("");
    setNotas("");
    setDescuentoGlobal(0);
    toast.success("Venta suspendida");
  };

  const handleResume = (susp, idx) => {
    setCart(susp.cart);
    setClienteId(susp.clienteId);
    setNotas(susp.notas);
    const newList = [...ventasSuspendidas];
    newList.splice(idx, 1);
    setVentasSuspendidas(newList);
    localStorage.setItem('ventas_suspendidas', JSON.stringify(newList));
    setActiveTab('POS');
    toast.success("Venta recuperada");
  };

  const handleConfirmPayment = async (pagos, shouldPrint = false) => {
    if (loading) return;
    setLoading(true);
    const isWholesaleApplied = cart.some(i => i.isWholesale);

    // Validation: Wholesale sales require a customer to be selected
    if (isWholesaleApplied && !clienteId) {
      toast.error("Debes seleccionar un cliente para ventas de mayoreo");
      setLoading(false);
      return;
    }

    try {
      console.log('=== VENTA DEBUG ===');
      console.log('clienteId raw:', clienteId);
      console.log('clienteId parsed:', clienteId ? parseInt(clienteId) : null);
      console.log('isWholesaleApplied:', isWholesaleApplied);
      console.log('==================');
      const payload = {
        cliente_id: clienteId ? parseInt(clienteId) : null,
        productos: cart.flatMap(item => {
          if (item.isCombo) {
            // Distribute price: Put the whole price on the first item, others 0
            return item.items.map((ci, idx) => ({
              id: ci.id,
              cantidad: ci.cantidad * item.cantidad,
              precio: idx === 0 ? (item.precio / ci.cantidad) : 0
            }));
          }
          return [{ id: item.id, variacion_id: item.variacion_id, cantidad: item.cantidad, precio: item.precio }];
        }),
        descuento_global: descuentoGlobal,
        pagos: pagos.map(p => ({
          metodo: p.metodo,
          monto: p.monto,
          monto_dolar: p.monto_dolar || 0,
          tipo_cambio: p.tipo_cambio || 1,
          referencia: p.referencia || ''
        })),
        notas: notas,
        tienda_id: selectedTiendaId,
        turno_id: turnoActivo?.id,
        usuario_id: user?.id,
        es_mayoreo: isWholesaleApplied,
        ticket_numero: nextTicketNo
      };

      let response;
      if (isOnline) {
        response = await ventasAPI.create(payload);
      } else {
        // Offline Mode
        await saveToQueue(payload);
        response = { id: `OFF-${Date.now()}` }; // ID Temporal para impresión
      }

      toast.success("¡Venta Exitosa!");

      // Optional Printing
      if (shouldPrint) {
        const clienteObj = clientes.find(c => c.id == clienteId);
        printTicket({
          tienda: storeConfig,
          venta: {
            id: response.id,
            subtotal: subtotal,
            descuento: descuentoGlobal,
            total: total
          },
          productos: cart,
          cliente: clienteObj,
          pagos: pagos
        });
      }

      // Reset
      setCart([]);
      setClienteId("");
      setDescuentoGlobal(0);
      setNotas("");
      setShowPayment(false);
      fetchNextTicket();
      loadData(); // Refresh stock
      loadTurnoActivo();

      // Prevention: Blur active element and focus search
      setTimeout(() => {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        searchInputRef.current?.focus();
      }, 300);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error al procesar venta");
    } finally {
      setLoading(false);
    }
  };

  // --- Turno Actions ---
  const handleAbrirTurno = async () => {
    try {
      const monto = parseFloat(montoTurno) || 0;
      await turnosAPI.abrir(monto, user?.username || 'Vendedor', user?.id, user?.tienda_id);
      toast.success("¡Turno abierto!");
      setShowTurnoModal(false);
      setMontoTurno("");
      loadTurnoActivo();
    } catch (error) {
      toast.error(error.message || "Error abriendo turno");
    }
  };

  const handleCerrarTurno = async (montoManual = null) => {
    if (!turnoActivo) return;
    try {
      const montoFinal = montoManual !== null ? parseFloat(montoManual) : parseFloat(montoTurno) || 0;
      const result = await turnosAPI.cerrar(turnoActivo.id, montoFinal, "");
      toast.success(`Turno cerrado. Diferencia: $${result.resumen.diferencia.toFixed(2)}`);
      setShowTurnoModal(false);
      setMontoTurno("");
      updateTurnoActivo(null);
      setTurnoDetalleRaw(null); // Reset detail

      // If we came from 'Corte and Logout' request, perform the logout now
      if (searchParams.get('openCorte') === 'true') {
        logout();
        navigate("/");
      }
    } catch (error) {
      toast.error(error.message || "Error cerrando turno");
    }
  };

  // --- Cancel Sale ---
  const handleCancelSale = (id) => {
    // Si no se requiere PIN globalmente, ejecutar directo
    if (storeConfig && storeConfig.requerir_pin === false) {
      executeCancelSale(id);
      return;
    }
    setPendingAction({ type: 'CANCEL_SALE', id });
    setShowPinModal(true);
  };

  const executeCancelSale = async (id) => {
    try {
      await ventasAPI.cancelar(id);
      toast.success("Venta cancelada, stock restaurado");
      loadHistory();
      loadData(); // Refresh stock
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePinSuccess = () => {
    if (pendingAction?.type === 'CANCEL_SALE') {
      executeCancelSale(pendingAction.id);
    }
    setPendingAction(null);
  };

  // --- Parse Quantity from Search (6*producto or *6 producto) ---
  const parseSearchQuantity = (searchText) => {
    // Pattern: number* or *number at start. Product part is now optional.
    const match = searchText.match(/^(\d+)\*(.*)$/) || searchText.match(/^\*(\d+)\s*(.*)$/);
    if (match) {
      return { cantidad: parseInt(match[1]), query: match[2].trim() };
    }
    return { cantidad: 1, query: searchText };
  };

  // --- Render Helpers ---
  const { cantidad: cantidadBusqueda, query: queryBusqueda } = parseSearchQuantity(busqueda);

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(queryBusqueda.toLowerCase())
  ).slice(0, 10); // Limit results for performance

  return (
    <div className="h-[calc(100vh-84px)] bg-slate-50/50 dark:bg-slate-900/50 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Top Toolbar - ULTRA COMPACTED */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-3 py-1.5 flex justify-between items-center shadow-sm z-10 transition-all">
        <div className="flex gap-2 items-center">
          {turnoActivo && (
            <div className="flex flex-col items-end mr-4 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5">Ticket Actual</span>
              <span className="text-sm font-black text-indigo-700 dark:text-indigo-400"># {nextTicketNo}</span>
            </div>
          )}
          {['POS', 'HISTORY'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`group px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center gap-3 transition-all duration-500 relative overflow-hidden
                                ${activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 ring-2 ring-indigo-500/20 scale-[1.02]'
                  : 'bg-white dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-900 shadow-sm'
                }`}
            >
              <div className="flex flex-col items-center relative z-10">
                <span className={`text-[7px] font-black tracking-widest mb-0.5 transition-colors ${activeTab === tab ? 'text-indigo-200' : 'text-indigo-500/60 group-hover:text-indigo-600'}`}>
                  {tab === 'POS' ? 'F1' : 'F4'}
                </span>
                {tab === 'POS' && <ShoppingCart size={15} strokeWidth={activeTab === tab ? 3 : 2.5} />}
                {tab === 'HISTORY' && <History size={15} strokeWidth={activeTab === tab ? 3 : 2.5} />}
              </div>
              <span className="font-black relative z-10">{tab === 'POS' ? 'Venta Directa' : 'Historial'}</span>

              {activeTab === tab && (
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 opacity-100"></div>
              )}
            </button>
          ))}
        </div>


        <div className="flex items-center gap-3">
          {/* Offline Status */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${isOnline
            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
            : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800'
            }`}>
            {isSyncing ? (
              <RefreshCcw size={12} className="animate-spin" />
            ) : (
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
            )}
            <span className="text-[9px] font-black uppercase tracking-widest hidden lg:inline">
              {isSyncing ? 'SINCRONIZANDO...' : (isOnline ? 'ONLINE' : 'MODO OFFLINE')}
            </span>
            {pendingSales.length > 0 && (
              <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md ml-1" title="Ventas pendientes de subir">
                {pendingSales.length}
              </span>
            )}
          </div>

          {/* Store Selector for Admin */}
          {user?.rol === 'admin' && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800/80 px-4 py-2 rounded-2xl shadow-sm transition-all group">
              <Store size={14} className="text-indigo-500" />
              <select
                className="appearance-none bg-transparent text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 cursor-pointer pr-4 focus:outline-none"
                style={{ border: 'none', outline: 'none' }}
                value={selectedTiendaId}
                onChange={(e) => setSelectedTiendaId(e.target.value)}
              >
                <option value="">TODAS LAS TIENDAS</option>
                {tiendas.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Turno Indicator */}
          <button
            onClick={() => {
              setShowTurnoModal(true);
              loadTurnoActivo();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all
              ${turnoActivo
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'
                : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 border dark:border-slate-600'
              }`}
          >
            <Clock size={14} />
            {turnoActivo
              ? `Turno ${turnoActivo.estado === 'ABIERTO' ? 'Activo' : 'Cerrado'}`
              : 'Sin Turno'}
          </button>

          {/* Suspended Sales Counter */}
          {ventasSuspendidas.length > 0 && (
            <button
              onClick={() => setActiveTab('SUSPENDED')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-orange-100 dark:border-orange-800/50"
            >
              <Pause size={14} />
              {ventasSuspendidas.length} En Espera
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden">

        {activeTab === 'POS' && (
          <div className="h-full flex flex-col md:flex-row">

            {/* LEFT: Products & Search */}
            <div className="w-full md:w-2/3 p-3 flex flex-col gap-3 overflow-hidden border-none">
              {/* Search Bar */}
              <div className="relative z-30">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                <input
                  ref={searchInputRef}
                  className={`input-standard pl-12 pr-28 py-4 text-base shadow-xl ${cantidadBusqueda > 1 ? 'ring-4 ring-indigo-500/20 border-indigo-500' : ''}`}
                  placeholder="Localizar producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const trimmedBusqueda = busqueda.trim();
                      if (!trimmedBusqueda) return;

                      // 1. Check if it's a customer barcode
                      const customerByBarcode = clientes.find(c => c.codigo_barras === trimmedBusqueda);
                      if (customerByBarcode) {
                        setClienteId(customerByBarcode.id);
                        toast.success(`Cliente: ${customerByBarcode.nombre} Seleccionado`);
                        setBusqueda("");
                        return;
                      }

                      // 2. Normal product logic
                      if (productosFiltrados.length > 0) {
                        const firstProd = productosFiltrados[0];
                        if (firstProd.variaciones && firstProd.variaciones.length > 0) {
                          setProdSeleccionado(firstProd);
                        } else {
                          agregarAlCarrito(firstProd, null, cantidadBusqueda);
                          setBusqueda("");
                        }
                      }
                    }
                  }}
                  autoFocus
                />

                {/* Special Price Indicator */}
                {clienteId && Object.keys(preciosEspeciales).length > 0 && (
                  <div className="absolute right-32 top-1.5 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-bold animate-bounce shadow-md flex items-center gap-1">
                    <TrendingDown size={10} /> PRECIOS ESPECIALES ACTIVOS
                  </div>
                )}

                {/* Multiplier Indicator */}
                {cantidadBusqueda > 1 && (
                  <div className="absolute right-12 top-2.5 px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold animate-pulse shadow-md">
                    x{cantidadBusqueda}
                  </div>
                )}

                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.2em] leading-none mb-0.5">Atajo Multiplicador</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg border dark:border-slate-800 shadow-sm opacity-60">5 * PRODUCTO</span>
                  </div>
                  <div className="h-8 w-px bg-slate-100 dark:bg-slate-700 mx-1"></div>
                  {busqueda && (
                    <button onClick={() => setBusqueda("")} className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl">
                      <Trash size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Results Grid */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl p-1 shadow-inner border-none custom-scrollbar">
                {/* PROMOCIONES Y ACCESOS RÁPIDOS */}
                {!busqueda ? (
                  <div className="space-y-6 p-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* PROMOCIONES TILES - HIGH IMPACT */}
                    {promociones.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600">
                            <Tag size={18} />
                          </div>
                          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Promociones del Día</h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {promociones.map(promo => {
                            // Check if ALL products in promo have stock
                            const hasAllStock = promo.productos.every(pi => {
                              const prod = productos.find(p => p.id === pi.producto_id);
                              return prod && prod.cantidad >= pi.cantidad;
                            });

                            return (
                              <button
                                key={promo.id}
                                onClick={() => agregarPromoAlCarrito(promo)}
                                disabled={!hasAllStock}
                                className={`card-standard p-6 transition-all duration-500 text-left overflow-hidden active:scale-95 group relative border-2 h-full
                                    ${hasAllStock
                                    ? 'hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1'
                                    : 'opacity-50 grayscale border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'}
                                `}
                              >
                                {!hasAllStock && (
                                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/5 backdrop-blur-[2px] pointer-events-none">
                                    <div className="bg-red-600 text-white text-[10px] font-black px-8 py-2 rounded-full shadow-2xl uppercase tracking-[0.2em] rotate-[-12deg] border-2 border-white/30 backdrop-blur-sm">
                                      AGOTADO
                                    </div>
                                  </div>
                                )}
                                <div className="absolute -top-6 -right-6 p-8 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors duration-700 pointer-events-none">
                                  <Tag size={120} strokeWidth={1} />
                                </div>
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                  <div>
                                    <div className="flex justify-between items-start mb-3">
                                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-xl shadow-sm ${hasAllStock ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                        {hasAllStock ? 'COMBINADO TOP' : 'S/ STOCK'}
                                      </span>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight tracking-tight mb-4 group-hover:text-indigo-600 transition-colors line-clamp-2">{promo.nombre}</h3>
                                  </div>
                                  <div className="flex items-end justify-between mt-auto">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Precio Combo</span>
                                      <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{currency}{promo.precio_combo}</span>
                                    </div>
                                    {hasAllStock && (
                                      <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-2xl shadow-indigo-500/40 transform translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                                        <Plus size={20} strokeWidth={3} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* BEST SELLERS / QUICK ACCESS */}
                    {topProductos.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600">
                            <TrendingUp size={18} />
                          </div>
                          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Accesos Rápidos (Más Vendidos)</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {topProductos.slice(0, 10).map(tp => {
                            const p = productos.find(prod => prod.id === tp.id) || tp;
                            return (
                              <button
                                key={tp.id}
                                onClick={() => {
                                  if (p.cantidad <= 0) {
                                    toast.error(`"${p.nombre}" está agotado`);
                                    return;
                                  }
                                  agregarAlCarrito(p);
                                }}
                                className={`flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border dark:border-slate-700 hover:border-indigo-500/50 hover:shadow-lg transition-all text-left group active:scale-95 relative overflow-hidden
                                  ${p.cantidad <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                                `}
                              >
                                {p.cantidad <= 0 && (
                                  <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center p-1 pointer-events-none">
                                    <span className="bg-slate-800 text-white text-[7px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">S/ Stock</span>
                                  </div>
                                )}
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                  <Package size={18} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-800 dark:text-white uppercase truncate tracking-tighter flex items-center gap-1">
                                    {p.nombre}
                                    {getPrecioProducto(p).isPromo && <Tag size={10} className="text-amber-500" />}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[11px] font-bold text-indigo-500">{currency}{getPrecioProducto(p).precio}</p>
                                    {getPrecioProducto(p).isPromo && (
                                      <p className="text-[9px] text-slate-400 line-through opacity-50">{currency}{getPrecioProducto(p).originalPrice}</p>
                                    )}
                                  </div>
                                </div>
                                <Plus size={14} className="text-slate-200 group-hover:text-indigo-400" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* EMPTY STATE */}
                    {!promociones.length && !topProductos.length && (
                      <div className="px-2 py-20 text-center opacity-30">
                        <Search size={40} className="mx-auto mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Utiliza el buscador o escanea para empezar</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 animate-in fade-in zoom-in duration-300">
                    {productosFiltrados.map(prod => {
                      const isOutOfStock = prod.cantidad <= 0;
                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            if (isOutOfStock) {
                              toast.error("Producto agotado");
                              return;
                            }
                            if (prod.variaciones && prod.variaciones.length > 0) {
                              setProdSeleccionado(prod);
                            } else {
                              agregarAlCarrito(prod, null, cantidadBusqueda);
                              setBusqueda("");
                            }
                          }}
                          className={`card-standard p-5 cursor-pointer flex flex-col justify-between group relative overflow-hidden h-[150px] border-2 transition-all duration-500
                            ${isOutOfStock
                              ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60 grayscale'
                              : prod.cantidad <= 5
                                ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-900/10 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/10'
                                : 'hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1'}
                          `}
                        >
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-slate-900/10 dark:bg-black/20 flex items-center justify-center rotate-12 pointer-events-none z-20">
                              <span className="bg-red-600 text-white text-[11px] font-black px-12 py-1.5 shadow-2xl uppercase tracking-[0.4em] backdrop-blur-md border-2 border-white/20">Sin Stock</span>
                            </div>
                          )}

                          <div className="absolute -top-2 -right-2 p-4 text-slate-500/5 group-hover:text-indigo-500/10 transition-colors duration-700 pointer-events-none">
                            <Package size={80} strokeWidth={1} />
                          </div>

                          <div className="relative z-10">
                            <div className="flex justify-between items-start gap-3">
                              <h3 className="font-black text-slate-800 dark:text-white text-[12px] leading-tight uppercase tracking-tight mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">{prod.nombre}</h3>
                              {cantidadBusqueda > 1 && !isOutOfStock && (
                                <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-xl font-black tracking-widest shadow-xl shrink-0 animate-pulse">x{cantidadBusqueda}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${isOutOfStock ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                prod.cantidad <= 5 ? 'bg-amber-50 text-amber-600 border-amber-200/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                                }`}>
                                {isOutOfStock ? 'AGOTADO' : `DISP: ${prod.cantidad}`}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[90px] opacity-60 group-hover:opacity-100 transition-opacity">{prod.marca}</span>
                            </div>
                          </div>

                          <div className="mt-auto flex justify-between items-end relative z-10">
                            <div className="flex flex-col">
                              {getPrecioProducto(prod).isPromo && (
                                <span className="text-[10px] text-slate-400 line-through font-bold opacity-60 leading-none mb-1">{currency}{getPrecioProducto(prod).originalPrice}</span>
                              )}
                              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none group-hover:scale-110 origin-left transition-transform duration-500">
                                {currency}{getPrecioProducto(prod).precio}
                                {getPrecioProducto(prod).isPromo && (
                                  <span className={`ml-2 text-[8px] text-white px-2 py-0.5 rounded-lg shadow-2xl align-middle border border-white/20 ${getPrecioProducto(prod).promoLabel === 'PROMO CLIENTE' ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                                    {getPrecioProducto(prod).promoLabel}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {!isOutOfStock ? (
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-500/40 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                  <Plus size={22} strokeWidth={3} />
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/store/compras?productId=${prod.id}`);
                                  }}
                                  className="p-3 bg-slate-900 text-white rounded-2xl shadow-2xl transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 hover:bg-black"
                                  title="Reabastecer"
                                >
                                  <RefreshCcw size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Turn Summary - Fill space & Provide info */}
                {turnoActivo && !busqueda && (
                  <div className="mt-8 px-4 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="card-standard p-4 flex items-center gap-4 hover:border-indigo-200">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ventas del Turno</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                          {ventas.filter(v => v.tipo === 'venta' && v.estado !== 'CANCELADA').length} <span className="text-[9px] text-slate-400">Tickets</span>
                        </p>
                      </div>
                    </div>

                    <div className="card-standard p-4 flex items-center gap-4 hover:border-emerald-200">
                      <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Efectivo en Caja</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                          {currency}{(Number(turnoActivo.monto_inicial) + Number(turnoDetalleRaw?.totales_por_metodo?.find(t => t.metodo === 'Efectivo')?.total || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="card-standard p-4 flex items-center gap-4 hover:border-amber-200">
                      <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Operador</p>
                        <p className="text-xs font-black text-slate-800 dark:text-white leading-none uppercase truncate max-w-[120px]">
                          {user?.username}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Cart & Actions */}
            <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 border-l dark:border-slate-800 flex flex-col h-full shadow-2xl z-20 overflow-hidden">

              {/* Client Selector - COMPACT */}
              <div className="p-3 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex gap-2">
                  <select
                    className="select-standard flex-1 text-xs"
                    value={clienteId}
                    onChange={e => setClienteId(e.target.value)}
                  >
                    <option value="">Cliente: Venta General</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowQuickClient(true)}
                    className="p-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl shadow-sm transition-all"
                    title="Nuevo Cliente"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Cart Items - COMPACT */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in zoom-in duration-700">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-indigo-500/10 blur-[60px] rounded-full scale-150 animate-pulse"></div>
                      <div className="relative w-28 h-28 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white dark:border-white/5 rotate-3 hover:rotate-0 transition-transform duration-500">
                        <ShoppingCart size={48} className="text-indigo-400 opacity-40" strokeWidth={1} />
                      </div>
                    </div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] mb-2 leading-none">Carrito Vacío</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[180px]">Utiliza el buscador o escanea productos para empezar la venta</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.tempId} className="flex justify-between items-center bg-white dark:bg-slate-800/50 p-3 rounded-xl group hover:shadow-lg border border-transparent hover:border-indigo-50 dark:hover:border-indigo-900 transition-all duration-300">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-tight line-clamp-1">{item.nombre}</div>
                          {item.isWholesale && (
                            <span className="badge-warning text-[7px] py-0.5 px-1.5">MAYOREO</span>
                          )}
                          {item.isCombo && (
                            <span className="badge-info text-[7px] py-0.5 px-1.5">COMBO</span>
                          )}
                        </div>
                        {item.variacion_nombre && <div className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{item.variacion_nombre}</div>}
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{currency}{item.precio}</div>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={`flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-0.5 shadow-inner ${item.isCombo ? 'opacity-50 pointer-events-none' : ''}`}>
                          <button onClick={() => updateCantidad(item.tempId, -1)} className="p-0.5 px-1.5 hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-md transition-colors"><Minus size={10} /></button>
                          <span className="w-5 text-center font-bold text-[10px] text-slate-700 dark:text-white">{item.cantidad}</span>
                          <button onClick={() => updateCantidad(item.tempId, 1)} className="p-0.5 px-1.5 hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-md transition-colors"><Plus size={10} /></button>
                        </div>
                        <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{currency}{(item.cantidad * item.precio).toFixed(2)}</div>
                      </div>
                      <button onClick={() => removeItem(item.tempId)} className="ml-3 text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all">
                        <Trash size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Summary & Actions - COMPACTED */}
              <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900 border-t dark:border-slate-800 space-y-3">
                {/* Discount & Notes - Compact Integrated Row */}
                <div className="flex gap-2">
                  <div className="flex-1 relative group">
                    <FileText className="absolute left-3 top-2.5 text-slate-300 group-focus-within:text-indigo-400" size={14} />
                    <input
                      className="input-standard pl-9 py-2 text-[10px]"
                      placeholder="Nota rápida..."
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                    />
                  </div>
                  <div className="relative w-20">
                    <input
                      type="number"
                      className="input-standard py-2 text-[10px] text-center text-rose-500 font-bold focus:border-rose-500"
                      value={descuentoGlobal}
                      onChange={e => setDescuentoGlobal(e.target.value)}
                      placeholder="DESC"
                    />
                    <span className="absolute -top-1.5 left-1 bg-slate-50 dark:bg-slate-900 px-1 text-[7px] font-bold uppercase text-slate-400">Desc</span>
                  </div>
                </div>

                <div className="card-standard p-4 rounded-[2.5rem] border-2 border-indigo-50 dark:border-indigo-900/30 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-all duration-700"></div>

                  <div className="flex justify-between items-center px-2 relative z-10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Subtotal</span>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{currency}{subtotal.toFixed(2)}</span>
                  </div>

                  {descuentoGlobal > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl mt-2 border border-rose-100 dark:border-rose-900/30 relative z-10">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Descuento</span>
                      <span className="text-sm font-black text-rose-600">- {currency}{parseFloat(descuentoGlobal).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1 my-3 relative z-10"></div>

                  <div className="flex justify-between items-end px-2 pb-1 relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-1.5 leading-none">Total a Pagar</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currency}</span>
                        <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{total.toFixed(2)}</span>
                        <span className="text-[8px] font-black text-indigo-500/60 uppercase tracking-[0.2em] ml-1">MXN</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  <button
                    onClick={handleSuspend}
                    disabled={cart.length === 0}
                    className="col-span-1 btn-secondary py-3 flex items-center justify-center text-orange-500 hover:text-orange-600"
                    title="Suspender"
                  >
                    <Pause size={18} />
                  </button>
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={cart.length === 0}
                    className="col-span-3 btn-primary py-3 flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20"
                  >
                    <div className="flex flex-col items-center leading-none text-[8px] font-bold uppercase text-white/40 tracking-widest">
                      <span>F9</span>
                    </div>
                    <CreditCard size={14} />
                    <span>Confirmar y Cobrar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SUSPENDED' && (
          <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Pause className="text-orange-500" /> Ventas Suspendidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ventasSuspendidas.map((susp, idx) => (
                <div key={susp.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border-l-4 border-orange-400">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-gray-500">#{susp.id}</span>
                    <span className="text-sm bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{susp.fecha}</span>
                  </div>
                  <div className="mb-2">
                    {susp.clienteId ? <span className="text-blue-600 font-bold">Cliente ID: {susp.clienteId}</span> : <span className="text-gray-400">Cliente General</span>}
                  </div>
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    {susp.cart.length} productos | Total: <span className="font-bold text-black dark:text-white">${susp.total.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => handleResume(susp, idx)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> Recuperar Venta
                  </button>
                </div>
              ))}
              {ventasSuspendidas.length === 0 && <p className="text-gray-400">No hay ventas suspendidas.</p>}
            </div>
          </div>
        )}


        {activeTab === 'HISTORY' && (
          <div className="p-6 h-full overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <History className="text-indigo-600" /> Historial del <span className="text-indigo-600 dark:text-indigo-400">Turno Actual</span>
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{ventas.length} Movimientos Registrados</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border-none">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800/50 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4 px-6">Registro / Hora</th>
                    <th className="p-4 px-6">Tipo</th>
                    <th className="p-4 px-6">Descripción</th>
                    <th className="p-4 px-6 text-right">Monto</th>
                    <th className="p-4 px-6 text-center">Usuario</th>
                    <th className="p-4 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {ventas.filter(v => v.tipo === 'venta').length > 0 ? (
                    ventas.filter(v => v.tipo === 'venta').map((m, idx) => {
                      const date = new Date(m.fecha);
                      const isCancelled = m.estado === 'CANCELADA';
                      return (
                        <tr key={`${m.tipo}-${m.id}-${idx}`} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all group ${isCancelled ? 'opacity-50 grayscale bg-red-50/5' : ''}`}>
                          <td className="p-4 px-6">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{date.toLocaleDateString()}</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="p-4 px-6">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[9px] font-bold uppercase tracking-widest border shadow-sm ${isCancelled
                              ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/30'
                              : (m.tipo === 'venta'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30'
                                : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/30')
                              }`}>
                              {isCancelled ? <X size={12} strokeWidth={3} /> : (m.tipo === 'venta' ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                              {isCancelled ? 'CANCELADA' : m.tipo}
                            </div>
                          </td>
                          <td className="p-4 px-6">
                            <div className="flex flex-col">
                              <p className={`text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tighter truncate max-w-xs ${isCancelled ? 'line-through decoration-rose-500/50' : ''}`}>
                                {m.descripcion}
                              </p>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-2">
                                  {m.es_mayoreo === 1 ? (
                                    <span className="text-[8px] bg-amber-400 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-amber-500 shadow-sm shadow-amber-500/20">MAYOREO: {m.cliente_nombre || 'SIN CLIENTE'}</span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{m.cliente_nombre || 'Venta General'}</span>
                                  )}
                                </div>
                                {m.metodo_detalle && (
                                  <span className="text-[8px] inline-flex flex-wrap gap-1">
                                    {m.metodo_detalle.split(' + ').map((met, midx) => {
                                      const isCard = met.toUpperCase().includes('TARJETA');
                                      return (
                                        <span key={midx} className={`px-1.5 py-0.5 rounded font-black uppercase tracking-widest border shadow-sm ${isCard ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:border-slate-600'}`}>
                                          {met}
                                        </span>
                                      );
                                    })}
                                  </span>
                                )}
                                {m.ticket_numero && <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest block mb-1">TICKET: #{m.ticket_numero}</span>}
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider block opacity-40">TRX ID: {m.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 px-6 text-right">
                            <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-widest mb-0.5 opacity-50">Total Venta</span>
                            <p className={`text-sm font-black tracking-tighter ${isCancelled ? 'text-slate-400 line-through' : (m.tipo === 'venta' ? 'text-indigo-600' : 'text-rose-600')}`}>
                              {currency} {Number(m.total || m.monto || 0).toFixed(2)}
                            </p>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              <User size={10} /> {m.usuario || 'Sistema'}
                            </div>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {m.tipo === 'venta' && m.estado !== 'CANCELADA' && (
                                <>
                                  <button
                                    onClick={() => handleCancelSale(m.id)}
                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                    title="Cancelar Venta"
                                  >
                                    <Ban size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Lógica de reimpresión similar a MovementHistory si se desea
                                      toast.success("Reimpresión enviada");
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                    title="Reimprimir Ticket"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </>
                              )}
                              {m.tipo === 'compra' && (
                                <span className="text-[9px] text-slate-300 font-bold uppercase ">Solo Lectura</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-20 text-center">
                        <History size={40} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay movimientos en este turno</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PRODUCT VARIATION MODAL */}
      {prodSeleccionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">Seleccionar Variación: {prodSeleccionado.nombre}</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {prodSeleccionado.variaciones.map(v => (
                <button
                  key={v.id}
                  onClick={() => agregarAlCarrito(prodSeleccionado, v)}
                  disabled={v.stock <= 0}
                  className={`w-full flex justify-between p-3 rounded-lg border 
                                        ${v.stock > 0
                      ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 dark:border-gray-700'
                      : 'opacity-50 cursor-not-allowed bg-gray-100'}`}
                >
                  <span>{v.nombre}</span>
                  <div className="flex gap-4">
                    <span className="font-bold text-blue-600">${v.precio}</span>
                    <span className={`${v.stock < 5 ? 'text-red-500' : 'text-gray-500'}`}>Stock: {v.stock}</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setProdSeleccionado(null)} className="mt-4 w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onConfirm={handleConfirmPayment}
        isWholesale={cart.some(i => i.isWholesale)}
        loading={loading}
      />

      <QuickClientModal
        isOpen={showQuickClient}
        onClose={() => setShowQuickClient(false)}
        onSuccess={(client) => {
          setClientes([...clientes, client]);
          setClienteId(client.id);
        }}
      />

      {/* TURNO MODAL (OPEN/CLOSE) */}
      {/* TURNO MODAL (OPEN/CLOSE) */}
      {showTurnoModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-5xl h-[90vh] flex flex-col p-0">

            {/* Header */}
            <div className="modal-header p-6 md:p-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 text-slate-800 dark:text-white">
                  {turnoActivo ? 'Corte de Caja' : 'Apertura de Turno'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {turnoActivo ? 'RESUMEN Y ARQUEO DE JORNADA' : 'INICIO DE OPERACIONES'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTurnoModal(false);
                  setMontoTurno("");
                  setConteoEfectivo({
                    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, monedas: 0
                  });
                }}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 md:px-8 pb-6 md:pb-8 flex-1 overflow-y-auto mt-2 custom-scrollbar">
              {turnoActivo ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                  {/* COLUMNA IZQUIERDA: RESUMEN Y ESTADO */}
                  <div className="space-y-6">
                    <div className="card-standard p-6 border-emerald-100 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-900/10">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                          <Clock size={24} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            Turno Activo: {user?.turno_trabajo || 'Mañana'}
                          </p>
                          <h4 className="text-lg font-black text-emerald-900 dark:text-white leading-none">
                            Cajero: {user?.username}
                          </h4>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-emerald-700/60 dark:text-emerald-400/60 uppercase">
                        <span>ID: #{turnoActivo.id}</span>
                        <span>•</span>
                        <span>Desde: {new Date(turnoActivo.fecha_apertura).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {turnoDetalleRaw ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-white">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fondo de Caja (Monto Inicial)</span>
                            <span className="text-lg font-black">${Number(turnoActivo.monto_inicial).toFixed(2)}</span>
                          </div>
                          <div className="bg-indigo-600 text-white p-4 rounded-2xl border border-indigo-500 shadow-lg shadow-indigo-600/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-white/20 transition-all"></div>
                            <span className="text-[9px] font-black text-indigo-100 uppercase tracking-widest block mb-1">Ventas del Turno (Completadas)</span>
                            <span className="text-lg font-black relative z-10">${Number(turnoDetalleRaw.venta_total || 0).toFixed(2)}</span>
                            <p className="text-[7px] font-bold text-indigo-200 uppercase mt-1">Efectivo + Tarjeta + Transf. + Dólar</p>
                          </div>
                        </div>

                        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/20 shadow-sm shadow-indigo-500/5">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Desglose por Método</h4>
                            {turnoDetalleRaw.mayoreo_total > 0 && (
                              <div className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse shadow-md shadow-amber-500/20">
                                Mayoreo: ${Number(turnoDetalleRaw.mayoreo_total).toFixed(2)}
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            {[
                              { label: 'Efectivo', key: 'Efectivo', icon: DollarSign, color: 'emerald' },
                              { label: 'Tarjeta', key: 'Tarjeta', icon: CreditCard, color: 'blue' },
                              { label: 'Transferencia', key: 'Transferencia', icon: RefreshCcw, color: 'purple' },
                              { label: 'Dólar', key: 'Dolar', icon: DollarSign, color: 'amber' }
                            ].map(m => {
                              const totalMetodo = Number(turnoDetalleRaw.totales_por_metodo?.find(t => t.metodo === m.key)?.total || 0);
                              const totalMayoreoMetodo = Number(turnoDetalleRaw.totales_mayoreo_por_metodo?.find(t => t.metodo === m.key)?.total || 0);

                              return (
                                <div key={m.key} className="p-1 px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-800 dark:text-white">
                                      <m.icon size={14} className={`text-${m.color}-500`} /> {m.label}
                                    </span>
                                    <span className="text-xs font-black text-slate-800 dark:text-white">
                                      ${totalMetodo.toFixed(2)}
                                    </span>
                                  </div>
                                  {totalMayoreoMetodo > 0 && (
                                    <div className="mt-1.5 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Tag size={8} /> De los cuales Mayoreo
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-500 font-mono">
                                        ${totalMayoreoMetodo.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {Number(turnoDetalleRaw.cancelado_total) > 0 && (
                            <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex justify-between items-center group">
                              <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                <XCircle size={18} className="transition-transform group-hover:scale-110" /> Ventas Canceladas
                              </span>
                              <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                                -${Number(turnoDetalleRaw.cancelado_total).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-indigo-800/30 flex justify-between items-end text-indigo-900 dark:text-indigo-300">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block">Efectivo Final</span>
                              <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">(Fondo + Ventas Efectivo)</span>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black tracking-tighter block leading-none">
                                ${(Number(turnoActivo.monto_inicial) + Number(turnoDetalleRaw.totales_por_metodo?.find(t => t.metodo === 'Efectivo')?.total || 0)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-8 pt-6 border-t dark:border-slate-700/50">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Activity size={14} className="text-indigo-500" /> ACTIVIDAD RECIENTE
                        </h4>
                        <div className="space-y-2">
                          {ventas.slice(0, 5).map((v, vidx) => (
                            <div key={vidx} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-800">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[120px]">{v.descripcion}</span>
                                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <span className={`text-[10px] font-black ${v.estado === 'CANCELADA' ? 'text-rose-500 line-through' : 'text-indigo-600'}`}>
                                {currency}{Number(v.total || v.monto || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {ventas.length === 0 && <p className="text-[9px] text-slate-400 font-bold text-center py-4">Sin actividad</p>}
                        </div>
                      </div>
                    )}

                    <div className="p-5 bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide flex items-start gap-3 leading-relaxed">
                        <AlertCircle size={16} className="shrink-0 text-amber-500" />
                        El sistema comparará este total con las ventas registradas. El faltante o sobrante será reportado.
                      </p>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: ARQUEO Y CIERRE */}
                  <div className="space-y-6 lg:sticky lg:top-0">
                    <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                        <DollarSign size={14} className="text-indigo-500" /> Arqueo Físico de Efectivo
                      </h4>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {[1000, 500, 200, 100, 50, 20].map(den => (
                          <div key={den} className="flex items-center gap-3 group">
                            <div className="w-10 shrink-0">
                              <span className="text-[11px] font-black text-slate-400 group-hover:text-indigo-500 transition-colors">$ {den}</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={conteoEfectivo[den] || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0;
                                setConteoEfectivo(prev => ({ ...prev, [den]: val }));
                              }}
                              className="input-standard w-full text-center font-black text-sm"
                              placeholder="0"
                            />
                          </div>
                        ))}
                        <div className="col-span-2 flex items-center gap-3 pt-3 border-t dark:border-slate-700">
                          <div className="w-10 text-right">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mon.</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={conteoEfectivo.monedas || ''}
                            onChange={e => setConteoEfectivo(prev => ({ ...prev, monedas: parseFloat(e.target.value) || 0 }))}
                            className="input-standard flex-1 text-center font-black text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="p-8 mt-8 bg-indigo-600 rounded-[2.5rem] text-center shadow-2xl shadow-indigo-600/40 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
                        <span className="relative z-10 text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] block mb-2">Total en Caja</span>
                        <div className="relative z-10 text-5xl font-black text-white tracking-tighter leading-none flex items-center justify-center gap-1">
                          <span className="text-xl opacity-50 mb-auto mt-2">$</span>
                          {(
                            (conteoEfectivo[1000] * 1000) +
                            (conteoEfectivo[500] * 500) +
                            (conteoEfectivo[200] * 200) +
                            (conteoEfectivo[100] * 100) +
                            (conteoEfectivo[50] * 50) +
                            (conteoEfectivo[20] * 20) +
                            (conteoEfectivo.monedas)
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const finalCash = (conteoEfectivo[1000] * 1000) +
                          (conteoEfectivo[500] * 500) +
                          (conteoEfectivo[200] * 200) +
                          (conteoEfectivo[100] * 100) +
                          (conteoEfectivo[50] * 50) +
                          (conteoEfectivo[20] * 20) +
                          (conteoEfectivo.monedas);
                        handleCerrarTurno(finalCash);
                      }}
                      disabled={(
                        (conteoEfectivo[1000] * 1000) +
                        (conteoEfectivo[500] * 500) +
                        (conteoEfectivo[200] * 200) +
                        (conteoEfectivo[100] * 100) +
                        (conteoEfectivo[50] * 50) +
                        (conteoEfectivo[20] * 20) +
                        (conteoEfectivo.monedas)
                      ) === 0}
                      className="btn-primary w-full py-7 text-xs uppercase tracking-[0.2em] gap-4"
                    >
                      <Zap size={20} className="text-amber-400 fill-amber-400" /> FINALIZAR JORNADA Y CORTE
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-8 rounded-[2.5rem] text-center border border-indigo-100 dark:border-indigo-800/30">
                    <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-600/30 rotate-3">
                      <Clock size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Inicio de Jornada</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-slate-400">Prepara tu caja para comenzar a vender</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block text-center">Fondo Inicial en Efectivo</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-indigo-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={montoTurno}
                        onChange={e => setMontoTurno(e.target.value)}
                        className="w-full pl-12 pr-6 py-6 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-3xl text-4xl font-black text-slate-800 dark:text-white outline-none transition-all shadow-sm text-center"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-4 text-center">Cambio disponible para ventas</p>
                  </div>
                  <button
                    onClick={handleAbrirTurno}
                    disabled={!montoTurno}
                    className="btn-primary w-full py-6 text-xs uppercase tracking-[0.2em] gap-4"
                  >
                    <Play size={20} strokeWidth={3} /> ABRIR TURNO Y COMENZAR
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* TICKET DE IMPRESIÓN TÉRMICA (Oculto en pantalla) */}
      <div id="thermal-ticket" className="hidden print:block print:w-[58mm] xl:print:w-[80mm] mx-auto bg-white p-2 text-black font-mono text-[10px] leading-tight transition-all">
        <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
          <h2 className="font-bold text-xs uppercase">{user?.tienda_nombre || 'Minisuper'}</h2>
          <p>{user?.tienda_direccion || 'Dirección no disponible'}</p>
          <p>Tel: {user?.tienda_telefono || '-'}</p>
        </div>

        <div className="mb-2">
          <p>Fecha: {new Date().toLocaleString()}</p>
          <p>Cajero: {user?.username}</p>
          <p>Cliente: {clientes.find(c => c.id == clienteId)?.nombre || 'General'}</p>
        </div>

        <div className="border-b border-dashed border-gray-400 mb-2">
          <div className="flex font-bold mb-1">
            <span className="flex-1">Producto</span>
            <span className="w-8 text-center">Cant</span>
            <span className="w-16 text-right">Total</span>
          </div>
          {cart.map(item => (
            <div key={item.tempId} className="flex mb-1">
              <span className="flex-1 truncate uppercase">{item.nombre}</span>
              <span className="w-8 text-center">{item.cantidad}</span>
              <span className="w-16 text-right">${(item.cantidad * item.precio).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="text-right space-y-1">
          <p>Subtotal: ${subtotal.toFixed(2)}</p>
          {descuentoGlobal > 0 && <p>Desc: -${descuentoGlobal}</p>}
          <p className="font-bold text-xs">TOTAL: ${total.toFixed(2)}</p>
        </div>

        <div className="text-center mt-6 pt-2 border-t border-dashed border-gray-400">
          <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
          <p className="text-[8px] mt-1 ">Vuelva pronto</p>
        </div>
      </div>

      <style>{`
        @media print {
            body * { visibility: hidden; }
            #thermal-ticket, #thermal-ticket * { visibility: visible; }
            #thermal-ticket { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100%;
                margin: 0;
                padding: 10px;
            }
            @page {
                margin: 0;
                size: portrait;
            }
        }
      `}</style>
      <PinValidationModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
        title="Autorizar Cancelación"
        actionType="CANCELAR_VENTA"
        entityId={pendingAction?.id}
      />
    </div >
  );
};

export default RegistrarVentas;
