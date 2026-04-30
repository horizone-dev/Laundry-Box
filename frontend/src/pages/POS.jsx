import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Minus, ShoppingBag, Trash2, CheckCircle, 
  X, ChevronDown, Shirt, Bed, Wind, Layers, 
  Droplet, Zap, Heart, Sparkles, User, CreditCard, Wallet, 
  Gift, Printer, Receipt, Edit3
} from 'lucide-react';
import styles from './POS.module.css';

const SERVICES = [
  { id: '1', name: "Men's Shirt", price: 3.50, icon: <Shirt size={24} /> },
  { id: '2', name: "Women's Dress", price: 8.00, icon: <Heart size={24} /> },
  { id: '3', name: "Suit Jacket", price: 12.50, icon: <Layers size={24} /> },
  { id: '4', name: "Pants", price: 5.00, icon: <Shirt size={24} /> },
  { id: '5', name: "Bedding", price: 15.00, icon: <Bed size={24} /> },
  { id: '6', name: "Underwear", price: 1.50, icon: <Wind size={24} /> },
  { id: '7', name: "Bulk Load (5kg)", price: 12.00, icon: <Layers size={24} /> },
  { id: '8', name: "Winter Coat", price: 18.00, icon: <Sparkles size={24} /> },
];

const SERVICE_TYPES = [
  { id: 'wf', name: 'Wash & Fold', price: 4.50, icon: <Droplet size={18} /> },
  { id: 'dc', name: 'Dry Clean', price: 7.25, icon: <Wind size={18} /> },
  { id: 'po', name: 'Pressing Only', price: 3.00, icon: <Layers size={18} /> },
  { id: 'ew', name: 'Eco-Wash', price: 5.50, icon: <Zap size={18} /> },
];

const ADDONS = [
  { id: 'sd', name: 'Scented Detergent', price: 0.50, icon: <Droplet size={14} /> },
  { id: 'fs', name: 'Fabric Softener', price: 0.50, icon: <Sparkles size={14} /> },
  { id: 'ex', name: 'Express 4h', price: 5.00, icon: <Zap size={14} /> },
  { id: 'ds', name: 'Deep Sanitize', price: 2.00, icon: <Sparkles size={14} /> },
];

