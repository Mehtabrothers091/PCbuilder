import React, { useState, useMemo, useEffect } from 'react';
import { 
  Cpu, CircuitBoard, MemoryStick, HardDrive, Zap, Box, Fan, Monitor,
  ShoppingCart, Trash2, MessageCircle, GripVertical, ChevronDown, ChevronRight,
  Search, X, RefreshCw, AlertTriangle, Wind, Plus, Minus, CheckCircle2, Package
} from 'lucide-react';

// --- CONFIGURATION ---
const SHOPIFY_DOMAIN = 'mehta-brothers-shop.myshopify.com'; 
const STOREFRONT_ACCESS_TOKEN = '2ff722b3b6950604c729266f03713082'; 

// Fallback Mock Data
const MOCK_DATA = {
  cpu: [
    { id: 'c1', name: 'Intel Core i5-12400F', price: 9500, brand: 'Intel', socket: 'LGA1700', power: 65, performance: 40, type: 'cpu' },
    { id: 'c2', name: 'Intel Core i5-13600K', price: 24500, brand: 'Intel', socket: 'LGA1700', power: 125, performance: 75, type: 'cpu' },
    { id: 'c4', name: 'AMD Ryzen 5 7600X', price: 19500, brand: 'AMD', socket: 'AM5', power: 105, performance: 60, type: 'cpu' },
  ],
  motherboard: [
    { id: 'm1', name: 'MSI PRO B760M-E DDR4', price: 9200, brand: 'MSI', socket: 'LGA1700', ramType: 'DDR4', size: 'mATX', performance: 30, type: 'motherboard' },
    { id: 'm3', name: 'Gigabyte B650M Gaming X', price: 14500, brand: 'Gigabyte', socket: 'AM5', ramType: 'DDR5', size: 'mATX', performance: 50, type: 'motherboard' },
  ],
  ram: [
    { id: 'r1', name: 'Corsair Vengeance LPX 16GB (8x2)', price: 3800, brand: 'Corsair', ramType: 'DDR4', power: 5, performance: 30, type: 'ram', sticks: 2 },
    { id: 'r3', name: 'XPG Lancer RGB 32GB (16x2)', price: 10500, brand: 'XPG', ramType: 'DDR5', power: 10, performance: 80, type: 'ram', sticks: 2 },
  ],
  gpu: [
    { id: 'g1', name: 'Zotac RTX 3060', price: 24500, brand: 'NVIDIA', power: 170, performance: 45, type: 'gpu' },
  ],
  storage: [
    { id: 's1', name: 'WD Blue SN580 1TB', price: 5600, brand: 'WD', power: 5, performance: 40, type: 'storage' },
  ],
  psu: [
    { id: 'p2', name: 'Deepcool PM750D 750W', price: 7500, watts: 750, modular: false, performance: 60, type: 'psu' },
  ],
  case: [
    { id: 'ca1', name: 'Ant Esports ICE-100', price: 3500, size: 'mATX', performance: 20, type: 'case' },
  ],
  cooler: [
    { id: 'co1', name: 'Deepcool AG400', price: 2100, coolerType: 'Air', performance: 30, type: 'cooler' },
  ]
};

const CATEGORIES = [
  { key: 'cpu', label: 'Processors', icon: Cpu },
  { key: 'motherboard', label: 'Motherboards', icon: CircuitBoard },
  { key: 'ram', label: 'Memory', icon: MemoryStick },
  { key: 'gpu', label: 'Graphics Cards', icon: Monitor },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'cooler', label: 'Cooling', icon: Fan },
  { key: 'psu', label: 'Power Supply', icon: Zap },
  { key: 'case', label: 'Cabinet', icon: Box },
];

