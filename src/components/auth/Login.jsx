/*
 * File: src/components/auth/Login.jsx
 * Description: Öğretmen giriş (authentication) formu; `useDatabase` üzerinden kullanıcı kaydetme/okuma yapar.
 */

import React, { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { UserPlus, LogIn, Eye, EyeOff, GraduationCap } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { saveTeacher, getTeacher } = useDatabase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // Kayıt işlemi
        if (!formData.fullName.trim() || !formData.password) {
          setError('Tum alanlari doldurun');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Şifreler eşleşmiyor');
          return;
        }
        if (formData.password.length < 4) {
          setError('Şifre en az 4 karakter olmalı');
          return;
        }

        const teacher = {
          id: 'current',
          fullName: formData.fullName.trim(),
          password: formData.password, // Not: Gerçek uygulamada hash'lenmeli!
          createdAt: new Date().toISOString()
        };

        await saveTeacher(teacher);
        onLogin(teacher);
      } else {
        // Giriş işlemi
        const savedTeacher = await getTeacher();
        if (!savedTeacher) {
          setError('Önce kayıt olmalısınız');
          return;
        }
        if (savedTeacher.password !== formData.password) {
          setError('Şifre yanlış');
          return;
        }
        onLogin(savedTeacher);
      }
    } catch (err) {
      setError('Bir hata olustu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-3xl shadow-lg mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MathUp</h1>
          <p className="text-gray-600">5-8. Sınıf Matematik Takip</p>
        </div>

        {/* Form Kartı */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-center mb-6">
            {isRegistering ? 'Hesap Oluştur' : 'Hoş Geldiniz'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="input-field"
                  placeholder="Orn: Ahmet Yilmaz"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="input-field pr-10"
                  placeholder="Şifrenizi girin"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre Tekrar
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="input-field"
                  placeholder="Şifrenizi tekrar girin"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : isRegistering ? (
                <>
                  <UserPlus size={20} />
                  Kayıt Ol
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Giriş Yap
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {isRegistering ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Offline çalışır - internet bağlantısı gerekmez
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
