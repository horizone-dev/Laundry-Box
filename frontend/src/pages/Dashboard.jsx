import React, { useState, useEffect } from 'react';
import { 
  DollarSign, ShoppingBag, Users, Clock, TrendingUp, 
  TrendingDown, Calendar, Package, MoreHorizontal, CheckCircle, 
  AlertCircle, Truck, Plus, Printer, RefreshCw, Landmark, 
  Activity, Trash2, Smartphone, Cpu, ShieldCheck, FileText
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';
import CurrencySymbol from '../components/CurrencySymbol';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings, formatDate } = useSettings();
  const [dateRange, setDateRange] = useState('Today');
  const [loading, setLoading] = useState(true);
  
  // Stats state
  const [stats, setStats] = useState({
    revenue: 0,
    revenueTrend: { val: '+0.0%', isUp: true },
    ordersCount: 0,
    ordersTrend: { val: '+0.0%', isUp: true },
    pendingCount: 0,
    pendingTrend: { val: '+0.0%', isUp: true },
    outForDeliveryCount: 0,
    deliveryTrend: { val: '+0.0%', isUp: true },
    completedTodayCount: 0,
    completedTrend: { val: '+0.0%', isUp: true },
    dueAmount: 0,
    dueTrend: { val: '+0.0%', isUp: true }
  });

  const [revenueGrowth, setRevenueGrowth] = useState({ val: '+0.0%', isUp: true });
  const [revenueData, setRevenueData] = useState([]);
  const [statusData, setStatusData] = useState({ data: [], total: 0, list: [] });
  const [operationsBoard, setOperationsBoard] = useState({ new: [], processing: [], ready: [], outForDelivery: [] });
  const [recentPayments, setRecentPayments] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [footerStats, setFooterStats] = useState({ confirmedCount: 0, totalActive: 0, deliveredCount: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      // 1. Fetch all orders and payments
      const ordersRes = await window.electronAPI.dbQuery('SELECT * FROM orders ORDER BY createdAt DESC', []);
      const paymentsRes = await window.electronAPI.dbQuery(
        `SELECT p.*, c.name as customerName 
         FROM payments p 
         LEFT JOIN customers c ON p.customerId = c.id 
         ORDER BY p.createdAt DESC`, 
        []
      );

      const allOrders = ordersRes.success ? ordersRes.data : [];
      const allPayments = paymentsRes.success ? paymentsRes.data : [];

      // 2. Process KPIs and Trends
      const processedKPIs = processStats(allOrders, allPayments, dateRange);
      setStats(processedKPIs);

      // 2.5 Calculate revenue growth (last 7 days vs previous 7 days)
      const getDaysAgoLocal = (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d;
      };
      
      const current7DaysStrs = [];
      for (let i = 0; i < 7; i++) {
        const d = getDaysAgoLocal(i);
        current7DaysStrs.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }

      const previous7DaysStrs = [];
      for (let i = 7; i < 14; i++) {
        const d = getDaysAgoLocal(i);
        previous7DaysStrs.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }

      const curr7DaysRevenue = allOrders.reduce((sum, o) => {

        const hasMatch = current7DaysStrs.some(dateStr => o.createdAt.startsWith(dateStr));
        return hasMatch ? sum + o.totalAmount : sum;
      }, 0);

      const prev7DaysRevenue = allOrders.reduce((sum, o) => {

        const hasMatch = previous7DaysStrs.some(dateStr => o.createdAt.startsWith(dateStr));
        return hasMatch ? sum + o.totalAmount : sum;
      }, 0);

      let growthVal = '+0.0%';
      let isGrowthUp = true;
      if (prev7DaysRevenue > 0) {
        const pct = ((curr7DaysRevenue - prev7DaysRevenue) / prev7DaysRevenue) * 100;
        growthVal = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
        isGrowthUp = pct >= 0;
      } else if (curr7DaysRevenue > 0) {
        growthVal = '+100.0%';
        isGrowthUp = true;
      }
      setRevenueGrowth({ val: growthVal, isUp: isGrowthUp });

      // 3. Process Revenue Trend (last 7 days)
      const formattedChart = generateRevenueTrend(allOrders);
      setRevenueData(formattedChart);

      // 4. Process Donut Chart (Order Status Overview)
      const overview = getOrderStatusOverview(allOrders);
      setStatusData(overview);

      // 5. Process Operations Board Columns
      const board = getOperationsBoardData(allOrders);
      setOperationsBoard(board);

      // 6. Process Recent Payments
      const processedPayments = processRecentPayments(allPayments, allOrders);
      setRecentPayments(processedPayments);

      // 7. Process Top Services
      const servicesRank = calculateTopServices(allOrders);
      setTopServices(servicesRank);

      // 8. Footer: Confirmed Work stats
      const activeOrders = allOrders.filter(o => !['Delivered'].includes(o.status));
      const confirmedOrders = activeOrders.filter(o => !['Pending', 'Payment Pending'].includes(o.status));
      const deliveredOrders = allOrders.filter(o => o.status === 'Delivered');
      setFooterStats({
        confirmedCount: confirmedOrders.length,
        totalActive: activeOrders.length,
        deliveredCount: deliveredOrders.length
      });

    } catch (err) {
      console.error("Dashboard calculation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // KPI processing helper
  const processStats = (allOrders, allPayments, range) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    const getDaysAgo = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };
    
    let currentOrders = [];
    let previousOrders = [];
    
    if (range === 'Today') {
      const yesterdayStr = (() => { const d = getDaysAgo(1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      currentOrders = allOrders.filter(o => o.createdAt.startsWith(todayStr));
      previousOrders = allOrders.filter(o => o.createdAt.startsWith(yesterdayStr));
    } else if (range === 'Week') {
      const sevenDaysAgo = getDaysAgo(7);
      const fourteenDaysAgo = getDaysAgo(14);
      
      currentOrders = allOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
      previousOrders = allOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      });
    } else { // Month
      const thirtyDaysAgo = getDaysAgo(30);
      const sixtyDaysAgo = getDaysAgo(60);
      
      currentOrders = allOrders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
      previousOrders = allOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      });
    }
    
    const getRevenue = (list) => list.reduce((sum, o) => sum + o.totalAmount, 0);
    const currRevenue = getRevenue(currentOrders);
    const prevRevenue = getRevenue(previousOrders);
    
    const currOrdersCount = currentOrders.length;
    const prevOrdersCount = previousOrders.length;
    
    // Core KPIs
    const totalPendingCount = allOrders.filter(o => !['Delivered'].includes(o.status)).length;
    const totalOutForDeliveryCount = allOrders.filter(o => o.status === 'Out for Delivery').length;
    const totalCompletedToday = allOrders.filter(o => o.status === 'Delivered' && o.createdAt.startsWith(todayStr)).length;
    const totalDueAmount = allOrders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);
    
    const calculateTrend = (curr, prev) => {
      if (!prev || prev === 0) return { val: '+0.0%', isUp: true };
      const change = ((curr - prev) / prev) * 100;
      return {
        val: (change >= 0 ? '+' : '') + change.toFixed(1) + '%',
        isUp: change >= 0
      };
    };
    
    const revenueTrend = calculateTrend(currRevenue, prevRevenue);
    const ordersTrend = calculateTrend(currOrdersCount, prevOrdersCount);
    
    const completedYesterday = allOrders.filter(o => {
      const d = getDaysAgo(1);
      const yStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return o.status === 'Delivered' && o.createdAt.includes(yStr);
    }).length;
    const completedTrend = calculateTrend(totalCompletedToday, completedYesterday);
    
    const pendingYesterday = allOrders.filter(o => !['Delivered'].includes(o.status) && o.createdAt < todayStr).length;
    const pendingTrend = calculateTrend(totalPendingCount, pendingYesterday);

    const yesterday = getDaysAgo(1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

    const getOrderStatusAtDate = (order, dateStr) => {
      let history = [];
      try {
        history = typeof order.statusHistory === 'string'
          ? JSON.parse(order.statusHistory || '[]')
          : (order.statusHistory || []);
      } catch (e) {}

      if (!Array.isArray(history) || history.length === 0) {
        const orderDate = new Date(order.createdAt);
        const limitDate = new Date(dateStr + 'T23:59:59');
        return orderDate <= limitDate ? order.status : null;
      }

      const limitDate = new Date(dateStr + 'T23:59:59');
      const recordsBefore = history.filter(h => new Date(h.timestamp) <= limitDate);
      if (recordsBefore.length === 0) return null;

      recordsBefore.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return recordsBefore[0].status;
    };

    const outForDeliveryYesterday = allOrders.filter(o => getOrderStatusAtDate(o, yesterdayStr) === 'Out for Delivery').length;
    const deliveryTrend = calculateTrend(totalOutForDeliveryCount, outForDeliveryYesterday);

    const dueAmountYesterday = allOrders.reduce((sum, o) => {
      if (o.createdAt.startsWith(todayStr)) return sum;
      
      const statusYesterday = getOrderStatusAtDate(o, yesterdayStr);
      if (!statusYesterday) return sum;
      
      const orderPaymentsBeforeToday = allPayments.filter(p => p.orderId === o.id && new Date(p.createdAt) <= new Date(yesterdayStr + 'T23:59:59'));
      const paidBeforeToday = orderPaymentsBeforeToday.reduce((pSum, p) => pSum + p.amount, 0);
      
      const dueYesterday = Math.max(0, o.totalAmount - paidBeforeToday);
      return sum + dueYesterday;
    }, 0);
    const dueTrend = calculateTrend(totalDueAmount, dueAmountYesterday);

    return {
      revenue: currRevenue,
      revenueTrend,
      ordersCount: currOrdersCount,
      ordersTrend,
      pendingCount: totalPendingCount,
      pendingTrend,
      outForDeliveryCount: totalOutForDeliveryCount,
      deliveryTrend,
      completedTodayCount: totalCompletedToday,
      completedTrend,
      dueAmount: totalDueAmount,
      dueTrend
    };
  };

  // Generate 7-day revenue trend data
  const generateRevenueTrend = (allOrders) => {
    const last7Days = [];
    const getDaysAgo = (days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };
    for (let i = 6; i >= 0; i--) {
      const d = getDaysAgo(i);
      const localStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      last7Days.push({
        dateStr: localStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return last7Days.map(day => {
      const dayOrders = allOrders.filter(o => o.createdAt.startsWith(day.dateStr));
      const dayRev = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        name: day.label,
        revenue: dayRev
      };
    });
  };

  // Order status helper
  const getOrderStatusOverview = (allOrders) => {
    const statuses = [
      { name: 'Pending', count: 0, color: '#F97316' },
      { name: 'Washing', count: 0, color: '#3B82F6' },
      { name: 'Ironing', count: 0, color: '#8B5CF6' },
      { name: 'Ready', count: 0, color: '#EAB308' },
      { name: 'Delivered', count: 0, color: '#10B981' }
    ];
    
    allOrders.forEach(o => {
      if (['Confirmed', 'Payment Pending', 'Pending'].includes(o.status)) {
        statuses[0].count++;
      } else if (['Washing', 'Drying', 'Picked Up'].includes(o.status)) {
        statuses[1].count++;
      } else if (o.status === 'Ironing') {
        statuses[2].count++;
      } else if (['Ready', 'Ready to Pick up'].includes(o.status)) {
        statuses[3].count++;
      } else if (o.status === 'Delivered') {
        statuses[4].count++;
      }
    });
    
    const total = statuses.reduce((sum, s) => sum + s.count, 0);
    return {
      data: statuses.filter(s => s.count > 0),
      total,
      list: statuses
    };
  };

  // Operations Kanban Board helper
  const getOperationsBoardData = (allOrders) => {
    const board = { new: [], processing: [], ready: [], outForDelivery: [] };
    
    allOrders.forEach(o => {

      
      const orderData = {
        id: o.id,
        itemsSummary: getItemsSummary(o.items),
        timeLabel: getTimeAgo(o.createdAt),
        status: o.status,
        createdAt: o.createdAt
      };

      if (['Confirmed', 'Payment Pending', 'Pending'].includes(o.status)) {
        board.new.push(orderData);
      } else if (['Picked Up', 'Washing', 'Drying', 'Ironing'].includes(o.status)) {
        board.processing.push(orderData);
      } else if (['Ready', 'Ready to Pick up'].includes(o.status)) {
        board.ready.push(orderData);
      } else if (o.status === 'Out for Delivery') {
        board.outForDelivery.push(orderData);
      }
    });

    return board;
  };

  const getItemsSummary = (itemsJson) => {
    try {
      const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      if (!Array.isArray(items) || items.length === 0) return 'Laundry Items';
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 1), 0);
      const firstItemName = items[0]?.name || 'Garment';
      if (items.length === 1) {
        return `${totalQty} x ${firstItemName}`;
      }
      return `${totalQty} items (${firstItemName}...)`;
    } catch (e) {
      return 'Laundry Items';
    }
  };

  const getTimeAgo = (dateStr) => {
    const diffMs = new Date() - new Date(dateStr);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
    return formatDate(dateStr);
  };

  // Payments processing helper
  const processRecentPayments = (allPayments, allOrders) => {
    if (allPayments.length > 0) {
      return allPayments.slice(0, 3).map(p => ({
        ref: p.orderId ? (p.orderId.startsWith('#') ? p.orderId : `#${p.orderId}`) : `PAY-${p.id.slice(-5)}`,
        amount: p.amount,
        method: `Paid by ${p.method || 'Cash'}`,
        timeLabel: getTimeAgo(p.createdAt)
      }));
    }
    
    // Fallback: extract from recently paid orders
    const paidOrders = allOrders.filter(o => o.paymentStatus === 'Paid').slice(0, 3);
    return paidOrders.map(o => ({
      ref: o.id,
      amount: o.totalAmount,
      method: `Paid by ${o.paymentMethod || 'Cash'}`,
      timeLabel: getTimeAgo(o.updatedAt)
    }));
  };

  // Top services processing helper
  const calculateTopServices = (allOrders) => {
    const counts = {};
    allOrders.forEach(o => {

      try {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        if (Array.isArray(items)) {
          items.forEach(item => {
            const name = item.name || 'Other Services';
            counts[name] = (counts[name] || 0) + (item.qty || 1);
          });
        }
      } catch (e) {}
    });

    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const maxCount = sorted[0]?.count || 1;
    return sorted.map(s => ({
      ...s,
      percentage: (s.count / maxCount) * 100
    }));
  };

  // Get current user role
  let role = 'Manager';
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user.role) {
      role = user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ');
    }
  } catch (e) {}
  const getLateOrdersCount = () => {
    const activeOrders = [
      ...operationsBoard.new,
      ...operationsBoard.processing,
      ...operationsBoard.ready,
      ...operationsBoard.outForDelivery
    ];
    const threshold = settings.lateDeliveryDays || 3;
    return activeOrders.filter(o => {
      if (!o.createdAt) return false;
      const diffMs = new Date() - new Date(o.createdAt);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays > threshold;
    }).length;
  };

  return (
    <div className={styles.dashboard}>
      
      {/* ── Header ────────────────────────────────────────── */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Good morning, {role}! 👋</h1>
        </div>
        <div className={styles.headerFilters}>
          <div className={styles.datePickerWrapper}>
            <Calendar size={16} color="#64748B" />
            <span className={styles.dateVal}>{formatDate(new Date())}</span>
          </div>
          <div className={styles.dateFilter}>
            {['Today', 'Month'].map(range => (
              <button 
                key={range} 
                className={`${styles.dateBtn} ${dateRange === range ? styles.active : ''}`}
                onClick={() => setDateRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top Metrics Grid (6 cards) ────────────────────── */}
      <div className={styles.statsGrid}>
        <KPIItem title="Today Revenue" value={<><CurrencySymbol size={16} /> {stats.revenue.toFixed(2)}</>} trend={stats.revenueTrend.val} isUp={stats.revenueTrend.isUp} icon={<DollarSign size={20} />} iconBg="#ECFDF4" iconColor="#10B981" />
        <KPIItem title="Orders Today" value={stats.ordersCount} trend={stats.ordersTrend.val} isUp={stats.ordersTrend.isUp} icon={<ShoppingBag size={20} />} iconBg="#EFF6FF" iconColor="#3B82F6" />
        <KPIItem title="Pending Orders" value={stats.pendingCount} trend={stats.pendingTrend.val} isUp={!stats.pendingTrend.isUp} icon={<Clock size={20} />} iconBg="#FFF7ED" iconColor="#F97316" />
        <KPIItem title="Out for Delivery" value={stats.outForDeliveryCount} trend={stats.deliveryTrend.val} isUp={stats.deliveryTrend.isUp} icon={<Truck size={20} />} iconBg="#F5F3FF" iconColor="#8B5CF6" />
        <KPIItem title="Completed Today" value={stats.completedTodayCount} trend={stats.completedTrend.val} isUp={stats.completedTrend.isUp} icon={<CheckCircle size={20} />} iconBg="#ECFDF5" iconColor="#10B981" />
        <KPIItem title="Due Amount" value={<><CurrencySymbol size={16} /> {stats.dueAmount.toFixed(2)}</>} trend={stats.dueTrend.val} isUp={!stats.dueTrend.isUp} icon={<AlertCircle size={20} />} iconBg="#FEF2F2" iconColor="#EF4444" />
      </div>

      {/* ── Middle Row ────────────────────────────────────── */}
      <div className={styles.middleRow}>
        
        {/* Left: Revenue Trend */}
        <div className={`${styles.card} ${styles.chartCard}`}>
          <div className={styles.cardHeader}>
            <h3>Revenue Trend</h3>
            <div className={styles.cardSelect}>
              <span>Last 7 Days</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartDetails}>
            <div className={styles.chartStat}>
              <span className={styles.statLabel}>Total Revenue</span>
              <strong className={styles.statVal}><CurrencySymbol size={14} /> {revenueData.reduce((s, r) => s + r.revenue, 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>
            </div>
            <div className={styles.chartStat}>
              <span className={styles.statLabel}>Average per Day</span>
              <strong className={styles.statVal}><CurrencySymbol size={14} /> {(revenueData.reduce((s, r) => s + r.revenue, 0) / 7).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>
            </div>
            <div className={styles.chartStat}>
              <span className={styles.statLabel}>Best Day</span>
              <strong className={styles.statVal}>{[...revenueData].sort((a,b) => b.revenue - a.revenue)[0]?.name || 'N/A'}</strong>
            </div>
            <div className={styles.chartStat}>
              <span className={styles.statLabel}>Growth</span>
              <strong className={`${styles.statVal} ${revenueGrowth.isUp ? styles.upText : styles.downText}`}>{revenueGrowth.val}</strong>
            </div>
          </div>
        </div>

        {/* Center: Order Status Overview */}
        <div className={`${styles.card} ${styles.donutCard}`}>
          <div className={styles.cardHeader}>
            <h3>Order Status Overview</h3>
          </div>
          <div className={styles.donutBody}>
            <div style={{ width: 170, height: 170, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData.data.length > 0 ? statusData.data : [{ name: 'Empty', count: 1, color: '#E2E8F0' }]}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {(statusData.data.length > 0 ? statusData.data : [{ color: '#E2E8F0' }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <span className={styles.donutSub}>Total</span>
                <span className={styles.donutVal}>{statusData.total}</span>
                <span className={styles.donutSub}>Orders</span>
              </div>
            </div>
            <div className={styles.donutLegend}>
              {statusData.list.map(s => {
                const pct = statusData.total > 0 ? ((s.count / statusData.total) * 100).toFixed(0) : 0;
                return (
                  <div key={s.name} className={styles.legendItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className={styles.legendDot} style={{ background: s.color }}></span>
                      <span className={styles.legendLabel}>{s.name}</span>
                    </div>
                    <span className={styles.legendVal}>{s.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className={`${styles.card} ${styles.actionsCard}`}>
          <div className={styles.cardHeader}>
            <h3>Quick Actions</h3>
          </div>
          <div className={styles.actionsGrid}>
            <button className={styles.actionBtn} onClick={() => navigate('/pos')}>
              <Plus size={18} /> New Order
            </button>
            <button className={styles.actionBtn} onClick={() => navigate('/orders/expected-delivery')}>
              <Truck size={18} /> Today Delivery List
            </button>
            <button className={styles.actionBtn} onClick={() => navigate('/reports/customer-statement')}>
              <FileText size={18} /> Account Statement
            </button>
            <button className={styles.actionBtn} onClick={() => navigate('/expenses')}>
              <DollarSign size={18} /> Add Expense
            </button>
            <button className={styles.actionBtn} onClick={() => navigate('/settlement')}>
              <CheckCircle size={18} /> Settle Payment
            </button>
            <button className={styles.actionBtn} onClick={() => navigate('/orders')}>
              <Printer size={18} /> Print Invoice
            </button>
          </div>
        </div>

      </div>

      {/* ── Bottom Row ────────────────────────────────────── */}
      <div className={styles.bottomRow}>
        
        {/* Left: Operations Board */}
        <div className={`${styles.card} ${styles.boardCard}`}>
          <div className={styles.cardHeader}>
            <h3>Operations Board</h3>
            <span className={styles.viewAllBtn} onClick={() => navigate('/workflow')}>View board</span>
          </div>
          
          <div className={styles.boardColumns}>
            
            {/* New Orders */}
            <BoardColumn 
              title="New Orders" 
              count={operationsBoard.new.length} 
              orders={operationsBoard.new.slice(0, 4)} 
              badgeClass={styles.badgeNew}
              lateDeliveryDays={settings.lateDeliveryDays || 3}
            />

            {/* Processing */}
            <BoardColumn 
              title="Processing" 
              count={operationsBoard.processing.length} 
              orders={operationsBoard.processing.slice(0, 4)} 
              badgeClass={styles.badgeProcessing}
              lateDeliveryDays={settings.lateDeliveryDays || 3}
            />

            {/* Ready */}
            <BoardColumn 
              title="Ready" 
              count={operationsBoard.ready.length} 
              orders={operationsBoard.ready.slice(0, 4)} 
              badgeClass={styles.badgeReady}
              lateDeliveryDays={settings.lateDeliveryDays || 3}
            />

            {/* Out for Delivery */}
            <BoardColumn 
              title="Out for Delivery" 
              count={operationsBoard.outForDelivery.length} 
              orders={operationsBoard.outForDelivery.slice(0, 4)} 
              badgeClass={styles.badgeDelivery}
              lateDeliveryDays={settings.lateDeliveryDays || 3}
            />

          </div>
        </div>

        {/* Right Section: Recent Payments & Top Services */}
        <div className={styles.rightColumn}>
          
          {/* Recent Payments */}
          <div className={`${styles.card} ${styles.paymentsCard}`}>
            <div className={styles.cardHeader}>
              <h3>Recent Payments</h3>
              <span className={styles.viewAllBtn} onClick={() => navigate('/settlement')}>View all</span>
            </div>
            <div className={styles.paymentsList}>
              {recentPayments.map((p, idx) => (
                <div key={idx} className={styles.paymentItem}>
                  <div>
                    <span className={styles.paymentRef}>{p.ref}</span>
                    <span className={styles.paymentMethod}>{p.method}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.paymentAmount}><CurrencySymbol size={11} /> {p.amount.toFixed(2)}</div>
                    <span className={styles.paymentTime}>{p.timeLabel}</span>
                  </div>
                </div>
              ))}
              {recentPayments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748B', fontSize: '0.8rem' }}>No recent payments.</div>
              )}
            </div>
          </div>

          {/* Top Services */}
          <div className={`${styles.card} ${styles.servicesCard}`}>
            <div className={styles.cardHeader}>
              <h3>Top Services (This Month)</h3>
              <span className={styles.viewAllBtn} onClick={() => navigate('/reports/services')}>View report</span>
            </div>
            <div className={styles.servicesList}>
              {topServices.map((s, idx) => (
                <div key={idx} className={styles.serviceItem}>
                  <div className={styles.serviceHeader}>
                    <span className={styles.serviceName}>{s.name}</span>
                    <span className={styles.serviceCount}>{s.count} Orders</span>
                  </div>
                  <div className={styles.progressContainer}>
                    <div 
                      className={styles.progressBar} 
                      style={{ 
                        width: `${s.percentage}%`,
                        background: idx === 0 ? '#3B82F6' : idx === 1 ? '#F59E0B' : idx === 2 ? '#8B5CF6' : '#10B981'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
              {topServices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748B', fontSize: '0.8rem' }}>No service data.</div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── Footer Status Row ─────────────────────────────── */}
      <div className={styles.footerRow}>
        <FooterWidget
          label="Confirmed Work"
          val={`${footerStats.confirmedCount} / ${footerStats.totalActive}`}
          icon={<ShieldCheck size={16} />}
          progress={footerStats.totalActive > 0 ? Math.round((footerStats.confirmedCount / footerStats.totalActive) * 100) : 0}
        />
        <FooterWidget label="Delivered Count" val={footerStats.deliveredCount} icon={<CheckCircle size={16} />} />
        <FooterWidget label="Pickup Pending" val={operationsBoard.new.length} icon={<ShoppingBag size={16} />} />
        <FooterWidget label="Delivery Pending" val={operationsBoard.ready.length} icon={<Truck size={16} />} />
        <FooterWidget label="Late Orders" val={getLateOrdersCount()} icon={<Clock size={16} />} isWarning={true} />
      </div>

    </div>
  );
}

// Kanban Column Component
function BoardColumn({ title, count, orders, badgeClass, lateDeliveryDays }) {
  const navigate = useNavigate();
  const isOrderLate = (createdAt) => {
    if (!createdAt) return false;
    const diffMs = new Date() - new Date(createdAt);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > lateDeliveryDays;
  };

  return (
    <div className={styles.boardColumn}>
      <div className={styles.columnHeader}>
        <h4>{title}</h4>
        <span className={`${styles.columnBadge} ${badgeClass}`}>{count}</span>
      </div>
      <div className={styles.columnItems}>
        {orders.map(o => {
          const late = isOrderLate(o.createdAt);
          return (
            <div key={o.id} className={`${styles.boardCardItem} ${late ? styles.boardCardLate : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.boardCardId}>{o.id}</span>
                <span className={`${styles.boardCardTime} ${late ? styles.lateTime : ''}`}>
                  {late && <Clock size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'text-bottom' }} />}
                  {o.timeLabel}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                <span className={styles.boardCardSummary}>{o.itemsSummary}</span>
                {o.status !== 'Pending' && o.status !== 'Confirmed' && o.status !== 'Ready' && (
                  <span className={styles.boardCardStatus}>{o.status}</span>
                )}
              </div>
            </div>
          );
        })}
        {count === 0 && (
          <div className={styles.emptyColumn}>No orders</div>
        )}
      </div>
      {count > 4 && (
        <div className={styles.moreLabel} onClick={() => navigate('/workflow')}>+ {count - 4} more orders</div>
      )}
    </div>
  );
}

// KPI Item Component
function KPIItem({ title, value, trend, isUp, icon, iconBg, iconColor }) {
  return (
    <div className={styles.kpiCardItem}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIconWrapper} style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <span className={styles.kpiTitleText}>{title}</span>
      </div>
      <div className={styles.kpiContentBody}>
        <span className={styles.kpiValText}>{value}</span>
        <div className={styles.kpiTrendWrapper}>
          {isUp ? <TrendingUp size={12} className={styles.trendUpIcon} /> : <TrendingDown size={12} className={styles.trendDownIcon} />}
          <span className={`${styles.trendPct} ${isUp ? styles.upText : styles.downText}`}>{trend}</span>
          <span className={styles.trendSubText}>vs yesterday</span>
        </div>
      </div>
    </div>
  );
}

// Footer Status Widget Component
function FooterWidget({ label, val, icon, progress, isWarning, isSuccess }) {
  return (
    <div className={styles.footerWidget}>
      <div className={`${styles.footerIcon} ${isWarning ? styles.warningIcon : isSuccess ? styles.successIcon : ''}`}>
        {icon}
      </div>
      <div className={styles.footerInfo}>
        <span className={styles.footerLabel}>{label}</span>
        <strong className={styles.footerValue}>{val}</strong>
      </div>
      {progress !== undefined && (
        <div className={styles.footerMiniBarContainer}>
          <div className={styles.footerMiniBarFill} style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}