const App = () => {
  const [componentData, setComponentData] = useState(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [build, setBuild] = useState({});
  const [quantities, setQuantities] = useState({}); 
  const [expandedCategory, setExpandedCategory] = useState('cpu');
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Mobile tab: 'components' | 'visual' | 'build'
  const [mobileTab, setMobileTab] = useState('components');

  useEffect(() => {
    fetchShopifyData();
  }, []);

  const fetchShopifyData = async () => {
    setLoading(true);
    setError(null);

    const buildQuery = (cursor) => `
      {
        products(first: 250, query: "tag:Builder_Component"${cursor ? `, after: "${cursor}"` : ''}) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title description vendor tags
              variants(first: 1) {
                edges { node { id price { amount currencyCode } } }
              }
            }
          }
        }
      }
    `;

    try {
      let allEdges = [];
      let hasNextPage = true;
      let cursor = null;

      while (hasNextPage) {
        const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
          },
          body: JSON.stringify({ query: buildQuery(cursor) }),
        });

        const result = await response.json();
        if (result.errors) throw new Error(result.errors[0].message);

        const { edges, pageInfo } = result.data.products;
        allEdges = allEdges.concat(edges);
        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;
      }

      console.log(`[PCBuilder] Fetched ${allEdges.length} total products from Shopify`);
      const parsedData = parseShopifyData(allEdges);
      setComponentData(parsedData);
    } catch (err) {
      console.error("Shopify Fetch Error:", err);
      setError("Failed to load live data. Using offline catalog.");
    } finally {
      setLoading(false);
    }
  };

  const parseShopifyData = (edges) => {
    const newData = { ...MOCK_DATA };
    Object.keys(newData).forEach(key => newData[key] = []);

    edges.forEach(({ node }) => {
      const tags = node.tags;
      const price = parseFloat(node.variants.edges[0]?.node.price.amount || 0);
      const variantId = node.variants.edges[0]?.node.id;
      
      const specs = {};
      let category = null;

      tags.forEach(tag => {
        const colonIndex = tag.indexOf(':');
        if (colonIndex === -1) return;
        const key = tag.substring(0, colonIndex);
        const val = tag.substring(colonIndex + 1);
        if (!val) return;
        const cleanKey = key.trim().toLowerCase();
        const cleanVal = val.trim();

        if (cleanKey === 'category') category = cleanVal.toLowerCase();
        else if (cleanKey === 'socket') specs.socket = cleanVal;
        else if (cleanKey === 'ramtype') specs.ramType = cleanVal;
        else if (cleanKey === 'watts') specs.power = parseInt(cleanVal);
        else if (cleanKey === 'size') specs.size = cleanVal;
        else if (cleanKey === 'coolertype') specs.coolerType = cleanVal;
        else if (cleanKey === 'sticks') specs.sticks = parseInt(cleanVal);
      });

      console.log(`[PCBuilder] Product: "${node.title}" | Detected category: "${category}" | Tags: [${tags.join(', ')}]`);

      if (category && newData[category]) {
        newData[category].push({
          id: node.id, variantId, name: node.title, price, brand: node.vendor,
          type: category, ...specs, sticks: specs.sticks || 1,
          power: specs.power || (category === 'gpu' ? 200 : 0), performance: 50
        });
      }
    });

    return newData;
  };

  const totalPrice = useMemo(() => {
    return Object.keys(build).reduce((acc, key) => {
      const item = build[key]; const qty = quantities[key] || 1;
      return acc + ((item?.price || 0) * qty);
    }, 0);
  }, [build, quantities]);

  const totalWattage = useMemo(() => {
    return Object.keys(build).reduce((acc, key) => {
      const item = build[key]; const qty = quantities[key] || 1;
      return acc + ((item?.power || 0) * qty);
    }, 0) + 100;
  }, [build, quantities]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  // Drag handlers (desktop)
  const handleDragStart = (e, item, categoryKey) => {
    setDraggedItem({ item, categoryKey });
    e.dataTransfer.setData("application/json", JSON.stringify({ item, categoryKey }));
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const { item, categoryKey } = JSON.parse(data);
    if (!validateDrop(item, categoryKey)) return;
    setBuild(prev => ({ ...prev, [categoryKey]: item }));
    setQuantities(prev => ({ ...prev, [categoryKey]: 1 }));
    setDraggedItem(null);
  };

  // Tap-to-add (mobile)
  const handleTapAdd = (item, catKey) => {
    if (!validateDrop(item, catKey)) return;
    setBuild(prev => ({ ...prev, [catKey]: item }));
    setQuantities(prev => ({ ...prev, [catKey]: 1 }));
    setMobileTab('build');
  };

  const validateDrop = (item, categoryKey) => {
    if (categoryKey === 'motherboard' && build.cpu && build.cpu.socket !== item.socket) {
      alert(`Incompatible! CPU is ${build.cpu.socket} but Board is ${item.socket}`); return false;
    }
    if (categoryKey === 'cpu' && build.motherboard && build.motherboard.socket !== item.socket) {
      alert(`Incompatible! Board is ${build.motherboard.socket} but CPU is ${item.socket}`); return false;
    }
    if (categoryKey === 'ram' && build.motherboard && build.motherboard.ramType !== item.ramType) {
      alert(`Incompatible! Board needs ${build.motherboard.ramType} RAM.`); return false;
    }
    if (categoryKey === 'motherboard' && build.ram && build.ram.ramType !== item.ramType) {
      alert(`Incompatible! Selected RAM is ${build.ram.ramType}.`); return false;
    }
    return true;
  };

  const removeItem = (key) => {
    const newBuild = { ...build }; delete newBuild[key]; setBuild(newBuild);
    const newQuantities = { ...quantities }; delete newQuantities[key]; setQuantities(newQuantities);
  };

  const updateQuantity = (key, delta) => {
    setQuantities(prev => {
      const current = prev[key] || 1;
      const newValue = Math.max(1, current + delta);
      if (key === 'ram' && build.ram) {
        if (newValue * (build.ram.sticks || 1) > 4) return prev;
      }
      return { ...prev, [key]: newValue };
    });
  };

  const handleWhatsAppSubmit = () => {
    const phoneNumber = "919925002827";
    let message = "*New Custom PC Inquiry from Website Builder*\n\n";
    CATEGORIES.forEach(cat => {
      const part = build[cat.key];
      if (part) {
        const qty = quantities[cat.key] || 1;
        message += `*${cat.label}:* ${part.name} (x${qty}) - ${formatCurrency(part.price * qty)}\n`;
      }
    });
    message += `\n*Total Estimated Cost:* ${formatCurrency(totalPrice)}\n`;
    message += `*Estimated Power:* ${totalWattage}W\n\nPlease confirm availability and final pricing.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const buildCount = Object.keys(build).length;

  // --- Item card: drag on desktop, tap on mobile ---
  const renderItem = (item, catKey) => {
    const isSelected = build[catKey]?.id === item.id;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item, catKey)}
        onClick={() => handleTapAdd(item, catKey)}
        className={`p-3 rounded border cursor-pointer transition-all group select-none
          ${isSelected
            ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'bg-slate-900 border-slate-800 hover:border-blue-500 hover:shadow-lg active:scale-95'
          }`}
      >
        <div className="flex justify-between items-start mb-1">
          <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-slate-500 group-hover:text-blue-400'}`}>{item.brand}</span>
          <div className="flex items-center gap-1">
            {isSelected && <CheckCircle2 size={14} className="text-blue-400" />}
            <GripVertical size={14} className="text-slate-600 hidden md:block" />
          </div>
        </div>
        <div className="text-sm font-medium text-slate-200 leading-tight mb-2">{item.name}</div>
        <div className="flex justify-between items-end">
          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
            {item.socket || item.ramType || item.coolerType || (item.watts ? `${item.watts}W` : '') || 'Std'}
          </span>
          <span className="text-sm font-bold text-green-400">{formatCurrency(item.price)}</span>
        </div>
        {/* Mobile tap hint */}
        {!isSelected && (
          <div className="mt-2 text-[10px] text-slate-600 md:hidden">Tap to add →</div>
        )}
      </div>
    );
  };

  // --- Realistic Fan visual ---
  const RealisticFan = ({ className, spin }) => (
    <div className={`relative flex items-center justify-center ${className} ${spin ? 'animate-spin-slow' : ''}`}>
      <Fan size="100%" className="text-slate-600 absolute opacity-80" />
      <Fan size="100%" className="text-slate-500 absolute rotate-45 opacity-80" />
    </div>
  );

  const totalRamSticks = useMemo(() => {
    if (!build.ram) return 0;
    return (quantities.ram || 1) * (build.ram.sticks || 1);
  }, [build.ram, quantities.ram]);

  const fansSpinning = !!build.cooler;

  // ===== LEFT PANEL =====
  const LeftPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900 z-20 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Box className="text-blue-500" size={18} /> Components
          </h2>
          <button onClick={fetchShopifyData} className="text-slate-500 hover:text-white transition" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 p-2 rounded flex gap-2 items-center text-xs text-red-300">
            <AlertTriangle size={12} />{error}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text" placeholder="Search all parts..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-9 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-700">
              <X size={14} />
            </button>
          )}
        </div>
        {/* Mobile hint */}
        <p className="text-[11px] text-slate-600 md:hidden">Tap a part to add it to your build</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchTerm ? (
          <div className="p-2 space-y-4">
            {CATEGORIES.map(cat => {
              const matches = (componentData[cat.key] || []).filter(i =>
                i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                i.brand?.toLowerCase().includes(searchTerm.toLowerCase())
              );
              if (matches.length === 0) return null;
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <cat.icon size={14} className="text-blue-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{cat.label}</span>
                  </div>
                  <div className="space-y-2 px-2">{matches.map(item => renderItem(item, cat.key))}</div>
                </div>
              );
            })}
          </div>
        ) : (
          CATEGORIES.map(cat => (
            <div key={cat.key} className="border-b border-slate-800">
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                className={`w-full p-4 flex items-center justify-between hover:bg-slate-800 transition-colors ${expandedCategory === cat.key ? 'bg-slate-800 text-blue-400' : 'text-slate-400'}`}
              >
                <div className="flex items-center gap-3">
                  <cat.icon size={18} />
                  <span className="font-semibold">{cat.label}</span>
                  {build[cat.key] && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
                </div>
                {expandedCategory === cat.key ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {expandedCategory === cat.key && (
                <div className="bg-slate-950 p-2 space-y-2">
                  {(componentData[cat.key] && componentData[cat.key].length > 0) ? (
                    componentData[cat.key].map(item => renderItem(item, cat.key))
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-4">No items found</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ===== CENTER PANEL (PC Visual) =====
  const CenterPanel = () => (
    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-3 md:p-4">
      {/* Mobile instruction */}
      <p className="text-xs text-slate-600 mb-2 md:hidden">
        {buildCount === 0 ? 'Go to Components tab to add parts' : `${buildCount} part${buildCount > 1 ? 's' : ''} added`}
      </p>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative w-full max-w-[320px] md:max-w-[450px] aspect-[3/4]
          border-[3px] rounded-3xl transition-all duration-500
          flex flex-col overflow-hidden shadow-2xl
          ${draggedItem
            ? 'border-blue-500/50 bg-slate-900 shadow-[0_0_80px_rgba(59,130,246,0.15)] scale-[1.02]'
            : build.case
              ? 'border-slate-500 shadow-[0_0_40px_rgba(255,255,255,0.1)] bg-slate-900'
              : 'border-slate-800 bg-slate-900/50'}
        `}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none z-30" />

        {/* Top fans */}
        <div className="h-[12%] w-full bg-slate-900 border-b border-slate-800 flex items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-600 via-slate-900 to-slate-900" />
          {[1, 2].map(i => (
            <div key={i} className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-slate-700 flex items-center justify-center relative opacity-50 p-1">
              <RealisticFan className="w-full h-full" spin={fansSpinning} />
            </div>
          ))}
        </div>

        {/* Main chamber */}
        <div className="flex-1 w-full relative bg-slate-800/50 flex">
          {/* Rear fan */}
          <div className="w-[15%] h-full border-r border-slate-800/50 flex flex-col items-center pt-6">
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-full border border-slate-700 flex items-center justify-center p-1">
              <RealisticFan className="w-full h-full" spin={fansSpinning} />
            </div>
            <div className="mt-auto mb-3 space-y-1 w-full px-1">
              {[1,2,3,4,5].map(i => <div key={i} className="h-1.5 w-full bg-slate-700 rounded-sm" />)}
            </div>
          </div>

          {/* Motherboard tray */}
          <div className="flex-1 h-full relative p-2 md:p-4 flex flex-col">
            <div className={`
              w-full h-[75%] rounded-lg border-2 transition-all duration-500 relative shadow-inner flex flex-col p-2
              ${build.motherboard
                ? 'border-purple-500/50 bg-slate-900 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                : 'border-dashed border-slate-700 bg-slate-800/30'}
            `}>
              {!build.motherboard && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-[10px] tracking-widest font-bold rotate-45 pointer-events-none">
                  DROP PART
                </div>
              )}
              <div className={`h-6 w-6 absolute top-3 left-3 border border-slate-600 bg-slate-700 ${build.motherboard ? 'opacity-100' : 'opacity-20'}`} />
              <div className={`h-12 w-5 absolute top-3 left-3 border border-slate-600 bg-slate-700 ${build.motherboard ? 'opacity-100' : 'opacity-20'}`} />

              {/* CPU socket */}
              <div className={`
                absolute top-8 left-10 md:top-12 md:left-16 w-14 h-14 md:w-20 md:h-20 border-2 rounded-sm flex items-center justify-center transition-all z-10
                ${build.cpu ? 'border-blue-500 bg-slate-800 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'border-slate-600 bg-slate-700/50'}
              `}>
                {build.cpu ? (
                  <div className="text-[8px] md:text-[9px] text-blue-300 font-mono text-center leading-none">INTEL<br/>CORE</div>
                ) : (
                  <Cpu size={18} className="text-slate-600" />
                )}
                {build.cooler && (
                  <div className="absolute inset-[-8px] md:inset-[-10px] bg-slate-800 border border-cyan-500 rounded-full flex items-center justify-center shadow-lg z-20">
                    {build.cooler.coolerType === 'Liquid' ? (
                      <div className="w-full h-full rounded-full bg-cyan-900/50 animate-pulse border border-cyan-400 flex items-center justify-center">
                        <div className="text-[7px] md:text-[8px] text-cyan-200">AIO</div>
                      </div>
                    ) : (
                      <div className="w-full h-full p-0.5">
                        <RealisticFan className="w-full h-full text-slate-300" spin={fansSpinning} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RAM slots */}
              <div className="absolute top-8 left-28 md:top-12 md:left-40 flex gap-1 h-14 md:h-20">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`w-1 md:w-1.5 h-full rounded-sm transition-all ${i <= totalRamSticks ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-700 border border-slate-600'}`} />
                ))}
              </div>

              {/* PCIE slots */}
              <div className="mt-auto mb-2 md:mb-4 space-y-2 md:space-y-3 px-2">
                <div className="h-1.5 md:h-2 w-full bg-slate-700 rounded-full relative">
                  {build.gpu && (
                    <div className="absolute top-[-8px] left-0 w-[95%] h-10 md:h-12 bg-gradient-to-r from-slate-800 to-slate-700 border border-orange-500 rounded flex items-center justify-end px-2 md:px-4 shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-20">
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 md:w-2 bg-slate-600" />
                      <div className="text-[7px] md:text-[8px] text-orange-400 font-bold tracking-widest">{build.gpu.brand}</div>
                      <div className="absolute left-1 top-2 w-12 md:w-16 h-1 bg-orange-500/50 rounded-full shadow-[0_0_10px_orange]" />
                      <div className="absolute bottom-1 left-2 md:left-4 flex gap-1 md:gap-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-slate-600 flex items-center justify-center p-0.5"><RealisticFan className="w-full h-full text-slate-500" spin={fansSpinning} /></div>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-slate-600 flex items-center justify-center p-0.5"><RealisticFan className="w-full h-full text-slate-500" spin={fansSpinning} /></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-1 w-full bg-slate-700 rounded-full opacity-50" />
                <div className="h-1 w-full bg-slate-700 rounded-full opacity-50" />
              </div>
            </div>
            <div className="absolute right-0 top-16 w-3 h-10 bg-slate-800 rounded-l-full border-l border-slate-700" />
            <div className="absolute right-0 bottom-16 w-3 h-10 bg-slate-800 rounded-l-full border-l border-slate-700" />
          </div>

          {/* Front fans */}
          <div className="w-[15%] h-full border-l border-slate-800/50 flex flex-col justify-center items-center gap-1 md:gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-9 h-9 md:w-12 md:h-12 rounded border border-slate-700 flex items-center justify-center relative p-1">
                <div className="-rotate-90 w-full h-full"><RealisticFan className="w-full h-full" spin={fansSpinning} /></div>
                {fansSpinning && <div className="absolute inset-0 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] pointer-events-none" />}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom shroud */}
        <div className="h-[20%] w-full bg-slate-900 border-t border-slate-700 flex relative">
          <div className={`w-1/2 h-full border-r border-slate-800 flex items-center justify-center transition-all p-2 ${build.psu ? 'bg-slate-800' : 'bg-transparent'}`}>
            {build.psu ? (
              <div className="text-center">
                <div className="text-yellow-500 font-bold text-base md:text-lg tracking-tighter">{build.psu.watts}W</div>
                <div className="text-[7px] md:text-[8px] text-slate-500">POWER SUPPLY</div>
              </div>
            ) : <span className="text-[10px] text-slate-700">PSU</span>}
          </div>
          <div className="w-1/2 h-full flex items-center justify-center p-2 relative">
            {build.storage ? (
              <div className="w-20 md:w-24 h-7 md:h-8 bg-slate-800 border border-cyan-500/50 rounded flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <span className="text-[8px] md:text-[9px] text-cyan-400 font-mono">NVMe SSD</span>
              </div>
            ) : <span className="text-[10px] text-slate-700">DRIVE BAY</span>}
          </div>
          <div className="absolute bottom-1 right-2 text-[9px] text-slate-600 font-bold tracking-widest opacity-50">MEHTA BROS</div>
        </div>

        {draggedItem && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl pointer-events-none">
            <div className="border-2 border-dashed border-white/50 p-6 rounded-xl text-center animate-pulse">
              <div className="text-white font-bold text-lg mb-1">Install {draggedItem.item.type.toUpperCase()}</div>
              <div className="text-sm text-slate-300">Drop to equip</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ===== RIGHT PANEL (Build Summary) =====
  const RightPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-5 border-b border-slate-800">
        <h2 className="text-lg md:text-xl font-bold text-white mb-1">Your Build</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${totalWattage > (build.psu?.watts || 0) ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-slate-400">Power: <span className="text-slate-200 font-mono">{totalWattage}W</span></span>
          {build.psu && totalWattage > build.psu.watts && (
            <span className="text-red-400 text-xs font-bold">⚠ Upgrade PSU!</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
        {buildCount === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
            <ShoppingCart size={40} className="mb-2" />
            <p className="text-sm">No parts added yet.</p>
            <p className="text-xs mt-1 md:hidden">Go to Components tab to start</p>
          </div>
        ) : (
          CATEGORIES.map(cat => {
            const item = build[cat.key];
            if (!item) return null;
            const qty = quantities[cat.key] || 1;
            return (
              <div key={cat.key} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase text-blue-400 font-bold mb-0.5">{cat.label}</div>
                    <div className="text-sm font-medium text-slate-200 leading-tight truncate pr-2">{item.name}</div>
                    <div className="text-sm text-green-400 mt-1 font-mono">{formatCurrency(item.price * qty)}</div>
                  </div>
                  <button onClick={() => removeItem(cat.key)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {(cat.key === 'ram' || cat.key === 'storage' || cat.key === 'cooler') && (
                  <div className="flex items-center gap-3 bg-slate-900/50 p-1 rounded w-fit">
                    <button onClick={() => updateQuantity(cat.key, -1)} className="p-1 hover:text-white text-slate-500" disabled={qty <= 1}>
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-mono font-bold w-4 text-center">{qty}</span>
                    <button onClick={() => updateQuantity(cat.key, 1)} className="p-1 hover:text-white text-slate-500">
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="bg-slate-950 p-4 md:p-6 border-t border-slate-800 space-y-3 md:space-y-4">
        <div className="flex justify-between items-end">
          <span className="text-slate-400 text-sm">Estimated Total</span>
          <span className="text-xl md:text-2xl font-bold text-white font-mono">{formatCurrency(totalPrice)}</span>
        </div>
        <button
          onClick={handleWhatsAppSubmit}
          disabled={buildCount === 0}
          className={`
            w-full py-3 md:py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all text-sm md:text-base
            ${buildCount === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-500 text-white hover:shadow-green-500/25 transform hover:-translate-y-1 active:scale-95'}
          `}
        >
          <MessageCircle size={18} />
          Request Quote via WhatsApp
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-950 text-white font-sans flex flex-col overflow-hidden">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 2s linear infinite; }
      `}</style>

      {/* ===== DESKTOP LAYOUT: 3-column ===== */}
      <div className="hidden md:flex flex-row flex-1 overflow-hidden">
        {/* Left */}
        <div className="w-1/4 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
          <LeftPanel />
        </div>
        {/* Center */}
        <div className="flex-1 bg-slate-950 relative flex flex-col items-center justify-center">
          <CenterPanel />
        </div>
        {/* Right */}
        <div className="w-1/4 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-10">
          <RightPanel />
        </div>
      </div>

      {/* ===== MOBILE LAYOUT: tab-based ===== */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Tab content */}
        <div className="flex-1 overflow-hidden bg-slate-900">
          {mobileTab === 'components' && (
            <div className="h-full overflow-y-auto">
              <LeftPanel />
            </div>
          )}
          {mobileTab === 'visual' && (
            <div className="h-full overflow-hidden flex items-center justify-center bg-slate-950">
              <CenterPanel />
            </div>
          )}
          {mobileTab === 'build' && (
            <div className="h-full overflow-hidden flex flex-col bg-slate-900">
              <RightPanel />
            </div>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 flex safe-area-inset-bottom">
          <button
            onClick={() => setMobileTab('components')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${mobileTab === 'components' ? 'text-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Package size={20} />
            <span className="text-[10px] font-semibold">Components</span>
          </button>
          <button
            onClick={() => setMobileTab('visual')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${mobileTab === 'visual' ? 'text-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Monitor size={20} />
            <span className="text-[10px] font-semibold">Preview</span>
          </button>
          <button
            onClick={() => setMobileTab('build')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-colors ${mobileTab === 'build' ? 'text-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <ShoppingCart size={20} />
            <span className="text-[10px] font-semibold">Build</span>
            {buildCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-18px)] bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {buildCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
