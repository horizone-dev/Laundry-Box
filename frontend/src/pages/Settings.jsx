import React, { useState } from 'react';
import { 
  Plus, Upload, Info, CheckCircle, Shirt, 
  Wind, Layers, Droplet, Zap, Sparkles, Image as ImageIcon
} from 'lucide-react';
import styles from './Settings.module.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Service Management');

  return (
    <div className={styles.settingsPage}>
      <div className={styles.headerRow}>
        <h1>Settings</h1>
        <p>Configure services, company profiles, and system preferences.</p>
      </div>

      <div className={styles.tabs}>
        {['Service Management', 'Company Info', 'User Permissions', 'Inventory Rules', 'Payment Gateways'].map(tab => (
          <div 
            key={tab} 
            className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className={styles.settingsGrid}>
        {/* Main Column */}
        <div className={styles.mainContent}>
          {activeTab === 'Service Management' && (
            <>
              {/* Services & Pricing */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Services & Pricing</h2>
                  <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <Plus size={16} /> Add New Service
                  </button>
                </div>
                <table className={styles.settingsTable}>
                  <thead>
                    <tr>
                      <th>Service Name</th>
                      <th>Type</th>
                      <th>Base Price</th>
                      <th>Turnaround</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ServiceRow name="Standard Wash" type="Wash & Fold" price="$1.50 / lb" time="24 Hours" />
                    <ServiceRow name="Business Suit" type="Dry Clean" price="$15.00 / pc" time="48 Hours" />
                    <ServiceRow name="Wedding Gown" type="Heirloom" price="$120.00 / pc" time="1 Week" />
                  </tbody>
                </table>
              </div>

              {/* Service Add-ons */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Service Add-ons</h2>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <Plus size={16} /> Add Option
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                  Available extras for customers to customize their orders.
                </p>
                <div className={styles.addonsGrid}>
                  <AddonItem name="Scented Detergent" sub="Lavender, Lemon, or Ocean" price="+$0.50" icon={<Droplet size={18} />} />
                  <AddonItem name="Fabric Softener" sub="Premium softness treatment" price="+$0.75" icon={<Sparkles size={18} />} />
                  <AddonItem name="Express 4h" sub="Prioritized processing" price="+$10.00" icon={<Zap size={18} />} />
                  <AddonItem name="Deep Sanitize" sub="High-temp bacteria removal" price="+$2.00" icon={<Sparkles size={18} />} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'Company Info' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Business Profile</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                Manage your business identity and contact details.
              </p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Legal Business Name</label>
                  <input type="text" className={styles.inputField} defaultValue="Antigravity Laundry Services" />
                </div>
                <div className={styles.formGroup}>
                  <label>Tax ID / registration</label>
                  <input type="text" className={styles.inputField} defaultValue="TX-9920-X12" />
                </div>
                <div className={styles.formGroup}>
                  <label>Support Email</label>
                  <input type="email" className={styles.inputField} defaultValue="support@antigravity.com" />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Phone</label>
                  <input type="text" className={styles.inputField} defaultValue="+1 (555) 000-1234" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'User Permissions' && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Staff Roles & Access Control</h2>
                <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <Plus size={16} /> Invite Member
                </button>
              </div>
              <table className={styles.settingsTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Permissions</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Muhammed BN</td>
                    <td><span className={styles.badge}>Super Admin</span></td>
                    <td style={{ color: '#10B981' }}>Active</td>
                    <td style={{ fontSize: '0.75rem', color: '#64748B' }}>Full Access</td>
                    <td><span className={styles.editBtn}>Edit</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Sarah Chen</td>
                    <td><span className={styles.badge} style={{ background: '#F0FDF4', color: '#166534' }}>Manager</span></td>
                    <td style={{ color: '#10B981' }}>Active</td>
                    <td style={{ fontSize: '0.75rem', color: '#64748B' }}>POS, Reports, CRM</td>
                    <td><span className={styles.editBtn}>Edit</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Jack Dorsey</td>
                    <td><span className={styles.badge} style={{ background: '#F8FAFC', color: '#64748B' }}>Operator</span></td>
                    <td style={{ color: '#10B981' }}>Active</td>
                    <td style={{ fontSize: '0.75rem', color: '#64748B' }}>POS Only</td>
                    <td><span className={styles.editBtn}>Edit</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Inventory Rules' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Operational Limits & Automation</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                Set system behavior for inventory and order capacity.
              </p>
              <div className={styles.rulesList}>
                <div className={styles.ruleItem}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Low Stock Alerts</h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Notify when detergent or supplies drop below 15%</p>
                  </div>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className={styles.ruleItem}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Max Daily Orders</h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Set upper limit for order intake to prevent backlog</p>
                  </div>
                  <input type="number" className={styles.inputField} style={{ width: '80px' }} defaultValue="200" />
                </div>
                <div className={styles.ruleItem}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Automatic Invoicing</h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Generate PDF immediately after order creation</p>
                  </div>
                  <input type="checkbox" defaultChecked />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Payment Gateways' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Connected Payment Systems</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '1.5rem' }}>
                Configure how you accept payments at the terminal and online.
              </p>
              <div className={styles.gatewaysGrid}>
                <div className={styles.gatewayCard}>
                  <div className={styles.gatewayHeader}>
                    <div style={{ fontWeight: 700 }}>Stripe Terminal</div>
                    <span className={styles.badge} style={{ background: '#F0FDF4', color: '#166534' }}>Connected</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Supports Visa, Mastercard, AMEX</p>
                </div>
                <div className={styles.gatewayCard}>
                  <div className={styles.gatewayHeader}>
                    <div style={{ fontWeight: 700 }}>Apple Pay / Google Pay</div>
                    <span className={styles.badge} style={{ background: '#F0FDF4', color: '#166534' }}>Active</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748B' }}>NFC-enabled mobile payments</p>
                </div>
                <div className={styles.gatewayCard}>
                  <div className={styles.gatewayHeader}>
                    <div style={{ fontWeight: 700 }}>WhatsApp Pay</div>
                    <span className={styles.badge} style={{ background: '#FFF7ED', color: '#9A3412' }}>Setup Required</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Direct billing via chat link</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className={styles.sideContent}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle} style={{ marginBottom: '1.25rem' }}>Quick Actions</h3>
            <div className={styles.btnRow}>
              <button className={styles.saveBtn}>Save Changes</button>
              <button className={styles.discardBtn}>Discard Changes</button>
            </div>
          </div>

          <div className={styles.tipBox}>
            <Info size={20} color="#2563EB" />
            <div className={styles.tipContent}>
              <h4>Settings Help</h4>
              <p>All configuration changes are applied in real-time across your desktop and cloud instances.</p>
            </div>
          </div>

          <div className={styles.statusBox}>
            <CheckCircle size={20} color="#10B981" />
            <div className={styles.statusText}>
              <h4>Cloud Sync Status</h4>
              <p>Everything is up to date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ name, type, price, time }) {
  return (
    <tr>
      <td style={{ fontWeight: 700, color: '#1E293B' }}>{name}</td>
      <td><span className={styles.badge}>{type}</span></td>
      <td style={{ fontWeight: 600 }}>{price}</td>
      <td style={{ color: '#64748B' }}>{time}</td>
      <td><span className={styles.editBtn}>Edit</span></td>
    </tr>
  );
}

function AddonItem({ name, sub, price, icon }) {
  return (
    <div className={styles.addonCard}>
      <div className={styles.addonInfo}>
        <div className={styles.addonIcon}>{icon}</div>
        <div>
          <span className={styles.addonName}>{name}</span>
          <span className={styles.addonSub}>{sub}</span>
        </div>
      </div>
      <span className={styles.addonPrice}>{price}</span>
    </div>
  );
}