export default function POS() {
  const navigate = useNavigate();
  const [step, setStep] = useState('pos'); // pos, checkout
  const [cart, setCart] = useState([
    { id: '1', name: "Women's Dress", price: 8.00, type: 'Dry Clean', addons: ['Express 4h'], qty: 1 },
    { id: '2', name: "Men's Shirt", price: 3.50, type: 'Wash & Iron', addons: [], qty: 2 },
  ]);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceConfig, setServiceConfig] = useState({ type: 'wf', addons: [], qty: 1 });
  
  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const changeDue = parseFloat(tenderedAmount || 0) - total;

  const handleServiceClick = (service) => {
    setSelectedService(service);
    setServiceConfig({ type: 'wf', addons: [], qty: 1 });
  };

  const addToCart = () => {
    const type = SERVICE_TYPES.find(t => t.id === serviceConfig.type);
    const addons = ADDONS.filter(a => serviceConfig.addons.includes(a.id));
    const addonPrice = addons.reduce((sum, a) => sum + a.price, 0);
    
    const newItem = {
      id: Date.now().toString(),
      serviceId: selectedService.id,
      name: selectedService.name,
      price: type.price + addonPrice,
      type: type.name,
      addons: addons.map(a => a.name),
      qty: serviceConfig.qty
    };
    
    setCart([...cart, newItem]);
    setSelectedService(null);
  };

  const removeCartItem = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const toggleAddon = (id) => {
    setServiceConfig(prev => ({
      ...prev,
      addons: prev.addons.includes(id) 
        ? prev.addons.filter(a => a !== id) 
        : [...prev.addons, id]
    }));
  };

  const handleCompletePayment = async () => {
    const orderId = `#AG-${Math.floor(10000 + Math.random() * 90000)}`;
    
    if (window.electronAPI?.dbQuery) {
      try {
        await window.electronAPI.dbQuery(
          `INSERT INTO orders (id, shopId, branchId, customerId, status, totalAmount, items, createdAt, isSynced, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            'SHOP_01',
            'BRANCH_01',
            'Julian Reed', // In a real app, this would be selected
            'PAID',
            total,
            JSON.stringify(cart),
            new Date().toISOString(),
            0,
            new Date().toISOString()
          ]
        );
        navigate(`/invoice/${orderId.replace('#', '')}`);
      } catch (err) {
        console.error("Failed to save order:", err);
        // Fallback for demo if DB fails
        navigate(`/invoice/${orderId.replace('#', '')}`);
      }
    } else {
      // Web fallback
      navigate(`/invoice/${orderId.replace('#', '')}`);
    }
  };

  if (step === 'checkout') {
    return (
      <div className={styles.checkoutContainer}>
        {/* Left: Order Summary */}
        <div className={styles.summarySection}>
          <div className={styles.summaryHeader}>
            <h2>Order Summary</h2>
            <Edit3 size={18} className={styles.clearCart} onClick={() => setStep('pos')} />
          </div>
          <div className={styles.summaryCard}>
            <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Ticket #7721 • Customer: Julian Reed</p>
            {cart.map((item, idx) => (
              <div key={idx} className={styles.cartItem}>
                <div className={styles.cartItemIcon}>{SERVICES.find(s => s.name === item.name)?.icon || <Shirt />}</div>
                <div className={styles.cartItemDetails}>
                  <span className={styles.cartItemName}>{item.name}</span>
                  <span className={styles.cartItemMeta}>{item.type.toUpperCase()}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={styles.cartItemMeta}>{item.qty} x ${item.price.toFixed(2)}</span>
                  <p className={styles.cartItemPrice}>${(item.price * item.qty).toFixed(2)}</p>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
              <div className={styles.cartRow}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className={styles.cartRow}><span>Tax (8.5%)</span><span>${tax.toFixed(2)}</span></div>
              <div className={`${styles.cartRow} ${styles.totalRow}`}><span>Grand Total</span><span className={styles.totalValue}>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {/* Right: Payment */}
        <div className={styles.paymentSection}>
          <div className={styles.amountGrid}>
            <div className={styles.amountBox}>
              <span className={styles.amountBoxLabel}>Amount Due</span>
              <span className={styles.amountBoxValue}>${total.toFixed(2)}</span>
            </div>
            <div className={styles.amountBox}>
              <span className={styles.amountBoxLabel}>Tendered</span>
              <span className={styles.amountBoxValue}>${tenderedAmount || '0.00'}</span>
            </div>
            <div className={`${styles.amountBox} ${changeDue > 0 ? styles.amountBoxChange : ''}`}>
              <span className={styles.amountBoxLabel}>Change Due</span>
              <span className={styles.amountBoxValue}>${changeDue > 0 ? changeDue.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          <div>
            <h3 className={styles.modalSectionTitle}>Payment Method</h3>
            <div className={styles.paymentMethods}>
              <MethodCard id="cash" label="Cash" icon={<Wallet />} active={paymentMethod === 'cash'} onClick={setPaymentMethod} />
              <MethodCard id="card" label="Credit Card" icon={<CreditCard />} active={paymentMethod === 'card'} onClick={setPaymentMethod} />
              <MethodCard id="wallet" label="Digital Wallet" icon={<Wallet />} active={paymentMethod === 'wallet'} onClick={setPaymentMethod} />
              <MethodCard id="gift" label="Gift Card" icon={<Gift />} active={paymentMethod === 'gift'} onClick={setPaymentMethod} />
            </div>
          </div>

          <div className={styles.checkoutBottom}>
            <div>
              <h3 className={styles.modalSectionTitle}>Enter Amount</h3>
              <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                  <button key={n} className={styles.numBtn} onClick={() => setTenderedAmount(prev => prev + n.toString())}>{n}</button>
                ))}
                <button className={`${styles.numBtn} ${styles.numBtnAction}`} onClick={() => setTenderedAmount('')}><X size={24} /></button>
                <button className={`${styles.numBtn} ${styles.numBtnSpecial}`} style={{ gridColumn: 'span 3', height: '48px' }} onClick={() => setTenderedAmount(total.toFixed(2))}>Exact Cash</button>
              </div>
            </div>

            <div className={styles.checkoutActions}>
              <div className={styles.checkoutOptions}>
                <div className={styles.optionToggle} onClick={() => setPrintReceipt(!printReceipt)}>
                  <div className={`${styles.switch} ${printReceipt ? styles.switchOn : ''}`}>
                    <div className={styles.switchHandle}></div>
                  </div>
                  <div className={styles.optionToggleText}>
                    <span className={styles.optionToggleLabel}>Print Receipt</span>
                    <span className={styles.optionToggleSub}>Automatically print after payment</span>
                  </div>
                </div>
              </div>

              <button className={styles.completeBtn} onClick={handleCompletePayment}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Printer size={28} />
                  Complete Payment & {printReceipt ? 'Print' : 'Finalize'} Receipt
                </div>
                <p>Send digital receipt to julian.r@email.com</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.posContainer}>
      {/* Left: Service Selection */}
      <div className={styles.mainSection}>
        <div className={styles.searchBar}>
          <Search size={20} color="#94A3B8" />
          <input type="text" placeholder="Search orders, customers, or items..." />
        </div>

        <div className={styles.categoriesRow}>
          <div className={styles.categoryTabs}>
            <button className={`${styles.categoryTab} ${styles.active}`}>Laundry</button>
            <button className={styles.categoryTab}>Dry Cleaning</button>
            <button className={styles.categoryTab}>Alterations</button>
            <button className={styles.categoryTab}>Add-ons</button>
          </div>
          <div className={styles.activeStation}>
            <span className={styles.statusDot}></span>
            Active Station
          </div>
        </div>

        <div className={styles.itemsGrid}>
          {SERVICES.map((service) => (
            <div key={service.id} className={styles.itemCard} onClick={() => handleServiceClick(service)}>
              <div className={styles.itemIcon}>{service.icon}</div>
              <span className={styles.itemName}>{service.name}</span>
              <span className={styles.itemPrice}>${service.price.toFixed(2)}</span>
            </div>
          ))}
          <div className={`${styles.itemCard} ${styles.addItemCard}`}>
            <Plus size={32} color="#CBD5E1" />
          </div>
        </div>
      </div>

      {/* Right: Cart Sidebar */}
      <aside className={styles.cartSection}>
        <div className={styles.cartHeader}>
          <div className={styles.cartTitle}>
            <h3>Current Order</h3>
            <span className={styles.cartSub}>Table 04 • Customer: Walk-in</span>
          </div>
          <Trash2 size={18} className={styles.clearCart} onClick={() => setCart([])} />
        </div>

        <div className={styles.cartItems}>
          {cart.map((item, idx) => (
            <div key={idx} className={styles.cartItem}>
              <div className={styles.cartItemIcon}>
                {SERVICES.find(s => s.name === item.name)?.icon || <Shirt size={20} />}
              </div>
              <div className={styles.cartItemDetails}>
                <span className={styles.cartItemName}>{item.name}</span>
                <span className={styles.cartItemMeta}>${item.price.toFixed(2)} each</span>
              </div>
              <div className={styles.qtyControl}>
                <button className={styles.qtyBtn} onClick={() => removeCartItem(idx)}><Minus size={14} /></button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.qty}</span>
                <button className={styles.qtyBtn}><Plus size={14} /></button>
              </div>
              <div className={styles.cartItemPrice}>${(item.price * item.qty).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className={styles.cartFooter}>
          <div className={styles.cartRow}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className={styles.cartRow}><span>Tax (8%)</span><span>${tax.toFixed(2)}</span></div>
          <div className={`${styles.cartRow} ${styles.totalRow}`}><span>Total</span><span className={styles.totalValue}>${total.toFixed(2)}</span></div>
          
          <div className={styles.cartActions}>
            <button className={styles.secondaryBtn}><Receipt size={18} /> Discount</button>
            <button className={styles.secondaryBtn}><Receipt size={18} /> Quote</button>
            <button className={styles.submitBtn} onClick={() => setStep('checkout')}>
              <ShoppingBag size={20} /> Submit Order & Print
            </button>
          </div>
        </div>
      </aside>

      {/* Service Modal */}
      {selectedService && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <h2>Select Service - {selectedService.name}</h2>
                <p>Configure your treatment and options</p>
              </div>
              <X size={24} className={styles.closeBtn} onClick={() => setSelectedService(null)} />
            </div>
            
            <div className={styles.modalBody}>
              <div>
                <h3 className={styles.modalSectionTitle}>Service Type</h3>
                <div className={styles.optionGrid}>
                  {SERVICE_TYPES.map(type => (
                    <div 
                      key={type.id} 
                      className={`${styles.optionCard} ${serviceConfig.type === type.id ? styles.active : ''}`}
                      onClick={() => setServiceConfig(prev => ({ ...prev, type: type.id }))}
                    >
                      <div className={styles.optionIcon}>{type.icon}</div>
                      <div className={styles.optionDetails}>
                        <span className={styles.optionName}>{type.name}</span>
                        <span className={styles.optionPrice}>${type.price.toFixed(2)} / item</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={styles.modalSectionTitle}>Add-ons</h3>
                <div className={styles.optionGrid}>
                  {ADDONS.map(addon => (
                    <div 
                      key={addon.id} 
                      className={`${styles.optionCard} ${serviceConfig.addons.includes(addon.id) ? styles.active : ''}`}
                      onClick={() => toggleAddon(addon.id)}
                    >
                      <div className={styles.optionIcon}>{addon.icon}</div>
                      <span className={styles.optionName}>{addon.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.qtySection}>
                <div className={styles.qtyLabel}>
                  <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>QUANTITY</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Number of identical items</span>
                </div>
                <div className={styles.qtyLarge}>
                  <button className={styles.qtyControlBtn} onClick={() => setServiceConfig(prev => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}>-</button>
                  <input type="text" value={serviceConfig.qty.toString().padStart(2, '0')} readOnly />
                  <button className={`${styles.qtyControlBtn} ${styles.qtyControlBtnPrimary}`} onClick={() => setServiceConfig(prev => ({ ...prev, qty: prev.qty + 1 }))}>+</button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setSelectedService(null)}>Cancel</button>
              <button className={styles.submitBtn} onClick={addToCart}>Add to Order • $14.50</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodCard({ id, label, icon, active, onClick }) {
  return (
    <div className={`${styles.methodCard} ${active ? styles.active : ''}`} onClick={() => onClick(id)}>
      <div className={styles.methodIcon}>{icon}</div>
      <span className={styles.methodName}>{label}</span>
    </div>
  );
}
