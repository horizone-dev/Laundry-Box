import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, UserPlus, Shield, Key, Search, MoreVertical, 
  Mail, Phone, ShieldCheck, UserCheck, Trash2, Edit2, Lock, X, CheckCircle, Settings
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DEFAULT_SHOP_ID, API_BASE_URL } from '../constants';
import { useSettings } from '../store/SettingsContext';
import styles from './Users.module.css';

const Users = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { formatDate } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const queryTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(queryTab === 'roles' ? 'roles' : 'users');
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'super_admin';
  const isManager = user.role === 'manager';
  const isAuthorized = isSuperAdmin || isManager;

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
    }
  }, [isAuthorized, navigate]);

  if (!isAuthorized) return null;
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'cashier',
    password: '',
    pin: ''
  });

  const AUTH_API = `${API_BASE_URL}/auth`;
  const ROLE_API = `${API_BASE_URL}/roles`;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'roles') setActiveTab('roles');
    else setActiveTab('users');
  }, [location.search]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setShowPermissionModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const isAnyOpen = showModal || showPermissionModal;
    if (isAnyOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showPermissionModal]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        axios.get(`${AUTH_API}/users`),
        axios.get(ROLE_API)
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`${AUTH_API}/users/${id}`);
        setUsers(users.filter(u => u._id !== id));
      } catch (err) {
        alert("Failed to delete user");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.phone) delete payload.phone;
      
      if (editingUser) {
        await axios.put(`${AUTH_API}/users/${editingUser._id}`, payload);
        if (editingUser.email === user.email || editingUser.userId === user.userId || editingUser._id === user._id) {
          const updatedUser = { ...user, ...payload };
          delete updatedUser.password;
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          window.dispatchEvent(new Event('user-profile-updated'));
        }
      } else {
        await axios.post(`${AUTH_API}/register`, {
          ...payload,
          shopId: user.shopId || DEFAULT_SHOP_ID,
          userId: `USER_${Date.now()}`
        });
      }
      setShowModal(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'cashier', password: '', pin: '' });
      fetchData();
    } catch (err) {
      alert("Failed to save user: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdatePermissions = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${ROLE_API}/${editingRole._id}/permissions`, {
        permissions: editingRole.permissions
      });
      setShowPermissionModal(false);
      setEditingRole(null);
      fetchData();
    } catch (err) {
      alert("Failed to update permissions");
    }
  };

  const togglePermission = (key) => {
    setEditingRole({
      ...editingRole,
      permissions: {
        ...editingRole.permissions,
        [key]: !editingRole.permissions[key]
      }
    });
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      pin: ''
    });
    setShowModal(true);
  };

  const openPermissions = (role) => {
    setEditingRole(role);
    setShowPermissionModal(true);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.phone && u.phone.includes(searchTerm));
    
    // Hide super_admin users from Managers/Cashiers
    if (!isSuperAdmin && u.role === 'super_admin') return false;
    
    return matchesSearch;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
        </div>
        <button className={styles.addUserBtn} onClick={() => { setEditingUser(null); setFormData({ name: '', phone: '', role: 'cashier', password: '', pin: '' }); setShowModal(true); }}>
          <UserPlus size={18} />
          <span>Add New User</span>
        </button>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <UsersIcon size={18} />
          <span>Users</span>
        </button>
        {isAuthorized && (
          <button 
            className={`${styles.tab} ${activeTab === 'roles' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <Shield size={18} />
            <span>Roles & Permissions</span>
          </button>
        )}
      </div>

      <div className={styles.content}>
        {activeTab === 'users' ? (
          <>
            <div className={styles.filters}>
              <div className={styles.searchBox}>
                <Search size={18} className={styles.searchIcon} />
                <input 
                  type="text" 
                  placeholder="Search users by name or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading users...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No users found</td></tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user._id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.avatar}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className={styles.userName}>{user.name}</div>
                            <div className={styles.userEmail}>{user.phone || 'No Phone'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.roleBadge} ${styles[user.role.toLowerCase().replace(' ', '')]}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles.active}`}>
                          Active
                        </span>
                      </td>
                      <td className={styles.lastActive}>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className={styles.userControl}>
                          {(isSuperAdmin || (isManager && user.role !== 'super_admin')) && (
                            <div className={styles.controlDropdown}>
                              <button className={styles.actionBtn} onClick={() => openEdit(user)} title="Settings">
                                <Settings size={16} />
                              </button>
                              <button 
                                className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                                title="Remove User" 
                                onClick={() => handleDelete(user._id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={styles.rolesGrid}>
            {roles.filter(r => {
              if (isSuperAdmin) return r.slug !== 'super_admin'; // Super Admin can see Manager and Cashier
              if (isManager) return r.slug === 'cashier'; // Manager can ONLY see Cashier
              return false;
            }).map(role => (
              <div key={role._id} className={styles.roleCard}>
                <div className={styles.roleHeader}>
                  <div className={styles.roleIcon}>
                    <ShieldCheck size={24} />
                  </div>
                  <MoreVertical size={18} className={styles.moreIcon} />
                </div>
                <h3 className={styles.roleName}>{role.name}</h3>
                  <div className={styles.rolePermissionsTags}>
                    {role.permissions && Object.entries(role.permissions)
                      .filter(([_, v]) => v)
                      .map(([k, _]) => (
                        <span key={k} className={styles.permTag}>
                          {k.charAt(0).toUpperCase() + k.slice(1)}
                        </span>
                      ))}
                  </div>
                  <div className={styles.roleFooter}>
                    <span className={styles.userCount}>
                      <UserCheck size={14} />
                      {users.filter(u => u.role === role.slug).length} Users
                    </span>
                    <button className={styles.editRoleBtn} onClick={() => openPermissions(role)}>
                      Configure
                    </button>
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPermissionModal && editingRole && (
        <div className={styles.modalOverlay} onClick={() => setShowPermissionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit Permissions: {editingRole.name}</h2>
              <button className={styles.closeBtn} onClick={() => setShowPermissionModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdatePermissions}>
              <div className={styles.permissionsGrid}>
                {Object.keys(editingRole.permissions).map(key => (
                  <div key={key} className={styles.permissionItem} onClick={() => togglePermission(key)}>
                    <div className={`${styles.checkbox} ${editingRole.permissions[key] ? styles.checked : ''}`}>
                      {editingRole.permissions[key] && <CheckCircle size={14} />}
                    </div>
                    <span>{key.charAt(0).toUpperCase() + key.slice(1)} Access</span>
                  </div>
                ))}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowPermissionModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Save Permissions</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="e.g. +971 50 123 4567"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Role</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>{editingUser ? 'New Password (Optional)' : 'Password'}</label>
                  <input 
                    type="password" 
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>{editingUser ? 'New PIN (Optional)' : 'PIN (Required)'}</label>
                  <input 
                    type="password" 
                    required={!editingUser}
                    value={formData.pin}
                    onChange={(e) => setFormData({...formData, pin: e.target.value})}
                    placeholder="Secret PIN"
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
