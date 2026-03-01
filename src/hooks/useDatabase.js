/*
 * File: src/hooks/useDatabase.js
 * Description: IndexedDB üzerinden tüm CRUD işlemlerini yöneten özel React hook'u.
 */

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'MathUpDB';
const DB_VERSION = 2;

// Veritabanını başlat
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Öğrenciler store'u
      if (!db.objectStoreNames.contains('students')) {
        const studentStore = db.createObjectStore('students', { keyPath: 'id' });
        studentStore.createIndex('name', 'name', { unique: false });
        studentStore.createIndex('grade', 'grade', { unique: false });
      }
      
      // Kitaplar store'u
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      
      // Denemeler store'u
      if (!db.objectStoreNames.contains('exams')) {
        const examStore = db.createObjectStore('exams', { keyPath: 'id' });
        examStore.createIndex('studentId', 'studentId', { unique: false });
        examStore.createIndex('date', 'date', { unique: false });
      }
      
      // Hata analizi store'u
      if (!db.objectStoreNames.contains('errorAnalysis')) {
        db.createObjectStore('errorAnalysis', { keyPath: 'id' });
      }
      
      // Öğretmen bilgisi store'u
      if (!db.objectStoreNames.contains('teacher')) {
        db.createObjectStore('teacher', { keyPath: 'id' });
      }
    }
  });
};

export const useDatabase = () => {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initDB().then(database => {
      setDb(database);
      setIsReady(true);
    });
  }, []);

  // Öğrenci CRUD işlemleri
  const addStudent = useCallback(async (student) => {
    if (!db) return null;
    await db.put('students', student);
    return student;
  }, [db]);

  const getStudents = useCallback(async () => {
    if (!db) return [];
    return await db.getAll('students');
  }, [db]);

  const getStudentById = useCallback(async (id) => {
    if (!db) return null;
    return await db.get('students', id);
  }, [db]);

  const updateStudent = useCallback(async (student) => {
    if (!db) return null;
    await db.put('students', student);
    return student;
  }, [db]);

  const deleteStudent = useCallback(async (id) => {
    if (!db) return;
    await db.delete('students', id);
  }, [db]);

  // Kitap işlemleri
  const addBook = useCallback(async (book) => {
    if (!db) return null;
    await db.put('books', book);
    return book;
  }, [db]);

  const getBooks = useCallback(async () => {
    if (!db) return [];
    return await db.getAll('books');
  }, [db]);

  const updateBook = useCallback(async (book) => {
    if (!db) return null;
    await db.put('books', book);
    return book;
  }, [db]);

  const deleteBook = useCallback(async (id) => {
    if (!db) return;
    await db.delete('books', id);
  }, [db]);

  // Deneme işlemleri
  const addExam = useCallback(async (exam) => {
    if (!db) return null;
    await db.put('exams', exam);
    return exam;
  }, [db]);

  const getExams = useCallback(async (studentId = null) => {
    if (!db) return [];
    if (studentId) {
      return await db.getAllFromIndex('exams', 'studentId', studentId);
    }
    return await db.getAll('exams');
  }, [db]);

  // Öğretmen işlemleri
  const saveTeacher = useCallback(async (teacher) => {
    if (!db) return null;
    await db.put('teacher', { ...teacher, id: 'current' });
    return teacher;
  }, [db]);

  const getTeacher = useCallback(async () => {
    if (!db) return null;
    return await db.get('teacher', 'current');
  }, [db]);

  return {
    isReady,
    addStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    addBook,
    getBooks,
    updateBook,
    deleteBook,
    addExam,
    getExams,
    saveTeacher,
    getTeacher
  };
};
