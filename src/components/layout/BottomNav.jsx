/*
 * File: src/components/layout/BottomNav.jsx
 * Description: Mobil alt gezinme çubuğu; uygulama içi hızlı bağlantılar ve çıkış butonu içerir.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, TrendingUp, MoreHorizontal, LogOut, CalendarDays } from 'lucide-react';

const BottomNav = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Ana Sayfa' },
    { path: '/calendar', icon: CalendarDays, label: 'Takvim' },
    { path: '/students', icon: Users, label: 'Öğrenciler' },
    { path: '/finance', icon: TrendingUp, label: 'Finans' },
  ];

  const menuItems = [
    { path: '/exams/analysis', label: 'Hata Analizi' },
    { path: '/settings', label: 'Ayarlar & Yedekleme' },
  ];

  const handleMenuItemClick = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    onLogout();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={'flex flex-col items-center py-3 px-4 min-w-[64px] ' + (isActive(item.path) ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600')}
          >
            <item.icon className={'w-6 h-6 ' + (isActive(item.path) ? 'fill-current' : '')} />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col items-center py-3 px-4 text-gray-400 hover:text-gray-600"
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Diger</span>
          </button>
          
          {isMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-100">
              {menuItems.map((item) => (
                <button 
                  key={item.path}
                  onClick={() => handleMenuItemClick(item.path)} 
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-2xl"
                >
                  {item.label}
                </button>
              ))}
              <hr className="border-gray-100" />
              <button 
                onClick={handleLogoutClick} 
                className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 last:rounded-b-2xl flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Cikis Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;