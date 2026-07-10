"use client";
import { useEffect, useState, useRef } from "react";
import { getProducts, getCustomers, addCustomer, createSale, getBatches, getAvailableUnits, getMainCategories, getSubCategories } from "@/lib/firestore";
import { Product, Customer, CartItem, MainCategory, SubCategory } from "@/types";
import { Search, Plus, Minus, Trash2, Printer, User, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import BillPrint from "@/components/pos/BillPrint";
import { useReactToPrint } from "react-to-print";

export default function SalesPage() {
  const { user, userDisplayName } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mainCats, setMainCats] = useState<MainCategory[]>([]);
  const [subCats, setSubCats] = useState<SubCategory[]>([]);
  const [filterMainCat, setFilterMainCat] = useState("");
  const [filterSubCat, setFilterSubCat] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [note, setNote] = useState("");
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", email: "" });
  const [batchPickerProduct, setBatchPickerProduct] = useState<Product | null>(null);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [serialPickerProduct, setSerialPickerProduct] = useState<Product | null>(null);
  const [availableUnits, setAvailableUnits] = useState<{ id: string; serialNumber: string; batchId: string; costPrice: number; sellingPrice?: number | null }[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });

  useEffect(() => {
    async function load() {
      const [p, c, mc, sc] = await Promise.all([getProducts(), getCustomers(), getMainCategories(), getSubCategories()]);
      setProducts(p.filter((p: any) => p.active && p.totalStock > 0) as Product[]);
      setCustomers(c as Customer[]);
      setMainCats(mc as MainCategory[]);
      setSubCats(sc as SubCategory[]);
    }
    load();
  }, []);

  const filterSubCatOptions = subCats.filter(s => s.mainCategoryId === filterMainCat);

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.includes(productSearch);
    if (!matchesSearch) return false;
    if (filterMainCat && p.mainCategoryId !== filterMainCat) return false;
    if (filterSubCat && p.subCategoryId !== filterSubCat) return false;
    return true;
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );

  const openBatchPicker = async (product: Product) => {
    if (product.trackSerial) {
      openSerialPicker(product);
      return;
    }
    setLoadingBatches(true);
    const b = await getBatches(product.id);
    setLoadingBatches(false);
    if (b.length === 0) {
      // Nothing to pick between — add straight to cart.
      addToCart(product);
      return;
    }
    setProductBatches(b);
    setBatchPickerProduct(product);
  };

  const openSerialPicker = async (product: Product) => {
    setLoadingUnits(true);
    const units = (await getAvailableUnits(product.id)) as { id: string; serialNumber: string; batchId: string; costPrice: number; sellingPrice?: number | null }[];
    setLoadingUnits(false);
    // Units already picked into another cart line for this product aren't available to pick again.
    const takenUnitIds = new Set(cart.flatMap(i => i.units?.map(u => u.unitId) ?? []));
    setAvailableUnits(units.filter(u => !takenUnitIds.has(u.id)));
    setSelectedUnitIds([]);
    setSerialPickerProduct(product);
  };

  const toggleUnitSelected = (unitId: string) => {
    setSelectedUnitIds(ids => ids.includes(unitId) ? ids.filter(id => id !== unitId) : [...ids, unitId]);
  };

  // Each unit sells at its own batch's price (falling back to the product price),
  // so units picked at different prices are split into separate cart lines.
  const addSerializedToCart = (product: Product) => {
    const chosen = availableUnits.filter(u => selectedUnitIds.includes(u.id));
    if (chosen.length === 0) return;

    const groups = new Map<number, typeof chosen>();
    for (const u of chosen) {
      const price = u.sellingPrice ?? product.sellingPrice;
      groups.set(price, [...(groups.get(price) ?? []), u]);
    }

    let nextCart = cart;
    for (const [price, units] of Array.from(groups.entries())) {
      const newUnits = units.map(u => ({ unitId: u.id, serialNumber: u.serialNumber, batchId: u.batchId }));
      const existing = nextCart.find(i => i.productId === product.id && i.units && i.unitPrice === price);
      if (existing) {
        const allUnits = [...(existing.units || []), ...newUnits];
        nextCart = nextCart.map(i => i.tempId === existing.tempId
          ? { ...i, qty: allUnits.length, units: allUnits, lineTotal: allUnits.length * (price - i.discount) }
          : i);
      } else {
        nextCart = [...nextCart, {
          tempId: `${Date.now()}-${price}`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          batchId: null,
          qty: units.length,
          unitPrice: price,
          costPrice: units[0].costPrice,
          discount: 0,
          lineTotal: units.length * price,
          warrantyMonths: product.warrantyMonths || 0,
          units: newUnits,
        }];
      }
    }
    setCart(nextCart);
    setSerialPickerProduct(null);
  };

  const removeLastUnit = (item: CartItem) => {
    if (!item.units || item.units.length === 0) return;
    const units = item.units.slice(0, -1);
    if (units.length === 0) { removeItem(item.tempId); return; }
    setCart(cart.map(i => i.tempId === item.tempId
      ? { ...i, units, qty: units.length, lineTotal: units.length * (i.unitPrice - i.discount) }
      : i));
  };

  const addToCart = (product: Product, batch?: { id: string; costPrice: number; sellingPrice?: number | null } | null) => {
    const batchId = batch?.id || null;
    const unitPrice = batch?.sellingPrice ?? product.sellingPrice;
    const existing = cart.find(i => i.productId === product.id && (i.batchId || null) === batchId);
    if (existing) {
      if (existing.qty >= product.totalStock) return;
      setCart(cart.map(i =>
        i.tempId === existing.tempId
          ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * (i.unitPrice - i.discount) }
          : i
      ));
    } else {
      setCart([...cart, {
        tempId: Date.now().toString(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        batchId,
        qty: 1,
        unitPrice,
        costPrice: batch?.costPrice ?? 0,
        discount: 0,
        lineTotal: unitPrice,
        warrantyMonths: product.warrantyMonths || 0,
      }]);
    }
    setBatchPickerProduct(null);
  };

  const updateQty = (tempId: string, qty: number) => {
    if (qty <= 0) { removeItem(tempId); return; }
    setCart(cart.map(i => i.tempId === tempId ? { ...i, qty, lineTotal: qty * (i.unitPrice - i.discount) } : i));
  };

  const updateDiscount = (tempId: string, disc: number) => {
    setCart(cart.map(i => i.tempId === tempId ? { ...i, discount: disc, lineTotal: i.qty * (i.unitPrice - disc) } : i));
  };

  const removeItem = (tempId: string) => setCart(cart.filter(i => i.tempId !== tempId));

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const totalAmount = Math.max(0, subtotal - discount - pointsToRedeem);
  const change = Number(amountTendered) - totalAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const result = await createSale({
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "Walk-in Customer",
        cashierId: user!.uid,
        cashierName: userDisplayName || "Cashier",
        items: cart,
        subtotal,
        discountAmount: discount,
        taxAmount: 0,
        totalAmount,
        pointsRedeemed: pointsToRedeem || 0,
        paymentMethod,
        paymentStatus: "paid",
        amountTendered: Number(amountTendered) || totalAmount,
        changeAmount: Math.max(0, change),
        note,
      });
      // Warranties and loyalty-point adjustments are written server-side inside
      // createSale's own transaction, so they can't drift from the sale itself.
      setCompletedSale({ ...result, items: cart, subtotal, discountAmount: discount, pointsRedeemed: pointsToRedeem, totalAmount, customerName: selectedCustomer?.name || "Walk-in Customer", cashierName: userDisplayName || "Cashier", paymentMethod, amountTendered: Number(amountTendered), changeAmount: Math.max(0, change) });
      const soldQtyByProduct = new Map<string, number>();
      for (const item of cart) {
        soldQtyByProduct.set(item.productId, (soldQtyByProduct.get(item.productId) || 0) + item.qty);
      }
      setProducts(prev => prev
        .map(p => soldQtyByProduct.has(p.id) ? { ...p, totalStock: p.totalStock - soldQtyByProduct.get(p.id)! } : p)
        .filter(p => p.totalStock > 0));
      setCart([]);
      setDiscount(0);
      setPointsToRedeem(0);
      setSelectedCustomer(null);
      setAmountTendered("");
      setNote("");
    } catch (err) {
      console.error("Checkout failed:", err);
      alert("Error processing sale. Please try again.");
    }
    setProcessing(false);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = await addCustomer(newCustomerForm);
    const newCust = { id: ref.id, ...newCustomerForm, loyaltyPoints: 0 } as Customer;
    setCustomers([...customers, newCust]);
    setSelectedCustomer(newCust);
    setShowAddCustomer(false);
    setShowCustomerPicker(false);
    setNewCustomerForm({ name: "", phone: "", email: "" });
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden">
      {/* Left: Product search */}
      <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-200 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100">
          <h1 className="font-prata text-xl text-black mb-3">New Sale</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                className="nexora-input pl-9"
                placeholder="Search product by name or SKU…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            <select
              className="nexora-input w-auto"
              value={filterMainCat}
              onChange={e => { setFilterMainCat(e.target.value); setFilterSubCat(""); }}
            >
              <option value="">All categories</option>
              {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="nexora-input w-auto"
              value={filterSubCat}
              onChange={e => setFilterSubCat(e.target.value)}
              disabled={!filterMainCat}
            >
              <option value="">All subcategories</option>
              {filterSubCatOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {(filterMainCat || filterSubCat) && (
              <button
                onClick={() => { setFilterMainCat(""); setFilterSubCat(""); }}
                className="nexora-btn nexora-btn-ghost text-xs py-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {filteredProducts.map(p => (
            <button
              key={p.id}
              onClick={() => openBatchPicker(p)}
              className="nexora-card p-3 text-left hover:border-black transition-colors group"
            >
              <p className="text-sm font-medium text-black group-hover:underline">{p.name}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{p.sku}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium">Rs. {p.sellingPrice?.toLocaleString()}</span>
                <span className={`badge ${p.totalStock <= 5 ? "badge-warning" : "badge-default"}`}>{p.totalStock}</span>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="col-span-2 sm:col-span-3 xl:col-span-4 text-center py-12 text-sm text-zinc-400">No products found</p>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="lg:flex-none lg:w-96 lg:min-h-0 flex flex-col bg-white lg:overflow-hidden">
        {/* Customer */}
        <div className="px-4 py-3 border-b border-zinc-100">
          <button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full flex items-center gap-2 p-2.5 rounded border border-zinc-200 hover:border-black transition-colors text-left"
          >
            <User size={14} className="text-zinc-400" />
            <span className={`text-sm flex-1 ${selectedCustomer ? "text-black font-medium" : "text-zinc-400"}`}>
              {selectedCustomer ? selectedCustomer.name : "Walk-in customer (tap to select)"}
            </span>
            {selectedCustomer && (
              <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null); setPointsToRedeem(0); }}>
                <X size={13} className="text-zinc-400" />
              </button>
            )}
          </button>
          {selectedCustomer ? (
            <p className="text-xs text-zinc-400 mt-1.5">
              <span className="text-amber-500 font-medium">{selectedCustomer.loyaltyPoints || 0} pts</span> available · Earns 1 pt per Rs. 100 spent
            </p>
          ) : (
            <p className="text-xs text-zinc-400 mt-1.5">Select a customer to earn <span className="font-medium">1% loyalty reward</span></p>
          )}
        </div>

        {/* Cart items */}
        <div className="lg:flex-1 lg:overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-300">
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Tap a product to add</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {cart.map(item => (
                <div key={item.tempId} className="px-4 py-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-medium text-black">{item.productName}</p>
                      <p className="text-xs text-zinc-400">
                        {item.units
                          ? `Serial: ${item.units.map(u => u.serialNumber).join(", ")}`
                          : item.batchId ? `Batch · Rs. ${item.costPrice?.toLocaleString()}/unit cost` : "Auto (FIFO)"}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.tempId)} className="text-zinc-300 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-zinc-200 rounded">
                      <button
                        onClick={() => item.units ? removeLastUnit(item) : updateQty(item.tempId, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                      <button
                        onClick={() => {
                          if (item.units) { openSerialPicker(products.find(p => p.id === item.productId)!); return; }
                          const product = products.find(p => p.id === item.productId);
                          if (product && item.qty >= product.totalStock) return;
                          updateQty(item.tempId, item.qty + 1);
                        }}
                        disabled={!item.units && (products.find(p => p.id === item.productId)?.totalStock ?? Infinity) <= item.qty}
                        className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={item.discount || ""}
                      onChange={e => updateDiscount(item.tempId, Number(e.target.value))}
                      className="nexora-input flex-1 py-1.5 text-xs"
                      placeholder="Discount"
                    />
                    <span className="text-sm font-medium text-black w-20 text-right">Rs. {item.lineTotal.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="border-t border-zinc-100 px-4 py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Bill Discount</span>
            <input
              type="number"
              value={discount || ""}
              onChange={e => setDiscount(Number(e.target.value))}
              className="nexora-input w-28 py-1.5 text-sm text-right"
              placeholder="0"
            />
          </div>
          {selectedCustomer && (selectedCustomer.loyaltyPoints || 0) > 0 && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-zinc-500">Redeem Points</span>
                <p className="text-xs text-zinc-400">{(selectedCustomer.loyaltyPoints || 0)} pts available</p>
              </div>
              <input
                type="number"
                value={pointsToRedeem || ""}
                onChange={e => {
                  const val = Number(e.target.value);
                  const max = Math.min(selectedCustomer.loyaltyPoints || 0, Math.floor(subtotal - discount));
                  setPointsToRedeem(Math.max(0, Math.min(val, max)));
                }}
                className="nexora-input w-28 py-1.5 text-sm text-right"
                placeholder="0"
                max={Math.min(selectedCustomer.loyaltyPoints || 0, Math.floor(subtotal - discount))}
                min={0}
              />
            </div>
          )}
          <div className="flex justify-between font-prata text-lg border-t border-zinc-100 pt-2">
            <span>Total</span>
            <span>Rs. {totalAmount.toLocaleString()}</span>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "card", "transfer"] as const).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-2 text-xs font-medium rounded border transition-colors capitalize ${
                  paymentMethod === m ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-500 hover:border-black"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div>
              <input
                type="number"
                value={amountTendered}
                onChange={e => setAmountTendered(e.target.value)}
                className="nexora-input"
                placeholder="Amount tendered"
              />
              {Number(amountTendered) > 0 && totalAmount > 0 && Number(amountTendered) >= totalAmount && (
                <p className="text-xs text-green-600 mt-1 font-medium">Change: Rs. {change.toLocaleString()}</p>
              )}
            </div>
          )}

          {selectedCustomer && cart.length > 0 && (
            <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-50 rounded px-3 py-2">
              <span>Points after this sale</span>
              <span className="font-medium text-zinc-600">
                {(selectedCustomer.loyaltyPoints || 0) - pointsToRedeem + Math.floor((subtotal - discount) / 100)} pts
                <span className="text-green-600 ml-1">(+{Math.floor((subtotal - discount) / 100)})</span>
              </span>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
            className="nexora-btn nexora-btn-primary w-full justify-center py-3 text-base"
          >
            {processing ? "Processing…" : `Checkout — Rs. ${totalAmount.toLocaleString()}`}
          </button>
        </div>
      </div>

      {/* Batch picker modal */}
      {batchPickerProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">{batchPickerProduct.name}</h2>
              <button onClick={() => setBatchPickerProduct(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => addToCart(batchPickerProduct)}
                className="w-full text-left px-3 py-2.5 rounded border border-zinc-200 hover:border-black transition-colors"
              >
                <p className="text-sm font-medium">Auto (FIFO)</p>
                <p className="text-xs text-zinc-400">Bills from the oldest stock automatically</p>
              </button>
              {loadingBatches ? (
                <p className="text-xs text-zinc-400 text-center py-3">Loading batches…</p>
              ) : productBatches.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-3">No batches recorded for this product</p>
              ) : (
                productBatches.map((b, i) => {
                  const effectivePrice = b.sellingPrice ?? batchPickerProduct.sellingPrice;
                  const isLoss = effectivePrice < b.costPrice;
                  return (
                    <button
                      key={b.id}
                      onClick={() => addToCart(batchPickerProduct, { id: b.id, costPrice: b.costPrice, sellingPrice: b.sellingPrice })}
                      className="w-full text-left px-3 py-2.5 rounded border border-zinc-200 hover:border-black transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">Batch {i + 1}</p>
                        <p className="text-xs text-zinc-400">
                          Cost Rs. {b.costPrice?.toLocaleString()} · Sells Rs. {effectivePrice?.toLocaleString()} · {b.remainingQty} left
                        </p>
                      </div>
                      {isLoss && <span className="badge badge-danger text-xs shrink-0 ml-2">Selling at a loss</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Serial picker modal */}
      {serialPickerProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">{serialPickerProduct.name}</h2>
              <button onClick={() => setSerialPickerProduct(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-3">
              <p className="text-xs text-zinc-400 mb-2">Select the unit(s) being sold by serial number</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {loadingUnits ? (
                  <p className="text-xs text-zinc-400 text-center py-3">Loading serial numbers…</p>
                ) : availableUnits.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-3">No serialized units in stock for this product</p>
                ) : (
                  availableUnits.map(u => {
                    const price = u.sellingPrice ?? serialPickerProduct.sellingPrice;
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUnitSelected(u.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded border transition-colors ${
                          selectedUnitIds.includes(u.id) ? "border-black bg-zinc-50" : "border-zinc-200 hover:border-black"
                        }`}
                      >
                        <span className="text-sm font-mono">{u.serialNumber}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">Rs. {price.toLocaleString()}</span>
                          {selectedUnitIds.includes(u.id) && <Check size={13} className="text-black" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                onClick={() => addSerializedToCart(serialPickerProduct)}
                disabled={selectedUnitIds.length === 0}
                className="nexora-btn nexora-btn-primary w-full justify-center mt-3"
              >
                Add {selectedUnitIds.length || ""} to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer picker modal */}
      {showCustomerPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">Select Customer</h2>
              <button onClick={() => setShowCustomerPicker(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-3">
              <input
                className="nexora-input mb-2"
                placeholder="Search name or phone…"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-zinc-400">{c.phone}</p>
                    </div>
                    {selectedCustomer?.id === c.id && <Check size={13} className="text-green-500" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddCustomer(true)}
                className="nexora-btn nexora-btn-outline w-full justify-center mt-2 text-sm">
                <Plus size={13} /> New Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add customer modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">New Customer</h2>
              <button onClick={() => setShowAddCustomer(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-4 space-y-3">
              <input className="nexora-input" required placeholder="Full name" value={newCustomerForm.name} onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})} />
              <input className="nexora-input" required placeholder="Phone number" value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} />
              <input className="nexora-input" placeholder="Email (optional)" value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})} />
              <button type="submit" className="nexora-btn nexora-btn-primary w-full justify-center">Add Customer</button>
            </form>
          </div>
        </div>
      )}

      {/* Completed sale modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 text-center relative">
            <button onClick={() => setCompletedSale(null)} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600">
              <X size={18} />
            </button>
            <div className="px-6 py-8">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={22} className="text-green-600" />
              </div>
              <h2 className="font-prata text-xl text-black mb-1">Sale Complete</h2>
              <p className="text-zinc-500 text-sm mb-1">{completedSale.invoiceNo}</p>
              <p className="text-2xl font-prata text-black mt-3">Rs. {completedSale.totalAmount?.toLocaleString()}</p>
              {completedSale.change > 0 && (
                <p className="text-green-600 text-sm mt-1">Change: Rs. {completedSale.change.toLocaleString()}</p>
              )}
              <div className="flex gap-3 mt-6">
                <button onClick={() => { handlePrint(); }} className="nexora-btn nexora-btn-outline flex-1 justify-center">
                  <Printer size={14} /> Print Bill
                </button>
                <button onClick={() => setCompletedSale(null)} className="nexora-btn nexora-btn-primary flex-1 justify-center">
                  New Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      <div className="hidden">
        <div ref={printRef}>
          {completedSale && <BillPrint sale={completedSale} />}
        </div>
      </div>
    </div>
  );
}
