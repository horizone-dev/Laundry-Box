import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  FileText, 
  Settings, 
  Wifi, 
  WifiOff,
  Printer, 
  Download,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Shirt,
  MessageSquare,
  CheckCircle,
  Clock
} from 'lucide-react';

const MENU_CATEGORIES = ['All', 'Wash & Iron', 'Dry Clean', 'Ironing Only'];

function App() {
  const [activeTab, setActiveTab] = useState('Billing');
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [orders, setOrders] = useState([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  // Constants
  const SHOP_ID = 'shop_123'; // Mock Shop ID
  const BRANCH_ID = 'branch_A';

  // Fetch items and orders
  useEffect(() => {
    fetchItems();
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Refresh orders every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchItems = () => {
    // For now using static items, but could fetch from local-server
    setMenuItems([
      { id: 1, name: 'Shirt', price: 15, category: 'Wash & Iron', icon: '👔' },
      { id: 2, name: 'Pant', price: 20, category: 'Wash & Iron', icon: '👖' },
      { id: 3, name: 'Towel', price: 10, category: 'Wash & Iron', icon: '🧺' },
      { id: 4, name: 'Suit', price: 50, category: 'Dry Clean', icon: '🧥' },
      { id: 5, name: 'Dress', price: 40, category: 'Dry Clean', icon: '👗' },
    ]);
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/orders');
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders');
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!customer.name || !customer.phone) return alert('Please enter customer details');

    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const orderData = {
      id: orderId,
      shopId: SHOP_ID,
      branchId: BRANCH_ID,
      customerName: customer.name,
      customerPhone: customer.phone,
      items: cart,
      total: cartTotal,
      paymentStatus: paymentStatus
    };

    try {
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      if (response.ok) {
        setCurrentOrderId(orderId);
        setShowReceiptModal(true);
        fetchOrders();
      }
    } catch (err) {
      alert('Failed to save order locally');
    }
  };

  const clearOrder = () => {
    setCart([]);
    setCustomer({ name: '', phone: '' });
    setShowReceiptModal(false);
  };

  const sendWhatsApp = () => {
    const message = `Hello ${customer.name}, your laundry bill at luNDRY is $${cartTotal.toFixed(2)}. Status: ${paymentStatus}. Thank you!`;
    window.open(`https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredItems = activeCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="header"><div className="brand"><Shirt size={28} /><span>luNDRY</span></div></div>
        <nav className="nav-menu">
          {['Dashboard', 'Billing', 'Customers', 'Reports'].map((tab) => (
            <div key={tab} className={`nav-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'Dashboard' && <LayoutDashboard size={20} />}
              {tab === 'Billing' && <Receipt size={20} />}
              {tab === 'Customers' && <Users size={20} />}
              {tab === 'Reports' && <FileText size={20} />}
              <span>{tab}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <h1>{activeTab}</h1>
          <div className="sync-status">
            <Wifi size={16} /> <span>Online</span> <div className="sync-indicator"></div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === 'Billing' && (
            <div className="billing-container">
              <div className="items-section">
                <div className="customer-form card">
                  <input type="text" placeholder="Customer Name" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                  <input type="text" placeholder="Phone Number" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                
                <div className="categories">
                  {MENU_CATEGORIES.map(cat => (
                    <button key={cat} className={`category-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
                  ))}
                </div>
                
                <div className="items-grid">
                  {filteredItems.map(item => (
                    <div key={item.id} className="item-card" onClick={() => addToCart(item)}>
                      <div className="item-icon">{item.icon}</div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-price">${item.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cart-section card">
                <h2>Current Order</h2>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div>{item.name}</div>
                      <div className="cart-item-controls">
                        <button onClick={() => updateQty(item.id, -1)}><Minus size={14}/></button>
                        <span>{item.qty}</span>
                        <button onClick={() => addToCart(item)}><Plus size={14}/></button>
                      </div>
                      <div>${item.price * item.qty}</div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div className="summary-total"><span>Total</span><span>${cartTotal}</span></div>
                  <button className="btn-primary" onClick={handleCheckout}>Checkout</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Dashboard' && (
            <div className="dashboard-content">
              <div className="dashboard-cards">
                <div className="card"><h3>Total Orders</h3><p>{orders.length}</p></div>
                <div className="card"><h3>Revenue</h3><p>${orders.reduce((s, o) => s + o.total, 0)}</p></div>
                <div className="card"><h3>Pending</h3><p>{orders.filter(o => o.paymentStatus === 'Pending').length}</p></div>
              </div>
              
              <div className="orders-table card">
                <h2>Recent Orders</h2>
                <table>
                  <thead>
                    <tr><th>ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Sync</th></tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map(o => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.customerName}</td>
                        <td>${o.total}</td>
                        <td>{o.paymentStatus}</td>
                        <td>{o.isSynced ? <CheckCircle size={16} color="green"/> : <Clock size={16} color="orange"/>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {showReceiptModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>Order Success</h2><button onClick={() => setShowReceiptModal(false)}><X/></button></div>
            <div className="modal-body">
              <p>Order <strong>{currentOrderId}</strong> has been saved.</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={sendWhatsApp}><MessageSquare size={18}/> WhatsApp</button>
                <button className="btn-primary" onClick={() => { window.print(); clearOrder(); }}>Print Receipt</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
