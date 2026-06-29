"use client";
import { useEffect, useState, useRef } from "react";
import { getProducts, getCustomers, addCustomer, createSale, getBatches } from "@/lib/firestore";
import { Product, Customer, CartItem } from "@/types";
import { Search, Plus, Minus, Trash2, Printer, User, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import BillPrint from "@/components/pos/BillPrint";
import { useReactToPrint } from "react-to-print";

export default function SalesPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });

  useEffect(() => {
    async function load() {
      const [p, c] = await Promise.all([getProducts(), getCustomers()]);
      setProducts(p.filter((p: any) => p.active && p.totalStock > 0) as Product[]);
      setCustomers(c as Customer[]);
    }
    load();
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.includes(productSearch)
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
  );

  const openBatchPicker = async (product: Product) => {
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
  const totalAmount = Math.max(0, subtotal - discount);
  const change = Number(amountTendered) - totalAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const result = await createSale({
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "Walk-in Customer",
        cashierId: user!.uid,
        cashierName: user!.email || "Cashier",
        items: cart,
        subtotal,
        discountAmount: discount,
        taxAmount: 0,
        totalAmount,
        paymentMethod,
        paymentStatus: "paid",
        amountTendered: Number(amountTendered) || totalAmount,
        changeAmount: Math.max(0, change),
        note,
      });
      setCompletedSale({ ...result, items: cart, totalAmount, customerName: selectedCustomer?.name || "Walk-in Customer", paymentMethod, amountTendered: Number(amountTendered), change: Math.max(0, change) });
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setAmountTendered("");
      setNote("");
    } catch (err) {
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
    <div className="flex h-screen overflow-hidden">
      {/* Left: Product search */}
      <div className="flex-1 flex flex-col border-r border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h1 className="font-prata text-xl text-black mb-3">New Sale</h1>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="nexora-input pl-9"
              placeholder="Search product by name or SKU…"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start">
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
            <p className="col-span-3 text-center py-12 text-sm text-zinc-400">No products found</p>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-white">
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
              <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null); }}>
                <X size={13} className="text-zinc-400" />
              </button>
            )}
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
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
                        {item.batchId ? `Batch · Rs. ${item.costPrice?.toLocaleString()}/unit cost` : "Auto (FIFO)"}
                      </p>
                    </div>
                    <button onClick={() => removeItem(item.tempId)} className="text-zinc-300 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-zinc-200 rounded">
                      <button onClick={() => updateQty(item.tempId, item.qty - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                      <button onClick={() => updateQty(item.tempId, item.qty + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 transition-colors">
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
              {Number(amountTendered) >= totalAmount && (
                <p className="text-xs text-green-600 mt-1 font-medium">Change: Rs. {change.toLocaleString()}</p>
              )}
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
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 text-center">
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
