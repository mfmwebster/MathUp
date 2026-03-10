/*
 * File: src/hooks/useDatabase.js
 * Description: IndexedDB üzerinden tüm CRUD işlemlerini yöneten özel React hook'u.
 */

import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { generateId, generateLessonSchedule, getScheduleWeeks } from '../utils/helpers';

export const DB_NAME = 'MathUpDB';
export const DB_VERSION = 3;

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

      // Ders etkinlikleri store'u (takvim için tek kaynak)
      if (!db.objectStoreNames.contains('lessonEvents')) {
        const lessonStore = db.createObjectStore('lessonEvents', { keyPath: 'id' });
        lessonStore.createIndex('studentId', 'studentId', { unique: false });
        lessonStore.createIndex('date', 'date', { unique: false });
        lessonStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
      }
    }
  });
};

export const useDatabase = () => {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const syncLessonEventsFromStudents = useCallback(async (database) => {
    if (!database || !database.objectStoreNames.contains('lessonEvents')) return;

    const students = await database.getAll('students');
    const existingEvents = await database.getAll('lessonEvents');

    const activeScheduleEventIds = new Set();
    const tx = database.transaction(['lessonEvents'], 'readwrite');
    const lessonStore = tx.objectStore('lessonEvents');

    for (const student of students) {
      const lessons = Array.isArray(student?.schedule) ? student.schedule : [];

      for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
        const lesson = lessons[lessonIndex];
        const weekNumber = lesson?.week || lessonIndex + 1;
        const eventId = `schedule:${student.id}:${weekNumber}`;
        activeScheduleEventIds.add(eventId);

        await lessonStore.put({
          id: eventId,
          sourceType: 'schedule',
          studentId: student.id,
          studentName: student.fullName,
          week: weekNumber,
          date: lesson?.date || null,
          time: lesson?.time || null,
          duration: lesson?.duration || parseInt(student?.lessonDuration || '60', 10),
          completed: !!lesson?.completed,
          topic: lesson?.topic || null,
          objectives: lesson?.objectives || [],
          paymentAmount: parseFloat(lesson?.paymentAmount) || 0,
          paymentStatus: lesson?.paymentStatus || 'pending',
          paymentCollectedAt: lesson?.paymentCollectedAt || null,
          paymentDueDate: lesson?.paymentDueDate || lesson?.date || null,
          calendarHidden: !!lesson?.calendarHidden,
          createdAt: student?.createdAt || new Date().toISOString(),
          updatedAt: student?.updatedAt || new Date().toISOString()
        });
      }
    }

    for (const event of existingEvents) {
      if (event?.sourceType === 'schedule' && !activeScheduleEventIds.has(event.id)) {
        await lessonStore.delete(event.id);
      }
    }

    await tx.done;
  }, []);

  const normalizeStudentsPaymentData = useCallback(async (database) => {
    if (!database) return;

    const students = await database.getAll('students');

    for (const student of students) {
      let studentHasChanges = false;
      const currentFee = parseFloat(student?.fee);
      const existingInitialFee = parseFloat(student?.initialFee);
      const baseInitialFee = (!Number.isNaN(existingInitialFee) && existingInitialFee > 0)
        ? existingInitialFee
        : ((!Number.isNaN(currentFee) && currentFee > 0) ? currentFee : 0);
      const originalSchedule = Array.isArray(student?.schedule) ? student.schedule : [];

      const normalizedSchedule = originalSchedule.map((lesson) => {
        const lessonAmount = parseFloat(lesson?.paymentAmount);
        const normalizedAmount = (!Number.isNaN(lessonAmount) && lessonAmount > 0)
          ? lessonAmount
          : baseInitialFee;

        const normalizedLesson = {
          ...lesson,
          paymentAmount: normalizedAmount,
          paymentStatus: lesson?.paymentStatus || 'pending',
          paymentCollectedAt: lesson?.paymentCollectedAt || null
        };

        if (
          lesson?.paymentAmount !== normalizedLesson.paymentAmount ||
          lesson?.paymentStatus !== normalizedLesson.paymentStatus ||
          lesson?.paymentCollectedAt !== normalizedLesson.paymentCollectedAt
        ) {
          studentHasChanges = true;
        }

        return normalizedLesson;
      });

      if (student?.initialFee !== baseInitialFee) {
        studentHasChanges = true;
      }

      if (studentHasChanges) {
        await database.put('students', {
          ...student,
          initialFee: baseInitialFee,
          schedule: normalizedSchedule,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }, []);

  useEffect(() => {
    initDB().then(async (database) => {
      await normalizeStudentsPaymentData(database);
      await syncLessonEventsFromStudents(database);
      setDb(database);
      setIsReady(true);
    });
  }, [normalizeStudentsPaymentData, syncLessonEventsFromStudents]);

  // Öğrenci CRUD işlemleri
  const addStudent = useCallback(async (student) => {
    if (!db) return null;
    await db.put('students', student);
    await syncLessonEventsFromStudents(db);
    return student;
  }, [db, syncLessonEventsFromStudents]);

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
    await syncLessonEventsFromStudents(db);
    return student;
  }, [db, syncLessonEventsFromStudents]);

  const deleteStudent = useCallback(async (id) => {
    if (!db) return;
    await db.delete('students', id);
    await syncLessonEventsFromStudents(db);
  }, [db, syncLessonEventsFromStudents]);

  // Ders etkinlikleri (takvim) işlemleri
  const addLessonEvent = useCallback(async (lessonEvent) => {
    if (!db) return null;

    const event = {
      ...lessonEvent,
      id: lessonEvent.id || `manual:${generateId()}`,
      sourceType: lessonEvent.sourceType || 'manual',
      createdAt: lessonEvent.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.put('lessonEvents', event);
    return event;
  }, [db]);

  const getLessonEvents = useCallback(async (studentId = null) => {
    if (!db || !db.objectStoreNames.contains('lessonEvents')) return [];

    if (studentId) {
      return await db.getAllFromIndex('lessonEvents', 'studentId', studentId);
    }

    return await db.getAll('lessonEvents');
  }, [db]);

  const updateLessonEvent = useCallback(async (lessonEvent) => {
    if (!db || !lessonEvent?.id) return null;

    const updated = {
      ...lessonEvent,
      updatedAt: new Date().toISOString()
    };

    await db.put('lessonEvents', updated);
    return updated;
  }, [db]);

  const deleteLessonEvent = useCallback(async (id) => {
    if (!db || !id) return;
    await db.delete('lessonEvents', id);
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

  const updateExam = useCallback(async (exam) => {
    if (!db) return null;
    await db.put('exams', exam);
    return exam;
  }, [db]);

  const deleteExam = useCallback(async (id) => {
    if (!db) return;
    await db.delete('exams', id);
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

  // Seed initial teacher + students if none exist
  const seedInitialData = useCallback(async () => {
    if (!db) return null;

    // ensure teacher exists
    let teacher = await db.get('teacher', 'current');
    if (!teacher) {
      teacher = {
        id: 'current',
        fullName: 'Fatih Marlalı',
        password: '123456',
        createdAt: new Date().toISOString()
      };
      await db.put('teacher', teacher);
    }

    const studentsRaw = [
      {
        fullName: 'Ahmet Berk Aksoy',
        lessonDay: '5',
        lessonTime: '17:10',
        grade: '8',
        school: 'Vali Necati Çetinkaya Ortaokulu',
        notes: 'DYK-var, Dershane-Yok,Genel Durumu-iyi, matematik durumu-iyi LGS'
      },
      {
        fullName: 'Seyit Ahmet Güler',
        lessonDay: '6',
        lessonTime: '16:30',
        grade: '8',
        school: 'Temaşehir Ortaokulu',
        notes: 'DYK-Var, Dershane-Var, Genel Durumu-orta, matematik durumu- orta, LGS'
      },
      {
        fullName: 'Mert Erdoğdu',
        lessonDay: '0',
        lessonTime: '14:30',
        grade: '6',
        school: 'Mehmet Beğen Ortaokulu',
        notes: 'DYK-Yok, Dershane-Yok, Genel Durumu- iyi, matematik durumu-iyi'
      },
      {
        fullName: 'Muhammet Taha Uçar',
        lessonDay: '6',
        lessonTime: '16:30',
        grade: '8',
        school: '23 Nisan Ortaokulu',
        notes: 'DYK-Var, Dershane-Var, Genel Durumu-Pekiyi, matematik durumu-pekiyi  LGS'
      },
      {
        fullName: 'Mustafa Özbağcı',
        lessonDay: '4',
        lessonTime: '17:20',
        grade: '7',
        school: 'Yaşar Doğu Ortaokulu',
        notes: 'DYK yok Dershanae yok, Bursluluk'
      }
    ];

    const existingStudents = await db.getAll('students');
    const normalizedSeedNames = new Set(
      studentsRaw.map((item) => String(item.fullName || '').trim().toLowerCase())
    );
    const normalizedExistingNames = new Set(
      existingStudents.map((item) => String(item?.fullName || '').trim().toLowerCase())
    );

    if (existingStudents.length > 0) {
      const onlyDefaultSubsetLeft = existingStudents.every((item) => {
        const normalizedName = String(item?.fullName || '').trim().toLowerCase();
        return normalizedSeedNames.has(normalizedName);
      });

      if (!onlyDefaultSubsetLeft) {
        return teacher;
      }

      if (existingStudents.length >= studentsRaw.length) {
        return teacher;
      }
    }

    for (const s of studentsRaw) {
      const normalizedName = String(s.fullName || '').trim().toLowerCase();
      if (normalizedExistingNames.has(normalizedName)) {
        continue;
      }

      const weeks = getScheduleWeeks(s.grade);
      const student = {
        id: generateId(),
        fullName: s.fullName,
        school: s.school,
        grade: s.grade,
        phone: '',
        parentPhone: '',
        lessonDay: s.lessonDay,
        lessonTime: s.lessonTime,
        lessonDuration: '60',
        fee: '',
        initialFee: 0,
        photo: null,
        notes: s.notes,
        schedule: generateLessonSchedule(new Date(), s.lessonDay, s.lessonTime, 60, weeks, 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.put('students', student);
    }

    return teacher;
  }, [db]);

  return {
    isReady,
    addStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    addLessonEvent,
    getLessonEvents,
    updateLessonEvent,
    deleteLessonEvent,
    addBook,
    getBooks,
    updateBook,
    deleteBook,
    addExam,
    getExams,
    updateExam,
    deleteExam,
    saveTeacher,
    getTeacher,
    seedInitialData
  };
};
