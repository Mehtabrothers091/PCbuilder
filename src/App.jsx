import React, { useState, useMemo, useEffect } from 'react';
import { 
  Cpu, 
  CircuitBoard, 
  MemoryStick, 
  HardDrive, 
  Zap, 
  Box, 
  Fan, 
  Monitor, 
  ShoppingCart, 
  Trash2, 
  MessageCircle,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  Wind,
  Plus,
  Minus
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

  useEffect(() => {
    fetchShopifyData();
  }, []);

  const fetchShopifyData = async () => {
    setLoading(true);
    setError(null);

    const buildQuery = (cursor) => `
      {
        products(first: 250, query: "tag:Builder_Component"${cursor ? `, after: "${cursor}"` : ''}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              description
              vendor
              tags
              variants(first: 1) {
                edges {
                  node {
                    id
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
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

      // Debug: log products and their detected category
      console.log(`[PCBuilder] Product: "${node.title}" | Detected category: "${category}" | Tags: [${tags.join(', ')}]`);

      if (category && newData[category]) {
        newData[category].push({
          id: node.id,
          variantId: variantId,
          name: node.title,
          price: price,
          brand: node.vendor,
          type: category,
          ...specs,
          sticks: specs.sticks || 1, 
          power: specs.power || (category === 'gpu' ? 200 : 0), 
          performance: 50
        });
      }
    });

    return newData;
  };

  const totalPrice = useMemo(() => {
    return Object.keys(build).reduce((acc, key) => {
        const item = build[key];
        const qty = quantities[key] || 1;
        return acc + ((item?.price || 0) * qty);
    }, 0);
  }, [build, quantities]);

  const totalWattage = useMemo(() => {
    return Object.keys(build).reduce((acc, key) => {
        const item = build[key];
        const qty = quantities[key] || 1;
        return acc + ((item?.power || 0) * qty);
    }, 0) + 100;
  }, [build, quantities]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const handleDragStart = (e, item, categoryKey) => {
    setDraggedItem({ item, categoryKey });
    e.dataTransfer.setData("application/json", JSON.stringify({ item, categoryKey }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

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

  const validateDrop = (item, categoryKey) => {
    if (categoryKey === 'motherboard' && build.cpu && build.cpu.socket !== item.socket) {
      alert(`Incompatible! CPU is ${build.cpu.socket} but Board is ${item.socket}`);
      return false;
    }
    if (categoryKey === 'cpu' && build.motherboard && build.motherboard.socket !== item.socket) {
        alert(`Incompatible! Board is ${build.motherboard.socket} but CPU is ${item.socket}`);
        return false;
    }
    if (categoryKey === 'ram' && build.motherboard && build.motherboard.ramType !== item.ramType) {
        alert(`Incompatible! Board needs ${build.motherboard.ramType} RAM.`);
        return false;
    }
    if (categoryKey === 'motherboard' && build.ram && build.ram.ramType !== item.ramType) {
        alert(`Incompatible! Selected RAM is ${build.ram.ramType}.`);
        return false;
    }
    return true;
  };

  const removeItem = (key) => {
    const newBuild = { ...build };
    delete newBuild[key];
    setBuild(newBuild);
    
    const newQuantities = { ...quantities };
    delete newQuantities[key];
    setQuantities(newQuantities);
  };

  const updateQuantity = (key, delta) => {
      setQuantities(prev => {
          const current = prev[key] || 1;
          const newValue = Math.max(1, current + delta);
          if (key === 'ram' && build.ram) {
             const sticksPerKit = build.ram.sticks || 1;
             if (newValue * sticksPerKit > 4) return prev; 
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
            const lineTotal = part.price * qty;
            message += `*${cat.label}:* ${part.name} (x${qty}) - ${formatCurrency(lineTotal)}\n`;
        }
    });
    message += `\n*Total Estimated Cost:* ${formatCurrency(totalPrice)}\n`;
    message += `*Estimated Power:* ${totalWattage}W\n\nPlease confirm availability and final pricing.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const renderDraggableItem = (item, catKey) => (
    <div 
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e, item, catKey)}
      className="p-3 bg-slate-900 rounded border border-slate-800 hover:border-blue-500 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all group"
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-bold text-slate-500 group-hover:text-blue-400">{item.brand}</span>
        <GripVertical size={14} className="text-slate-600" />
      </div>
      <div className="text-sm font-medium text-slate-200 leading-tight mb-2">{item.name}</div>
      <div className="flex justify-between items-end">
        <div className="flex flex-wrap gap-1">
            <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
            {item.socket || item.ramType || item.coolerType || (item.watts ? `${item.watts}W` : '') || 'Std'}
            </span>
        </div>
        <span className="text-sm font-bold text-green-400">{formatCurrency(item.price)}</span>
      </div>
    </div>
  );
  
  // --- VISUAL COMPONENTS ---
  // Helper for a more detailed fan
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

  return (
	<div className="h-screen bg-red-500 text-white font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* --- CUSTOM CSS FOR ANIMATION --- */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 2s linear infinite; }
      `}</style>

      {/* --- LEFT PANEL: COMPONENT INVENTORY --- */}
      <div className="w-full md:w-1/4 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900 z-20 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Box className="text-blue-500" /> Components
            </h2>
            <button 
                onClick={fetchShopifyData} 
                className="text-slate-500 hover:text-white transition"
                title="Refresh Data"
            >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>
          {error && (
              <div className="bg-red-900/20 border border-red-500/50 p-2 rounded flex gap-2 items-center text-xs text-red-300">
                  <AlertTriangle size={12} />
                  {error}
              </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search all parts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-9 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
            />
            {searchTerm && (
                <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-700"
                >
                    <X size={14} />
                </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
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
                       <cat.icon size={14} className="text-blue-400"/>
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{cat.label}</span>
                     </div>
                     <div className="space-y-2">
                       {matches.map(item => renderDraggableItem(item, cat.key))}
                     </div>
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
                    </div>
                    {expandedCategory === cat.key ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {expandedCategory === cat.key && (
                    <div className="bg-slate-950 p-2 space-y-2 inner-shadow">
                      {(componentData[cat.key] && componentData[cat.key].length > 0) ? (
                         componentData[cat.key].map(item => renderDraggableItem(item, cat.key))
                      ) : (
                         <div className="text-xs text-slate-500 text-center py-2">No items found</div>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>

      {/* --- CENTER PANEL: REALISTIC PC VISUAL (DROP ZONE) --- */}
      <div className="w-full md:w-1/2 bg-slate-950 relative flex flex-col items-center justify-center p-4">
        
        {/* The PC Case Chassis */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            relative w-full max-w-[450px] aspect-[9/16] md:aspect-[3/4] 
            border-[3px] rounded-3xl transition-all duration-500 
            flex flex-col overflow-hidden shadow-2xl
            ${draggedItem 
              ? 'border-blue-500/50 bg-slate-900 shadow-[0_0_80px_rgba(59,130,246,0.15)] scale-[1.02]' 
              : build.case 
                  ? 'border-slate-500 shadow-[0_0_40px_rgba(255,255,255,0.1)] bg-slate-900' // Highlight when case is selected
                  : 'border-slate-800 bg-slate-900/50'}
          `}
        >
          {/* Glass Reflection Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none z-30"></div>

          {/* --- TOP PANEL: FANS --- */}
          <div className="h-[12%] w-full bg-slate-900 border-b border-slate-800 flex items-center justify-center gap-4 relative overflow-hidden">
             {/* Mesh Pattern */}
             <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-600 via-slate-900 to-slate-900 bg-[length:4px_4px]"></div>
             
             {/* Fan Blades (Top Exhaust) */}
             {[1, 2].map(i => (
                <div key={i} className="w-16 h-16 rounded-full border border-slate-700 flex items-center justify-center relative opacity-50 p-1">
                    <RealisticFan className="w-full h-full" spin={fansSpinning} />
                </div>
             ))}
          </div>

          {/* --- MAIN CHAMBER --- */}
          <div className="flex-1 w-full relative bg-slate-800/50 flex">
             
             {/* Rear Fan Area (Left) */}
             <div className="w-[15%] h-full border-r border-slate-800/50 flex flex-col items-center pt-8">
                <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center p-1">
                    <RealisticFan className="w-full h-full" spin={fansSpinning} />
                </div>
                {/* PCIe Brackets */}
                <div className="mt-auto mb-4 space-y-1 w-full px-1">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-2 w-full bg-slate-700 rounded-sm"></div>)}
                </div>
             </div>

             {/* Motherboard Tray (Center) */}
             <div className="flex-1 h-full relative p-4 flex flex-col">
                
                {/* MOTHERBOARD PCB */}
                <div className={`
                    w-full h-[75%] rounded-lg border-2 transition-all duration-500 relative shadow-inner
                    flex flex-col p-2
                    ${build.motherboard 
                        ? 'border-purple-500/50 bg-slate-900 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                        : 'border-dashed border-slate-700 bg-slate-800/30'}
                `}>
                    {!build.motherboard && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs tracking-widest font-bold rotate-45 pointer-events-none">
                            DROP MOTHERBOARD
                        </div>
                    )}

                    {/* VRM Heatsinks (Visual) */}
                    <div className={`h-8 w-8 absolute top-4 left-4 border border-slate-600 bg-slate-700 ${build.motherboard ? 'opacity-100' : 'opacity-20'}`}></div>
                    <div className={`h-16 w-6 absolute top-4 left-4 border border-slate-600 bg-slate-700 ${build.motherboard ? 'opacity-100' : 'opacity-20'}`}></div>

                    {/* CPU SOCKET */}
                    <div className={`
                        absolute top-12 left-16 w-20 h-20 border-2 rounded-sm flex items-center justify-center transition-all z-10
                        ${build.cpu 
                            ? 'border-blue-500 bg-slate-800 shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                            : 'border-slate-600 bg-slate-700/50'}
                    `}>
                        {build.cpu ? (
                            <div className="text-[9px] text-blue-300 font-mono text-center leading-none">
                                INTEL<br/>CORE
                            </div>
                        ) : (
                            <Cpu size={24} className="text-slate-600" />
                        )}
                        
                        {/* COOLER OVERLAY */}
                        {build.cooler && (
                            <div className="absolute inset-[-10px] bg-slate-800 border border-cyan-500 rounded-full flex items-center justify-center shadow-lg z-20">
                                {build.cooler.coolerType === 'Liquid' ? (
                                    <div className="w-16 h-16 rounded-full bg-cyan-900/50 animate-pulse border border-cyan-400 flex items-center justify-center">
                                        <div className="text-[8px] text-cyan-200">AIO PUMP</div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full p-0.5">
                                        <RealisticFan className="w-full h-full text-slate-300" spin={fansSpinning} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RAM SLOTS */}
                    <div className="absolute top-12 left-40 flex gap-1 h-20">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-1.5 h-full rounded-sm transition-all ${i <= totalRamSticks ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-700 border border-slate-600'}`}></div>
                        ))}
                    </div>

                    {/* PCIE SLOTS */}
                    <div className="mt-auto mb-4 space-y-3 px-2">
                        {/* GPU SLOT */}
                        <div className="h-2 w-full bg-slate-700 rounded-full relative group">
                             {/* GPU CARD VISUAL */}
                             {build.gpu && (
                                <div className="absolute top-[-10px] left-0 w-[95%] h-12 bg-gradient-to-r from-slate-800 to-slate-700 border border-orange-500 rounded flex items-center justify-end px-4 shadow-[0_5px_15px_rgba(0,0,0,0.5)] z-20">
                                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-slate-600"></div> {/* Bracket */}
                                    <div className="text-[8px] text-orange-400 font-bold tracking-widest">{build.gpu.brand}</div>
                                    <div className="absolute left-2 top-2 w-16 h-1 bg-orange-500/50 rounded-full shadow-[0_0_10px_orange]"></div> {/* RGB Strip */}
                                    
                                    {/* GPU Fans */}
                                    <div className="absolute bottom-1 left-4 flex gap-2">
                                        <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center p-0.5"><RealisticFan className="w-full h-full text-slate-500" spin={fansSpinning}/></div>
                                        <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center p-0.5"><RealisticFan className="w-full h-full text-slate-500" spin={fansSpinning}/></div>
                                    </div>
                                </div>
                             )}
                        </div>
                        <div className="h-1.5 w-full bg-slate-700 rounded-full opacity-50"></div>
                        <div className="h-1.5 w-full bg-slate-700 rounded-full opacity-50"></div>
                    </div>
                </div>

                {/* Cable Grommets */}
                <div className="absolute right-0 top-20 w-4 h-12 bg-slate-800 rounded-l-full border-l border-slate-700"></div>
                <div className="absolute right-0 bottom-20 w-4 h-12 bg-slate-800 rounded-l-full border-l border-slate-700"></div>

             </div>

             {/* Front Fans Area (Right) */}
             <div className="w-[15%] h-full border-l border-slate-800/50 flex flex-col justify-center items-center gap-2">
                {[1, 2, 3].map(i => (
                     <div key={i} className="w-12 h-12 rounded border border-slate-700 flex items-center justify-center relative p-1">
                        {/* Rotated -90deg for Front Intake orientation look */}
                        <div className="-rotate-90 w-full h-full">
                           <RealisticFan className="w-full h-full" spin={fansSpinning} />
                        </div>
                        {/* RGB Ring */}
                        {fansSpinning && <div className="absolute inset-0 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] pointer-events-none"></div>}
                     </div>
                ))}
             </div>
          </div>

          {/* --- BOTTOM SHROUD (PSU & HDD) --- */}
          <div className="h-[20%] w-full bg-slate-900 border-t border-slate-700 flex relative">
            {/* PSU Section */}
            <div className={`
                w-1/2 h-full border-r border-slate-800 flex items-center justify-center transition-all p-2
                ${build.psu ? 'bg-slate-800' : 'bg-transparent'}
            `}>
                {build.psu ? (
                    <div className="text-center">
                        <div className="text-yellow-500 font-bold text-lg tracking-tighter">{build.psu.watts}W</div>
                        <div className="text-[8px] text-slate-500">POWER SUPPLY</div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-700">PSU SHROUD</span>
                )}
            </div>
            
            {/* HDD Section */}
            <div className="w-1/2 h-full flex items-center justify-center p-2 relative">
                {build.storage && (
                    <div className="w-24 h-8 bg-slate-800 border border-cyan-500/50 rounded flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                        <span className="text-[9px] text-cyan-400 font-mono">NVMe SSD ACTIVE</span>
                    </div>
                )}
                {!build.storage && <span className="text-xs text-slate-700">DRIVE BAY</span>}
            </div>
            
            {/* Logo on Shroud */}
            <div className="absolute bottom-1 right-2 text-[10px] text-slate-600 font-bold tracking-widest opacity-50">
                MEHTA BROS
            </div>
          </div>

          {/* Floating Drag Overlay */}
          {draggedItem && (
             <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl pointer-events-none">
                <div className="border-2 border-dashed border-white/50 p-6 rounded-xl text-center animate-pulse">
                    <div className="text-white font-bold text-xl mb-1">Install {draggedItem.item.type.toUpperCase()}</div>
                    <div className="text-sm text-slate-300">Drop to equip</div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* --- RIGHT PANEL: BILL & ACTIONS --- */}
      <div className="w-full md:w-1/4 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-10">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white mb-1">Your Build</h2>
          <div className="flex items-center gap-2 text-sm">
             <span className={`w-2 h-2 rounded-full ${totalWattage > (build.psu?.watts || 0) ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
             <span className="text-slate-400">Power: <span className="text-slate-200 font-mono">{totalWattage}W</span></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
          {Object.keys(build).length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                <ShoppingCart size={48} className="mb-2" />
                <p>No parts added yet.</p>
             </div>
          ) : (
             CATEGORIES.map(cat => {
               const item = build[cat.key];
               if (!item) return null;
               const qty = quantities[cat.key] || 1;
               
               return (
                 <div key={cat.key} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col gap-2 group">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="text-[10px] uppercase text-blue-400 font-bold mb-0.5">{cat.label}</div>
                            <div className="text-sm font-medium text-slate-200 leading-tight">{item.name}</div>
                            <div className="text-sm text-green-400 mt-1 font-mono">{formatCurrency(item.price * qty)}</div>
                        </div>
                        <button 
                            onClick={() => removeItem(cat.key)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                            title="Remove"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Quantity Control for RAM/Storage/Fans */}
                    {(cat.key === 'ram' || cat.key === 'storage' || cat.key === 'cooler') && (
                        <div className="flex items-center gap-3 bg-slate-900/50 p-1 rounded w-fit mt-1">
                            <button 
                                onClick={() => updateQuantity(cat.key, -1)}
                                className="p-1 hover:text-white text-slate-500"
                                disabled={qty <= 1}
                            >
                                <Minus size={12} />
                            </button>
                            <span className="text-xs font-mono font-bold w-4 text-center">{qty}</span>
                            <button 
                                onClick={() => updateQuantity(cat.key, 1)}
                                className="p-1 hover:text-white text-slate-500"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    )}
                 </div>
               );
             })
          )}
        </div>

        <div className="bg-slate-950 p-6 border-t border-slate-800 space-y-4">
            <div className="flex justify-between items-end">
                <span className="text-slate-400">Estimated Total</span>
                <span className="text-2xl font-bold text-white font-mono">{formatCurrency(totalPrice)}</span>
            </div>

            <button 
                onClick={handleWhatsAppSubmit}
                disabled={Object.keys(build).length === 0}
                className={`
                    w-full py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all
                    ${Object.keys(build).length === 0 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-500 text-white hover:shadow-green-500/25 transform hover:-translate-y-1'}
                `}
            >
                <MessageCircle size={20} />
                Request Quote via WhatsApp
            </button>
        </div>
      </div>
    </div>
  );
};


export default App;

