import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDatabase } from './hooks/useDatabase';

// Sayfalar
/*
 * File: src/App.jsx
 * Description: Uygulama rotalarını, yönlendirmeyi ve kimlik doğrulama kontrolünü içerir.
 */

import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import CalendarPage from './components/calendar/CalendarPage';
import StudentList from './components/students/StudentList';
import StudentForm from './components/students/StudentForm';
import StudentDetail from './components/students/StudentDetail';
import ExamList from './components/exams/ExamList';
import ExamForm from './components/exams/ExamForm';
import ErrorAnalysis from './components/exams/ErrorAnalysis';
import Finance from './components/finance/Finance';
import Settings from './components/settings/Settings';
import BottomNav from './components/layout/BottomNav';

function App() {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isReady, getTeacher, seedInitialData } = useDatabase();
  const location = useLocation();

  useEffect(() => {
    if (isReady) {
      checkAuth();
    }
  }, [isReady]);

  const checkAuth = async () => {
    // Ensure initial data exists (teacher + students) and then read teacher
    try {
      await seedInitialData();
    } catch (e) {
      // ignore seeding errors
    }

    const savedTeacher = await getTeacher();
    if (savedTeacher) {
      setTeacher(savedTeacher);
    }
    setLoading(false);
  };

  const handleLogin = (teacherData) => {
    setTeacher(teacherData);
  };

  const handleLogout = () => {
    setTeacher(null);
  };

  if (loading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">MathUp yukleniyor...</p>
        </div>
      </div>
    );
  }

  // Login sayfasında navbar gösterme
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen bg-gray-50">
      {!teacher && !isLoginPage && <Navigate to="/login" replace />}
      {teacher && isLoginPage && <Navigate to="/" replace />}

      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/" element={teacher ? <Dashboard teacher={teacher} /> : <Navigate to="/login" />} />
        <Route path="/calendar" element={teacher ? <CalendarPage /> : <Navigate to="/login" />} />
        <Route path="/students" element={teacher ? <StudentList /> : <Navigate to="/login" />} />
        <Route path="/students/new" element={teacher ? <StudentForm /> : <Navigate to="/login" />} />
        <Route path="/students/:id" element={teacher ? <StudentDetail /> : <Navigate to="/login" />} />
        <Route path="/students/:id/edit" element={teacher ? <StudentForm /> : <Navigate to="/login" />} />
        <Route path="/books" element={teacher ? <Navigate to="/students" replace /> : <Navigate to="/login" />} />
        <Route path="/exams" element={teacher ? <ExamList /> : <Navigate to="/login" />} />
        <Route path="/exams/new" element={teacher ? <ExamForm /> : <Navigate to="/login" />} />
        <Route path="/exams/analysis/:studentId?" element={teacher ? <ErrorAnalysis /> : <Navigate to="/login" />} />
        <Route path="/finance" element={teacher ? <Finance /> : <Navigate to="/login" />} />
        <Route path="/settings" element={teacher ? <Settings /> : <Navigate to="/login" />} />
      </Routes>

      {teacher && !isLoginPage && <BottomNav onLogout={handleLogout} />}
    </div>
  );
}

export default App;
