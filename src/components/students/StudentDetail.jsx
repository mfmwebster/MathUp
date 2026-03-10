import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ErrorAnalysis from '../exams/ErrorAnalysis';
import { 
  ArrowLeft, Calendar, CheckCircle, Circle, 
  BookOpen, TrendingUp, Edit, Trash2, Target,
  Trash2 as TrashIcon, Plus, X, DollarSign
} from 'lucide-react';
import { formatShortDate, getDayName } from '../../utils/helpers';
import { useFeedback } from '../../context/FeedbackContext';

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const toDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createDateFromLesson = (lesson) => {
  const time = lesson?.time || '00:00';
  return new Date(`${lesson?.date}T${time}`);
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getMondayIndexFromDate = (dateValue) => {
  const d = new Date(dateValue);
  return (d.getDay() + 6) % 7;
};

const getTimeRangeLabel = (startTime, duration) => {
  const source = String(startTime || '00:00');
  const [hourRaw, minuteRaw] = source.split(':');
  const hour = parseInt(hourRaw, 10);
  const minute = parseInt(minuteRaw, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return `${source} - ${source}`;
  }

  const startMinutes = (hour * 60) + minute;
  const totalDuration = Math.max(15, parseInt(duration || 60, 10));
  const endMinutes = startMinutes + totalDuration;

  const formatMinutes = (mins) => {
    const normalized = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return `${formatMinutes(startMinutes)} - ${formatMinutes(endMinutes)}`;
};

const parseTimeToMinutes = (timeValue) => {
  const value = String(timeValue || '').trim();
  const [hourRaw, minuteRaw = '0'] = value.split(':');
  const hour = parseInt(hourRaw, 10);
  const minute = parseInt(minuteRaw, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const hasTimeRangeOverlap = (firstLesson, secondLesson) => {
  if (!firstLesson?.date || !secondLesson?.date || firstLesson.date !== secondLesson.date) return false;

  const firstStart = parseTimeToMinutes(firstLesson.time);
  const secondStart = parseTimeToMinutes(secondLesson.time);
  if (firstStart === null || secondStart === null) return false;

  const firstDuration = Math.max(15, parseInt(firstLesson.duration || 60, 10) || 60);
  const secondDuration = Math.max(15, parseInt(secondLesson.duration || 60, 10) || 60);
  const firstEnd = firstStart + firstDuration;
  const secondEnd = secondStart + secondDuration;

  return firstStart < secondEnd && secondStart < firstEnd;
};

const hasPageRangeOverlap = (firstFrom, firstTo, secondFrom, secondTo) => {
  return firstFrom <= secondTo && secondFrom <= firstTo;
};

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getStudentById, getStudents, updateStudent, deleteStudent, isReady, getExams, deleteExam, getBooks, addBook, updateBook, deleteBook } = useDatabase();
  const { notify, confirmAction, promptValue } = useFeedback();
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [curriculum, setCurriculum] = useState([]);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [exams, setExams] = useState([]);
  const [books, setBooks] = useState([]);
  const [showNewBookModal, setShowNewBookModal] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', totalPages: '', curriculum: '5', trackingMode: 'page' });
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [selectedBookForHomework, setSelectedBookForHomework] = useState(null);
  const [homeworkForm, setHomeworkForm] = useState({ fromPage: '', toPage: '', dueDate: '' });
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [selectedBookForOutcome, setSelectedBookForOutcome] = useState(null);
  const [showBookDetailModal, setShowBookDetailModal] = useState(false);
  const [selectedBookDetailId, setSelectedBookDetailId] = useState(null);
  const [bulkPricing, setBulkPricing] = useState({ startDate: '', amount: '' });
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLessonIndex, setEditingLessonIndex] = useState(null);
  const [editingScope, setEditingScope] = useState('single');
  const [lessonForm, setLessonForm] = useState({
    date: toDateKey(new Date()),
    time: '16:00',
    duration: '60',
    amount: '',
    paymentStatus: 'pending',
    topic: '',
    description: '',
    addMode: 'single',
    repeatEveryWeeks: '1',
    recurrenceDays: [],
    untilDate: '',
    count: '4'
  });
  const handledLessonQueryRef = useRef('');
  const selectedBookDetail = books.find((book) => book.id === selectedBookDetailId) || null;

  useEffect(() => {
    if (isReady) {
      loadStudent();
    }
  }, [id, isReady]);

  useEffect(() => {
    const queryTab = new URLSearchParams(location.search).get('tab');
    const validTabs = ['schedule', 'curriculum', 'books', 'exams', 'analysis', 'finance'];
    if (queryTab && validTabs.includes(queryTab)) {
      setActiveTab(queryTab);
    }
  }, [location.search]);

  useEffect(() => {
    if (!student) return;

    const params = new URLSearchParams(location.search);
    const queryTab = params.get('tab');
    const lessonDate = params.get('lessonDate');
    const lessonTime = params.get('lessonTime');

    if (queryTab !== 'schedule' || !lessonDate) {
      return;
    }

    const queryKey = `${student.id}:${lessonDate}:${lessonTime || ''}`;
    if (handledLessonQueryRef.current === queryKey) {
      return;
    }

    const lessonIndex = (student.schedule || []).findIndex((lesson) => {
      const sameDate = String(lesson?.date || '') === lessonDate;
      if (!sameDate) return false;
      if (!lessonTime) return true;
      return String(lesson?.time || '') === lessonTime;
    });

    if (lessonIndex >= 0) {
      handledLessonQueryRef.current = queryKey;
      setActiveTab('schedule');
      openEditLessonForm(lessonIndex);
    }
  }, [student, location.search]);

  useEffect(() => {
    if (student) {
      loadCurriculum();
      loadExams();
      loadBooks();

      const firstPendingLesson = (student.schedule || []).find((lesson) => lesson.paymentStatus !== 'collected');
      const suggestedAmount = parseFloat(student.fee) || parseFloat(student.initialFee) || 0;

      setBulkPricing((prev) => ({
        startDate: prev.startDate || firstPendingLesson?.date || new Date().toISOString().split('T')[0],
        amount: prev.amount || (suggestedAmount > 0 ? String(suggestedAmount) : '')
      }));
    }
  }, [student]);

  // Modal açıldığında müfredat otomatik set et
  useEffect(() => {
    if (showNewBookModal && student) {
      setNewBook({ title: '', totalPages: '', curriculum: student.grade, trackingMode: 'page' });
    }
  }, [showNewBookModal, student]);

  const normalizeSchedulePayments = (studentData) => {
    const configuredInitialFee = parseFloat(studentData?.initialFee);
    const currentFee = parseFloat(studentData?.fee);
    const baseFee = (!Number.isNaN(configuredInitialFee) && configuredInitialFee > 0)
      ? configuredInitialFee
      : ((!Number.isNaN(currentFee) && currentFee > 0) ? currentFee : 0);
    const schedule = (studentData?.schedule || []).map((lesson) => ({
      ...lesson,
      paymentAmount: (() => {
        const lessonAmount = parseFloat(lesson.paymentAmount);
        if (!Number.isNaN(lessonAmount) && lessonAmount > 0) {
          return lessonAmount;
        }
        return baseFee;
      })(),
      paymentStatus: lesson.paymentStatus || 'pending',
      paymentCollectedAt: lesson.paymentCollectedAt || null,
      paymentDueDate: lesson.paymentDueDate || lesson.date || null,
      calendarHidden: !!lesson.calendarHidden
    }));

    return {
      ...studentData,
      initialFee: baseFee,
      schedule
    };
  };

  const normalizeScheduleOrder = (schedule) => {
    const ordered = [...(schedule || [])].sort((a, b) => {
      const aKey = `${a?.date || ''} ${a?.time || ''}`;
      const bKey = `${b?.date || ''} ${b?.time || ''}`;
      return aKey.localeCompare(bKey);
    });

    return ordered.map((lesson, index) => ({
      ...lesson,
      week: index + 1
    }));
  };

  const loadStudent = async () => {
    const data = await getStudentById(id);
    if (data) {
      const normalized = normalizeSchedulePayments(data);
      setStudent(normalized);

      const hadMissingPaymentFields = (data.schedule || []).some(
        (lesson) => lesson.paymentStatus === undefined || lesson.paymentAmount === undefined
      );

      if (hadMissingPaymentFields) {
        await updateStudent({
          ...normalized,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      navigate('/students');
    }
  };

  const loadCurriculum = async () => {
    try {
      const module = await import(`../../data/curriculum${student.grade}.json`);
      setCurriculum(module.default);
    } catch (error) {
      console.error('Curriculum loading error:', error);
      setCurriculum([]);
    }
  };

  const loadExams = async () => {
    try {
      const examsData = await getExams(id);
      // Tarihe göre sırala (yeni üstte)
      setExams(examsData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      console.error('Exams loading error:', error);
      setExams([]);
    }
  };

  const loadBooks = async () => {
    try {
      const booksData = await getBooks();
      const studentBooks = booksData.filter(b => b.studentId === id);
      setBooks(studentBooks);
    } catch (error) {
      console.error('Books loading error:', error);
      setBooks([]);
    }
  };

  const handleCreateBook = async () => {
    if (!newBook.title || !newBook.totalPages) {
      notify('Kitap adı ve sayfa sayısını doldurunuz', 'warning');
      return;
    }

    try {
      const curriculumData = await import(`../../data/curriculum${newBook.curriculum}.json`);
      const outcomes = curriculumData.default.flatMap(c => c.learningOutcomes || []);

      const book = {
        id: Date.now().toString(),
        studentId: id,
        title: newBook.title,
        totalPages: parseInt(newBook.totalPages),
        currentPage: 0,
        curriculum: newBook.curriculum,
        trackingMode: newBook.trackingMode || 'page',
        learningOutcomes: outcomes,
        selectedOutcomes: [],
        homeworkLogs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addBook(book);
      setBooks([...books, book]);
      setNewBook({ title: '', totalPages: '', curriculum: '5', trackingMode: 'page' });
      setShowNewBookModal(false);
    } catch (error) {
      notify('Kitap oluşturulamadı: ' + error.message, 'error');
    }
  };

  const handleUpdateBook = async (bookId, newPage) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      const safePage = Math.max(0, Math.min(newPage, book.totalPages || 0));
      const updated = { ...book, currentPage: safePage, updatedAt: new Date().toISOString() };
      await updateBook(updated);
      setBooks(books.map(b => b.id === bookId ? updated : b));
    }
  };

  const handleDeleteBook = async (bookId) => {
    const shouldDelete = await confirmAction({
      title: 'Kitabı Sil',
      message: 'Bu kitabı silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      danger: true
    });

    if (shouldDelete) {
      await deleteBook(bookId);
      setBooks(books.filter(b => b.id !== bookId));
    }
  };

  const openBookDetailModal = (bookId) => {
    setSelectedBookDetailId(bookId);
    setShowBookDetailModal(true);
  };

  const closeBookDetailModal = () => {
    setShowBookDetailModal(false);
    setSelectedBookDetailId(null);
  };

  const handleDeleteBookFromDetail = async () => {
    if (!selectedBookDetail) return;
    const shouldDelete = await confirmAction({
      title: 'Kitabı Sil',
      message: 'Bu kitabı silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      danger: true
    });
    if (!shouldDelete) return;

    await deleteBook(selectedBookDetail.id);
    setBooks((prevBooks) => prevBooks.filter((book) => book.id !== selectedBookDetail.id));
    closeBookDetailModal();
  };

  const openOutcomeModal = (book) => {
    setSelectedBookForOutcome(book);
    setShowOutcomeModal(true);
  };

  const closeOutcomeModal = () => {
    setSelectedBookForOutcome(null);
    setShowOutcomeModal(false);
  };

  const toggleBookOutcome = async (bookId, outcome) => {
    const targetBook = books.find((b) => b.id === bookId);
    if (!targetBook) return;

    const selectedOutcomes = targetBook.selectedOutcomes || [];
    const exists = selectedOutcomes.includes(outcome);
    const nextSelectedOutcomes = exists
      ? selectedOutcomes.filter((item) => item !== outcome)
      : [...selectedOutcomes, outcome];

    const updatedBook = {
      ...targetBook,
      selectedOutcomes: nextSelectedOutcomes,
      updatedAt: new Date().toISOString()
    };

    await updateBook(updatedBook);
    setBooks(books.map((book) => (book.id === updatedBook.id ? updatedBook : book)));
    setSelectedBookForOutcome(updatedBook);
  };

  const openHomeworkModal = (book) => {
    const defaultFromPage = Math.max((book.currentPage || 0) + 1, 1);
    const defaultToPage = Math.min(defaultFromPage + 9, book.totalPages || defaultFromPage);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    setSelectedBookForHomework(book);
    setHomeworkForm({
      fromPage: String(defaultFromPage),
      toPage: String(defaultToPage),
      dueDate: nextWeek.toISOString().split('T')[0]
    });
    setShowHomeworkModal(true);
  };

  const closeHomeworkModal = () => {
    setShowHomeworkModal(false);
    setSelectedBookForHomework(null);
    setHomeworkForm({ fromPage: '', toPage: '', dueDate: '' });
  };

  const handleCreateHomework = async () => {
    if (!selectedBookForHomework) return;

    const liveBook = books.find((book) => book.id === selectedBookForHomework.id) || selectedBookForHomework;

    const fromPage = parseInt(homeworkForm.fromPage) || 0;
    const toPage = parseInt(homeworkForm.toPage) || 0;

    if (!fromPage || !toPage || !homeworkForm.dueDate) {
      notify('Lütfen tüm ödev alanlarını doldurun.', 'warning');
      return;
    }

    if (fromPage > toPage) {
      notify('Başlangıç sayfası, bitiş sayfasından büyük olamaz.', 'warning');
      return;
    }

    if (fromPage < 1 || toPage > liveBook.totalPages) {
      notify(`Sayfa aralığı 1 - ${liveBook.totalPages} arasında olmalıdır.`, 'warning');
      return;
    }

    const homeworkLogs = liveBook.homeworkLogs || [];
    const completedPageLimit = Math.max(
      liveBook.currentPage || 0,
      ...homeworkLogs.map((log) => {
        if (log.status === 'done') return log.toPage;
        if (log.status === 'partial') return log.completedPage || 0;
        return 0;
      })
    );

    if (fromPage <= completedPageLimit) {
      notify(`Bu öğrenci ${completedPageLimit}. sayfaya kadar ilerlemiş görünüyor. Yeni ödev başlangıcı ${completedPageLimit + 1} ve sonrası olmalıdır.`, 'warning');
      return;
    }

    const overlappingActiveHomework = homeworkLogs.find((log) => {
      const isActive = log.status === 'pending' || log.status === 'partial';
      if (!isActive) return false;
      return hasPageRangeOverlap(fromPage, toPage, log.fromPage, log.toPage);
    });

    if (overlappingActiveHomework) {
      notify(`Bu aralık, mevcut aktif ödev (${overlappingActiveHomework.fromPage}-${overlappingActiveHomework.toPage}) ile çakışıyor.`, 'warning');
      return;
    }

    const homeworkItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      fromPage,
      toPage,
      dueDate: homeworkForm.dueDate,
      assignedAt: new Date().toISOString(),
      status: 'pending',
      completedPage: null,
      checkedAt: null
    };

    const updatedBook = {
      ...liveBook,
      homeworkLogs: [...homeworkLogs, homeworkItem],
      updatedAt: new Date().toISOString()
    };

    await updateBook(updatedBook);
    setBooks(books.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    closeHomeworkModal();
  };

  const handleUpdateHomeworkStatus = async (bookId, homeworkId, status) => {
    const targetBook = books.find((b) => b.id === bookId);
    if (!targetBook) return;

    let nextCurrentPage = targetBook.currentPage || 0;
    let partialCompletedCountInput = null;

    const targetHomework = (targetBook.homeworkLogs || []).find((homework) => homework.id === homeworkId);

    if (status === 'partial' && targetHomework) {
      const assignedCount = Math.max(1, (targetHomework.toPage - targetHomework.fromPage + 1));
      const userInput = await promptValue({
        title: 'Kısmi Ödev Kontrolü',
        message: `Toplam ${assignedCount} sayfadan kaç sayfa yapıldı?`,
        defaultValue: String(assignedCount),
        placeholder: 'Yapılan sayfa sayısı',
        confirmText: 'Kaydet',
        cancelText: 'İptal'
      });

      if (userInput === null) {
        return;
      }

      partialCompletedCountInput = Math.max(0, Math.min(parseInt(userInput, 10) || 0, assignedCount));
    }

    const updatedLogs = (targetBook.homeworkLogs || []).map((homework) => {
      if (homework.id !== homeworkId) return homework;

      const assignedCount = Math.max(1, (homework.toPage - homework.fromPage + 1));
      const previousCompletedCount = Math.max(
        0,
        homework.completedCount
          || (homework.status === 'done'
            ? assignedCount
            : homework.status === 'partial' && homework.completedPage
              ? Math.max(0, homework.completedPage - homework.fromPage + 1)
              : 0)
      );

      if (status === 'partial') {
        const completedCount = partialCompletedCountInput ?? 0;
        const completedPage = completedCount > 0
          ? Math.min(homework.fromPage + completedCount - 1, homework.toPage)
          : null;
        const delta = completedCount - previousCompletedCount;
        nextCurrentPage = Math.min(targetBook.totalPages, Math.max(0, nextCurrentPage + delta));

        return {
          ...homework,
          status: 'partial',
          completedPage,
          completedCount,
          checkedAt: new Date().toISOString()
        };
      }

      if (status === 'done') {
        const completedCount = assignedCount;
        const delta = completedCount - previousCompletedCount;
        nextCurrentPage = Math.min(targetBook.totalPages, Math.max(0, nextCurrentPage + delta));
        return {
          ...homework,
          status: 'done',
          completedPage: homework.toPage,
          completedCount,
          checkedAt: new Date().toISOString()
        };
      }

      if (status === 'missed') {
        const delta = -previousCompletedCount;
        nextCurrentPage = Math.min(targetBook.totalPages, Math.max(0, nextCurrentPage + delta));
        return {
          ...homework,
          status: 'missed',
          completedPage: null,
          completedCount: 0,
          checkedAt: new Date().toISOString()
        };
      }

      return homework;
    });

    const updatedBook = {
      ...targetBook,
      homeworkLogs: updatedLogs,
      currentPage: Math.min(nextCurrentPage, targetBook.totalPages),
      updatedAt: new Date().toISOString()
    };

    await updateBook(updatedBook);
    setBooks(books.map((book) => (book.id === updatedBook.id ? updatedBook : book)));
  };

  const getHomeworkStats = (book) => {
    const logs = book.homeworkLogs || [];
    const total = logs.length;
    const completed = logs.filter((h) => h.status === 'done').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const active = logs.filter((h) => h.status === 'pending' || h.status === 'partial');
    const history = logs
      .filter((h) => h.status === 'done' || h.status === 'missed')
      .sort((a, b) => new Date(b.checkedAt || b.assignedAt) - new Date(a.checkedAt || a.assignedAt));

    return { total, completed, completionRate, active, history };
  };

  const getHomeworkStatusLabel = (status) => {
    const labels = {
      pending: 'Bekliyor',
      partial: 'Kısmi',
      done: 'Tamamlandı',
      missed: 'Yapılmadı'
    };
    return labels[status] || status;
  };

  const getHomeworkStatusClass = (status) => {
    const classes = {
      pending: 'bg-amber-100 text-amber-700',
      partial: 'bg-blue-100 text-blue-700',
      done: 'bg-green-100 text-green-700',
      missed: 'bg-red-100 text-red-700'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
  };

  const toggleLessonComplete = async (weekIndex) => {
    try {
      const updatedSchedule = [...student.schedule];
      updatedSchedule[weekIndex].completed = !updatedSchedule[weekIndex].completed;
      
      const updatedStudent = {
        ...student,
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };
      
      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
    } catch (error) {
      console.error('Ders güncellenirken hata:', error);
      notify('Ders durumu güncellenemedi.', 'error');
    }
  };

  const toggleLessonPaymentStatus = async (weekIndex) => {
    try {
      const updatedSchedule = [...(student.schedule || [])];
      const currentLesson = updatedSchedule[weekIndex];
      const nextStatus = currentLesson.paymentStatus === 'collected' ? 'pending' : 'collected';
      const unitFee = parseFloat(student?.initialFee) || parseFloat(student?.fee) || 0;
      const currentAmount = parseFloat(currentLesson?.paymentAmount);
      let nextAmount = (!Number.isNaN(currentAmount) && currentAmount > 0)
        ? currentAmount
        : unitFee;

      if (nextStatus === 'collected' && (!nextAmount || nextAmount <= 0)) {
        const input = await promptValue({
          title: 'Ders Ücreti Girişi',
          message: 'Bu öğrenci için ders başı ücret girin (TL):',
          defaultValue: student?.fee ? String(student.fee) : '1000',
          placeholder: 'Örn: 1250',
          confirmText: 'Kaydet',
          cancelText: 'İptal'
        });
        if (input === null) {
          return;
        }

        const parsed = parseFloat(input);
        if (Number.isNaN(parsed) || parsed <= 0) {
          notify('Lütfen 0’dan büyük geçerli bir ücret girin.', 'warning');
          return;
        }

        nextAmount = parsed;

        for (let index = 0; index < updatedSchedule.length; index += 1) {
          const lesson = updatedSchedule[index];
          const lessonAmount = parseFloat(lesson?.paymentAmount);
          if (Number.isNaN(lessonAmount) || lessonAmount <= 0) {
            updatedSchedule[index] = {
              ...lesson,
              paymentAmount: parsed
            };
          }
        }
      }

      updatedSchedule[weekIndex] = {
        ...updatedSchedule[weekIndex],
        paymentAmount: nextAmount,
        paymentStatus: nextStatus,
        paymentCollectedAt: nextStatus === 'collected' ? (updatedSchedule[weekIndex].paymentCollectedAt || new Date().toISOString()) : null,
        paymentDueDate: updatedSchedule[weekIndex].paymentDueDate || updatedSchedule[weekIndex].date || null
      };

      const updatedStudent = {
        ...student,
        fee: (parseFloat(student?.fee) || 0) > 0 ? student.fee : String(nextAmount),
        initialFee: (parseFloat(student?.initialFee) || 0) > 0 ? student.initialFee : nextAmount,
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
    } catch (error) {
      console.error('Tahsilat durumu güncellenirken hata:', error);
      notify('Tahsilat durumu güncellenemedi.', 'error');
    }
  };

  const updateLessonFinanceField = async (weekIndex, patch) => {
    try {
      const updatedSchedule = [...(student.schedule || [])];
      updatedSchedule[weekIndex] = {
        ...updatedSchedule[weekIndex],
        ...patch
      };

      const updatedStudent = {
        ...student,
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
    } catch (error) {
      console.error('Finans alanı güncellenirken hata:', error);
      notify('Finans bilgisi güncellenemedi.', 'error');
    }
  };

  const handleLessonAmountChange = async (weekIndex, value) => {
    const amount = parseFloat(value);
    if (Number.isNaN(amount) || amount <= 0) {
      notify('Ders ücreti 0’dan büyük olmalıdır.', 'warning');
      return;
    }

    try {
      const updatedSchedule = [...(student.schedule || [])];
      let updatedCount = 0;

      for (let index = weekIndex; index < updatedSchedule.length; index += 1) {
        const lesson = updatedSchedule[index];
        const shouldUpdateCurrent = index === weekIndex;
        const shouldUpdateRemaining = index > weekIndex && lesson.paymentStatus !== 'collected';

        if (shouldUpdateCurrent || shouldUpdateRemaining) {
          const currentAmount = parseFloat(lesson?.paymentAmount) || 0;
          if (currentAmount !== amount) {
            updatedSchedule[index] = {
              ...lesson,
              paymentAmount: amount
            };
            updatedCount += 1;
          }
        }
      }

      const updatedStudent = {
        ...student,
        fee: String(amount),
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);

      if (updatedCount > 1) {
        notify(`Ders ücreti güncellendi. Seçilen dersten sonraki ${updatedCount - 1} bekleyen derse de uygulandı.`, 'success');
      }
    } catch (error) {
      console.error('Ders ücreti güncellenirken hata:', error);
      notify('Ders ücreti güncellenemedi.', 'error');
    }
  };

  const handleLessonDateChange = async (weekIndex, value) => {
    if (!value) return;
    const targetLesson = student.schedule?.[weekIndex];
    if (!targetLesson) return;

    if (targetLesson.paymentStatus === 'collected') {
      await updateLessonFinanceField(weekIndex, { paymentCollectedAt: value });
    } else {
      await updateLessonFinanceField(weekIndex, { paymentDueDate: value });
    }
  };

  const applyBulkPricingFromDate = async () => {
    const amount = parseFloat(bulkPricing.amount);
    const startDate = bulkPricing.startDate;

    if (!startDate) {
      notify('Lütfen fiyat güncelleme başlangıç tarihi seçin.', 'warning');
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      notify('Lütfen geçerli bir ders ücreti girin.', 'warning');
      return;
    }

    try {
      const updatedSchedule = [...(student.schedule || [])];
      let updatedCount = 0;

      for (let index = 0; index < updatedSchedule.length; index += 1) {
        const lesson = updatedSchedule[index];
        const lessonDate = lesson.date || lesson.paymentDueDate;
        const shouldUpdate = lesson.paymentStatus !== 'collected' && lessonDate && lessonDate >= startDate;

        if (shouldUpdate) {
          const currentAmount = parseFloat(lesson.paymentAmount) || 0;
          if (currentAmount !== amount) {
            updatedSchedule[index] = {
              ...lesson,
              paymentAmount: amount
            };
            updatedCount += 1;
          }
        }
      }

      if (updatedCount === 0) {
        notify('Seçilen tarihten sonra güncellenecek bekleyen ders bulunamadı.', 'info');
        return;
      }

      const updatedStudent = {
        ...student,
        fee: String(amount),
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
      notify(`Fiyat güncelleme uygulandı. ${updatedCount} bekleyen dersin ücreti güncellendi.`, 'success');
    } catch (error) {
      console.error('Toplu fiyat güncelleme hatası:', error);
      notify('Toplu fiyat güncellemesi yapılamadı.', 'error');
    }
  };

  const openObjectivesModal = (weekIndex) => {
    setSelectedWeek(weekIndex);
    setShowObjectivesModal(true);
  };

  const openCreateLessonForm = () => {
    const defaultAmount = parseFloat(student?.fee) || parseFloat(student?.initialFee) || 0;
    const defaultDays = Array.isArray(student?.lessonDays) && student.lessonDays.length > 0
      ? student.lessonDays
      : [student?.lessonDay || '1'];
    const recurrenceDays = [...new Set(defaultDays.map((day) => {
      const parsed = parseInt(day, 10);
      if (Number.isNaN(parsed)) return 0;
      return parsed === 0 ? 6 : parsed - 1;
    }))].sort((a, b) => a - b);

    setEditingLessonIndex(null);
    setEditingScope('single');
    setLessonForm({
      date: toDateKey(new Date()),
      time: '16:00',
      duration: '60',
      amount: defaultAmount > 0 ? String(defaultAmount) : '',
      paymentStatus: 'pending',
      topic: '',
      description: '',
      addMode: 'single',
      repeatEveryWeeks: String(student?.recurrenceIntervalWeeks || '1'),
      recurrenceDays,
      untilDate: '',
      count: '4'
    });
    setShowLessonForm(true);
  };

  const openEditLessonForm = (lessonIndex, scope = 'single') => {
    const lesson = student?.schedule?.[lessonIndex];
    if (!lesson) return;

    setEditingLessonIndex(lessonIndex);
    setEditingScope(scope);
    setLessonForm({
      date: lesson.date || toDateKey(new Date()),
      time: lesson.time || '16:00',
      duration: String(lesson.duration || 60),
      amount: String(parseFloat(lesson.paymentAmount) || parseFloat(student?.fee) || parseFloat(student?.initialFee) || ''),
      paymentStatus: lesson.paymentStatus || 'pending',
      topic: lesson.topic || '',
      description: lesson.description || '',
      addMode: 'single',
      repeatEveryWeeks: '1',
      recurrenceDays: [],
      untilDate: '',
      count: '1'
    });
    setShowLessonForm(true);
  };

  const closeLessonForm = () => {
    setShowLessonForm(false);
    setEditingLessonIndex(null);
    setEditingScope('single');
  };

  const buildRecurringDatesFromLessonForm = () => {
    const start = new Date(lessonForm.date);
    start.setHours(0, 0, 0, 0);

    if (lessonForm.addMode === 'single') {
      return [toDateKey(start)];
    }

    const dates = [];
    const intervalWeeks = Math.max(1, parseInt(lessonForm.repeatEveryWeeks || '1', 10));
    const selectedDays = [...(lessonForm.recurrenceDays || [])];
    if (selectedDays.length === 0) {
      selectedDays.push(getMondayIndexFromDate(lessonForm.date));
    }
    selectedDays.sort((a, b) => a - b);

    const startWeek = getWeekStart(start);

    if (lessonForm.addMode === 'untilDate') {
      const end = new Date(lessonForm.untilDate || lessonForm.date);
      end.setHours(0, 0, 0, 0);

      for (let cycle = 0; cycle < 520; cycle += 1) {
        const cycleStart = new Date(startWeek);
        cycleStart.setDate(startWeek.getDate() + (cycle * intervalWeeks * 7) + selectedDays[0]);
        if (cycleStart > end) break;

        selectedDays.forEach((dayIndex) => {
          const candidate = new Date(startWeek);
          candidate.setDate(startWeek.getDate() + (cycle * intervalWeeks * 7) + dayIndex);
          candidate.setHours(0, 0, 0, 0);

          if (candidate < start || candidate > end) return;
          dates.push(toDateKey(candidate));
        });
      }

      return dates;
    }

    const count = Math.max(1, parseInt(lessonForm.count || '1', 10));
    for (let cycle = 0; cycle < 520 && dates.length < count; cycle += 1) {
      selectedDays.forEach((dayIndex) => {
        if (dates.length >= count) return;

        const candidate = new Date(startWeek);
        candidate.setDate(startWeek.getDate() + (cycle * intervalWeeks * 7) + dayIndex);
        candidate.setHours(0, 0, 0, 0);

        if (candidate < start) return;
        dates.push(toDateKey(candidate));
      });
    }

    return dates;
  };

  const getActiveLessonRecurrenceDays = () => {
    if (Array.isArray(lessonForm.recurrenceDays) && lessonForm.recurrenceDays.length > 0) {
      return [...lessonForm.recurrenceDays].sort((a, b) => a - b);
    }
    return [getMondayIndexFromDate(lessonForm.date)];
  };

  const toggleLessonRecurrenceDay = (dayIndex) => {
    const activeDays = getActiveLessonRecurrenceDays();
    const exists = activeDays.includes(dayIndex);

    if (exists && activeDays.length === 1) {
      return;
    }

    const nextDays = exists
      ? activeDays.filter((day) => day !== dayIndex)
      : [...activeDays, dayIndex].sort((a, b) => a - b);

    setLessonForm((prev) => ({
      ...prev,
      recurrenceDays: nextDays
    }));
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.date || !lessonForm.time) {
      notify('Lütfen tarih ve saat girin.', 'warning');
      return;
    }

    const amount = parseFloat(lessonForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      notify('Lütfen geçerli bir ders ücreti girin.', 'warning');
      return;
    }

    if (lessonForm.addMode === 'untilDate' && lessonForm.untilDate && lessonForm.untilDate < lessonForm.date) {
      notify('Bitiş tarihi başlangıç tarihinden önce olamaz.', 'warning');
      return;
    }

    try {
      const updatedSchedule = [...(student.schedule || [])];
      const touchedLessonIndexes = [];

      if (editingLessonIndex !== null) {
        const current = updatedSchedule[editingLessonIndex];
        if (!current) return;

        const nextStatus = lessonForm.paymentStatus;
        const applyPatchToLesson = (lesson, includeDate = false) => ({
          ...lesson,
          ...(includeDate ? { date: lessonForm.date } : {}),
          time: lessonForm.time,
          duration: parseInt(lessonForm.duration || '60', 10),
          topic: lessonForm.topic || null,
          description: lessonForm.description || null,
          paymentAmount: amount,
          paymentStatus: nextStatus,
          paymentCollectedAt: nextStatus === 'collected'
            ? (lesson.paymentCollectedAt || new Date().toISOString())
            : null,
          paymentDueDate: nextStatus === 'pending'
            ? (lesson.paymentDueDate || lesson.date || lessonForm.date)
            : lesson.paymentDueDate || lesson.date || lessonForm.date
        });

        if (editingScope === 'single') {
          updatedSchedule[editingLessonIndex] = applyPatchToLesson(current, true);
          touchedLessonIndexes.push(editingLessonIndex);
        } else if (editingScope === 'fromHere') {
          for (let index = editingLessonIndex; index < updatedSchedule.length; index += 1) {
            updatedSchedule[index] = applyPatchToLesson(updatedSchedule[index], false);
            touchedLessonIndexes.push(index);
          }
        } else {
          for (let index = 0; index < updatedSchedule.length; index += 1) {
            updatedSchedule[index] = applyPatchToLesson(updatedSchedule[index], false);
            touchedLessonIndexes.push(index);
          }
        }
      } else {
        const dates = buildRecurringDatesFromLessonForm();
        let addedCount = 0;

        dates.forEach((date) => {
          const candidateLesson = {
            date,
            time: lessonForm.time,
            duration: parseInt(lessonForm.duration || '60', 10)
          };
          const hasOwnConflict = updatedSchedule.some((lesson) => hasTimeRangeOverlap(candidateLesson, lesson));
          if (hasOwnConflict) return;

          const nextStatus = lessonForm.paymentStatus || 'pending';
          updatedSchedule.push({
            date,
            time: lessonForm.time,
            duration: parseInt(lessonForm.duration || '60', 10),
            completed: false,
            topic: lessonForm.topic || null,
            description: lessonForm.description || null,
            paymentAmount: amount,
            paymentStatus: nextStatus,
            paymentCollectedAt: nextStatus === 'collected' ? new Date().toISOString() : null,
            paymentDueDate: date,
            calendarHidden: false
          });
          touchedLessonIndexes.push(updatedSchedule.length - 1);
          addedCount += 1;
        });

        if (addedCount === 0) {
          notify('Eklenecek yeni ders bulunamadı (aynı tarih/saat dersleri atlandı).', 'warning');
          return;
        }
      }

      const allStudents = await getStudents();
      const otherStudentsLessons = (allStudents || [])
        .filter((entry) => entry.id !== student.id)
        .flatMap((entry) => (entry.schedule || []).map((lesson) => ({
          date: lesson.date,
          time: lesson.time,
          duration: lesson.duration || entry.lessonDuration || 60
        })));

      const hasConflict = touchedLessonIndexes.some((lessonIndex) => {
        const targetLesson = updatedSchedule[lessonIndex];
        if (!targetLesson) return false;

        const ownConflict = updatedSchedule.some((lesson, compareIndex) => {
          if (compareIndex === lessonIndex) return false;
          return hasTimeRangeOverlap(targetLesson, lesson);
        });

        const globalConflict = otherStudentsLessons.some((lesson) => hasTimeRangeOverlap(targetLesson, lesson));
        return ownConflict || globalConflict;
      });

      if (hasConflict) {
        notify('Ders saatleri çakışıyor. Lütfen farklı bir saat aralığı seçin.', 'warning');
        return;
      }

      const normalizedSchedule = normalizeScheduleOrder(updatedSchedule);
      const updatedStudent = {
        ...student,
        fee: String(amount),
        schedule: normalizedSchedule,
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
      closeLessonForm();
    } catch (error) {
      console.error('Ders kaydetme hatası:', error);
      notify('Ders kaydedilemedi.', 'error');
    }
  };

  const removeFromSchedule = (schedule, targetIndex, mode) => {
    if (targetIndex < 0) return { nextSchedule: schedule, removedCount: 0, hiddenCount: 0 };

    const targetDateTime = createDateFromLesson(schedule[targetIndex]);
    let removedCount = 0;
    let hiddenCount = 0;

    const nextSchedule = schedule
      .map((lesson, index) => {
        const lessonDateTime = createDateFromLesson(lesson);
        const isTarget = index === targetIndex;
        const isFromTarget = lessonDateTime >= targetDateTime;
        const shouldDeleteCandidate =
          (mode === 'single' && isTarget) ||
          (mode === 'fromHere' && isFromTarget) ||
          (mode === 'all');

        if (!shouldDeleteCandidate) {
          return lesson;
        }

        const shouldPreserveAndHide = lesson.paymentStatus === 'collected' || !!lesson.completed;

        if (shouldPreserveAndHide) {
          if (!lesson.calendarHidden) {
            hiddenCount += 1;
            return {
              ...lesson,
              calendarHidden: true
            };
          }
          return lesson;
        }

        removedCount += 1;
        return null;
      })
      .filter(Boolean);

    return { nextSchedule, removedCount, hiddenCount };
  };

  const deleteLessonByMode = async (lessonIndex, mode) => {
    try {
      const confirmMessage = mode === 'single'
        ? 'Bu dersi silmek istediğinize emin misiniz?\n(Tahsil edilmiş/tamamlanmış dersler takvimden gizlenir.)'
        : mode === 'fromHere'
          ? 'Bu ders ve sonraki dersleri silmek istediğinize emin misiniz?\n(Tahsil edilmiş/tamamlanmış dersler takvimden gizlenir.)'
          : 'Tüm dersleri silmek istediğinize emin misiniz?\n(Tahsil edilmiş/tamamlanmış dersler takvimden gizlenir.)';

      const shouldDelete = await confirmAction({
        title: 'Ders Silme Onayı',
        message: confirmMessage,
        confirmText: 'Sil',
        cancelText: 'Vazgeç',
        danger: true
      });

      if (!shouldDelete) {
        return;
      }

      const { nextSchedule, removedCount, hiddenCount } = removeFromSchedule(student.schedule || [], lessonIndex, mode);

      if (removedCount === 0 && hiddenCount === 0) {
        notify('İşlem yapılacak ders bulunamadı.', 'warning');
        return;
      }

      const updatedStudent = {
        ...student,
        schedule: normalizeScheduleOrder(nextSchedule),
        updatedAt: new Date().toISOString()
      };

      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
      notify(`${removedCount} ders silindi, ${hiddenCount} ders takvimden gizlendi.`, 'success');
    } catch (error) {
      console.error('Ders silme hatası:', error);
      notify('Ders silinemedi.', 'error');
    }
  };

  const toggleObjective = async (objective) => {
    try {
      const updatedSchedule = [...student.schedule];
      const currentObjectives = updatedSchedule[selectedWeek].objectives || [];
      
      const objectiveIndex = currentObjectives.indexOf(objective);
      if (objectiveIndex > -1) {
        // Remove objective
        currentObjectives.splice(objectiveIndex, 1);
      } else {
        // Add objective
        currentObjectives.push(objective);
      }
      
      updatedSchedule[selectedWeek].objectives = currentObjectives;
      
      const updatedStudent = {
        ...student,
        schedule: updatedSchedule,
        updatedAt: new Date().toISOString()
      };
      
      await updateStudent(updatedStudent);
      setStudent(updatedStudent);
    } catch (error) {
      console.error('Kazanım güncellenirken hata:', error);
      notify('Kazanım güncellenemedi.', 'error');
    }
  };

  const isObjectiveSelected = (objective) => {
    if (!student.schedule[selectedWeek].objectives) return false;
    return student.schedule[selectedWeek].objectives.includes(objective);
  };

  const handleDelete = async () => {
    const shouldDelete = await confirmAction({
      title: 'Öğrenciyi Sil',
      message: 'Bu öğrenciyi silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      danger: true
    });

    if (shouldDelete) {
      try {
        await deleteStudent(id);
        navigate('/students');
      } catch (error) {
        console.error('Öğrenci silinirken hata:', error);
        notify('Öğrenci silinirken hata oluştu.', 'error');
      }
    }
  };

  if (!student) return <div className="p-8">Yukleniyor...</div>;

  const completedLessons = student.schedule?.filter(l => l.completed).length || 0;
  const totalLessons = student.schedule?.length || 0;
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const gradeNumber = parseInt(student?.grade || '0', 10);
  const isUpperGradeTracking = gradeNumber >= 7;
  const curriculumTabLabel = isUpperGradeTracking ? 'Kazanım Takibi' : 'Öğrenme Takibi';
  const scheduleLessons = student.schedule || [];
  const expectedRevenue = scheduleLessons.reduce((sum, lesson) => sum + (parseFloat(lesson.paymentAmount) || 0), 0);
  const collectedRevenue = scheduleLessons
    .filter((lesson) => lesson.paymentStatus === 'collected')
    .reduce((sum, lesson) => sum + (parseFloat(lesson.paymentAmount) || 0), 0);
  const pendingRevenue = Math.max(expectedRevenue - collectedRevenue, 0);
  const collectionPercent = expectedRevenue > 0 ? (collectedRevenue / expectedRevenue) * 100 : 0;
  const pendingLessons = scheduleLessons.filter((lesson) => lesson.paymentStatus !== 'collected').length;
  const curriculumProgressRows = curriculum.map((item) => {
    const lessonIndex = scheduleLessons.findIndex((lesson) => lesson.week === item.week);
    const lesson = lessonIndex >= 0 ? scheduleLessons[lessonIndex] : null;
    const outcomes = item.objectives || item.learningOutcomes || [];
    const selectedCount = lesson?.objectives?.length || 0;
    const totalCount = outcomes.length;
    const rate = totalCount > 0 ? Math.min(100, (selectedCount / totalCount) * 100) : 0;

    return {
      ...item,
      lessonIndex,
      lesson,
      outcomes,
      selectedCount,
      totalCount,
      rate
    };
  });
  const trackedWeeks = curriculumProgressRows.filter((row) => row.totalCount > 0).length;
  const completedWeeks = curriculumProgressRows.filter((row) => row.totalCount > 0 && row.selectedCount >= row.totalCount).length;
  const totalSelectedOutcomes = curriculumProgressRows.reduce((sum, row) => sum + row.selectedCount, 0);
  const totalOutcomes = curriculumProgressRows.reduce((sum, row) => sum + row.totalCount, 0);

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/students')}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.fullName}</h1>
            <p className="text-gray-600">{student.grade}. Sınıf • {student.school}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate(`/students/${id}/edit`)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profil Karti */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700 overflow-hidden">
            {student.photo ? (
              <img src={student.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500">Ilerleme:</span>
              <span className="text-sm font-semibold text-primary-600">
                {completedLessons}/{totalLessons} Ders
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        
        {student.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            {student.notes}
          </div>
        )}
      </div>

      {/* Tablar */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'schedule' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Ders Planı
        </button>
        <button
          onClick={() => setActiveTab('curriculum')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'curriculum' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          {curriculumTabLabel}
        </button>
        <button
          onClick={() => setActiveTab('books')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'books' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Kitap Takibi
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'exams' 
              ? 'border-primary-600 text-primary-600' 
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Denemeler
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'analysis'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Analiz
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors nowrap ${
            activeTab === 'finance'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Finans
        </button>
      </div>

      {/* Ders Planı Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-2">
          <div className="card border-primary-200 bg-primary-50/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-primary-900">Ders Yönetimi</p>
                <p className="text-xs text-primary-700">Takvim ile uyumlu ders ekleme/silme ve finans alanları</p>
              </div>
              <button
                onClick={openCreateLessonForm}
                className="btn-primary px-3 py-2 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Ders Ekle
              </button>
            </div>
          </div>

          {student.schedule?.map((lesson, index) => {
            const weekCurriculum = curriculum.find(c => c.week === lesson.week);
            const objectivesCount = lesson.objectives?.length || 0;
            
            return (
              <div 
                key={index}
                className={'card ' + (lesson.completed ? 'bg-green-50' : '')}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleLessonComplete(index)}
                    className="flex-shrink-0"
                  >
                    {lesson.completed ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        Hafta {lesson.week}
                      </span>
                      {lesson.completed && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Tamamlandı
                        </span>
                      )}
                      <span className={'text-xs px-2 py-0.5 rounded-full ' + (lesson.paymentStatus === 'collected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                        {lesson.paymentStatus === 'collected' ? 'Tahsil Edildi' : 'Beklemede'}
                      </span>
                      {objectivesCount > 0 && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {objectivesCount}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {formatShortDate(lesson.date)} {getDayName(lesson.date)}
                      <span className="text-gray-400">•</span>
                      {getTimeRangeLabel(lesson.time, lesson.duration)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Ders Ücreti: {(parseFloat(lesson.paymentAmount) || 0).toLocaleString('tr-TR')} TL
                    </div>
                    {lesson.topic && (
                      <p className="text-xs text-gray-700 mt-1">
                        <span className="font-medium">Konu:</span> {lesson.topic}
                      </p>
                    )}
                    {lesson.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {lesson.description}
                      </p>
                    )}
                    {weekCurriculum && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {weekCurriculum.unit || weekCurriculum.topic || weekCurriculum.theme}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLessonPaymentStatus(index);
                      }}
                      className={'text-xs font-medium px-2 py-1 rounded-lg ' + (lesson.paymentStatus === 'collected' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100')}
                    >
                      {lesson.paymentStatus === 'collected' ? 'Beklemeye Al' : 'Tahsil Et'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditLessonForm(index, 'single');
                      }}
                      className="text-xs font-medium px-2 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      Düzenle
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditLessonForm(index, 'fromHere');
                      }}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      Sonrası Düz
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditLessonForm(index, 'all');
                      }}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      Tümü Düz
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLessonByMode(index, 'single');
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100"
                        title="Bu dersi sil"
                      >
                        Sil
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLessonByMode(index, 'fromHere');
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100"
                        title="Bu ve sonrakileri sil"
                      >
                        Sonrası
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLessonByMode(index, 'all');
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100"
                        title="Tüm dersleri sil"
                      >
                        Tümü
                      </button>
                    </div>

                    {weekCurriculum && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openObjectivesModal(index);
                        }}
                        className="flex-shrink-0 p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Kazanımları seç"
                      >
                        <Target className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finans Tab */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          <div className="card border-indigo-200 bg-indigo-50/40">
            <h4 className="font-semibold text-indigo-900 mb-3">Tarih Bazlı Fiyat Güncelleme</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={bulkPricing.startDate}
                  onChange={(e) => setBulkPricing({ ...bulkPricing, startDate: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Yeni Ders Ücreti (TL)</label>
                <input
                  type="number"
                  min="1"
                  value={bulkPricing.amount}
                  onChange={(e) => setBulkPricing({ ...bulkPricing, amount: e.target.value })}
                  className="input-field"
                  placeholder="örn: 1500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={applyBulkPricingFromDate}
                  className="btn-primary w-full py-2.5"
                >
                  Fiyatı Güncelle
                </button>
              </div>
            </div>
            <p className="text-xs text-indigo-700 mt-2">
              Seçilen tarih ve sonrasındaki yalnızca bekleyen derslerin ücreti güncellenir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card border-primary-200 bg-primary-50/40">
              <p className="text-xs text-primary-700 font-medium">Beklenen Toplam</p>
              <p className="text-2xl font-bold text-primary-900 mt-1">{expectedRevenue.toLocaleString('tr-TR')} TL</p>
            </div>
            <div className="card border-green-200 bg-green-50/40">
              <p className="text-xs text-green-700 font-medium">Tahsil Edilen</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{collectedRevenue.toLocaleString('tr-TR')} TL</p>
              <p className="text-xs text-green-700 mt-1">%{collectionPercent.toFixed(1)} tamamlandı</p>
            </div>
            <div className="card border-amber-200 bg-amber-50/40">
              <p className="text-xs text-amber-700 font-medium">Bekleyen</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{pendingRevenue.toLocaleString('tr-TR')} TL</p>
              <p className="text-xs text-amber-700 mt-1">{pendingLessons} ders beklemede</p>
            </div>
          </div>

          <div className="space-y-3">
            {scheduleLessons.map((lesson, index) => {
              const isCollected = lesson.paymentStatus === 'collected';
              const amount = parseFloat(lesson.paymentAmount) || 0;
              const dateValue = isCollected
                ? (lesson.paymentCollectedAt ? String(lesson.paymentCollectedAt).split('T')[0] : '')
                : (lesson.paymentDueDate || lesson.date || '');

              return (
                <div key={index} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">Hafta {lesson.week}</p>
                      <p className="text-xs text-gray-500">{formatShortDate(lesson.date)} {getDayName(lesson.date)} • {getTimeRangeLabel(lesson.time, lesson.duration)}</p>
                    </div>
                    <span className={'text-xs px-2 py-1 rounded-full ' + (isCollected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {isCollected ? 'Tahsil Edildi' : 'Beklemede'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ders Ücreti (TL)</label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={amount || ''}
                        onBlur={(e) => {
                          const next = parseFloat(e.target.value) || 0;
                          if (next !== amount) {
                            handleLessonAmountChange(index, e.target.value);
                          }
                        }}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {isCollected ? 'Tahsilat Tarihi' : 'Vade Tarihi'}
                      </label>
                      <input
                        type="date"
                        value={dateValue}
                        onChange={(e) => handleLessonDateChange(index, e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {amount.toLocaleString('tr-TR')} TL
                    </p>
                    <button
                      onClick={() => toggleLessonPaymentStatus(index)}
                      className={'text-xs font-medium px-3 py-1.5 rounded-lg ' + (isCollected ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100')}
                    >
                      {isCollected ? 'Beklemeye Al' : 'Tahsil Et'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Denemeler Tab */}
      {activeTab === 'exams' && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => navigate(`/exams/new?studentId=${encodeURIComponent(id)}`)}
              className="btn-primary w-full py-3"
            >
              Deneme Ekle ({student.fullName})
            </button>
          </div>

          {exams.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Henüz deneme eklenmemiş</p>
              <button 
                onClick={() => navigate(`/exams/new?studentId=${encodeURIComponent(id)}`)}
                className="mt-4 text-primary-600 font-medium"
              >
                Bu öğrenci için deneme ekle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div key={exam.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-700">D</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {exam.name?.trim() || `${formatShortDate(exam.date)} Denemesi`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(exam.subject || '').charAt(0).toUpperCase() + (exam.subject || '').slice(1)} • {formatShortDate(exam.date)} • {exam.type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-700">
                        {exam.net}
                      </p>
                      <p className="text-xs text-gray-500">
                        {exam.correct}D {exam.wrong}Y {exam.empty}B
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${(exam.net / 20) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {((exam.net / 20) * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Hata Türleri */}
                  {exam.errors && exam.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-600 font-medium mb-1">Hata Türleri:</p>
                      <div className="flex flex-wrap gap-1">
                        {exam.errors.map((error, idx) => (
                          <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {error.type}: {error.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sil Butonu */}
                  <button
                    onClick={async () => {
                      const shouldDelete = await confirmAction({
                        title: 'Denemeyi Sil',
                        message: 'Bu denemeyi silmek istediğinize emin misiniz?',
                        confirmText: 'Sil',
                        cancelText: 'Vazgeç',
                        danger: true
                      });

                      if (shouldDelete) {
                        try {
                          await deleteExam(exam.id);
                          await loadExams();
                        } catch (error) {
                          notify('Silme hatası: ' + error.message, 'error');
                        }
                      }
                    }}
                    className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <TrashIcon className="w-3 h-3" />
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analiz Tab */}
      {activeTab === 'analysis' && (
        <div className="-mx-4 sm:mx-0">
          <ErrorAnalysis forcedStudentId={id} embedded />
        </div>
      )}

      {/* Müfredat Tab */}
      {activeTab === 'curriculum' && (
        <div>
          {curriculum.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>{curriculumTabLabel} verisi bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="card border-primary-200 bg-primary-50/40">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-primary-700 font-medium">Takip Başlığı</p>
                    <p className="text-sm font-semibold text-primary-900 mt-1">{curriculumTabLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-primary-700 font-medium">Tamamlanan Hafta</p>
                    <p className="text-sm font-semibold text-primary-900 mt-1">{completedWeeks}/{trackedWeeks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-primary-700 font-medium">Toplam İlerleme</p>
                    <p className="text-sm font-semibold text-primary-900 mt-1">{totalSelectedOutcomes}/{totalOutcomes}</p>
                  </div>
                </div>
              </div>

              {curriculumProgressRows.map((item, index) => (
                <div key={index} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">
                          Hafta {item.week}
                        </span>
                        {item.totalCount > 0 && (
                          <span className={'text-xs px-2 py-1 rounded-full ' + (item.selectedCount >= item.totalCount ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                            {item.selectedCount >= item.totalCount ? 'Tamamlandı' : 'Takipte'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {item.unit || item.topic || item.theme || 'Konu'}
                      </h3>
                      {item.outcomes && item.outcomes.length > 0 && (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium mb-1">{isUpperGradeTracking ? 'Kazanımlar:' : 'Öğrenme çıktıları:'}</p>
                          <ul className="list-disc list-inside space-y-0.5 text-xs">
                            {item.outcomes.slice(0, 3).map((outcome, idx) => (
                              <li key={idx} className="text-gray-600">{outcome}</li>
                            ))}
                            {item.outcomes.length > 3 && (
                              <li className="text-gray-500">+{item.outcomes.length - 3} daha...</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {item.totalCount > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{isUpperGradeTracking ? 'Kazanım ilerlemesi' : 'Öğrenme ilerlemesi'}</span>
                            <span className="font-semibold text-gray-700">{item.selectedCount}/{item.totalCount}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${item.rate}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-3">
                      {item.lessonIndex >= 0 && item.totalCount > 0 ? (
                        <button
                          onClick={() => openObjectivesModal(item.lessonIndex)}
                          className="text-xs font-medium px-3 py-2 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100"
                        >
                          {isUpperGradeTracking ? 'Kazanım Seç' : 'Öğrenme Seç'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Ders planında hafta yok</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kitap Takibi Tab */}
      {activeTab === 'books' && (
        <div>
          <div className="mb-6">
            <button 
              onClick={() => setShowNewBookModal(true)}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Kitap Ekle
            </button>
          </div>

          {books.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Henüz kitap eklenmemiş</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {books.map((book) => {
                const trackingMode = book.trackingMode || 'page';
                const progress = book.totalPages > 0 ? (book.currentPage / book.totalPages) * 100 : 0;
                const selectedOutcomeCount = (book.selectedOutcomes || []).length;
                const totalOutcomeCount = (book.learningOutcomes || []).length;
                const outcomeProgress = totalOutcomeCount > 0 ? (selectedOutcomeCount / totalOutcomeCount) * 100 : 0;

                return (
                  <button
                    key={book.id}
                    onClick={() => openBookDetailModal(book.id)}
                    className="rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md transition-all text-left"
                  >
                    <div className="aspect-[5/6] p-2.5 flex flex-col justify-between bg-primary-50/50">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 text-xs leading-snug break-words line-clamp-4">{book.title}</h4>
                        <p className="text-[11px] text-gray-600 mt-1">{book.grade || student.grade}. Sınıf</p>
                        <p className="text-[11px] text-gray-500">{trackingMode === 'outcome' ? 'Kazanım' : 'Sayfa'}</p>
                      </div>

                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div
                            className="bg-primary-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${trackingMode === 'page' ? progress : outcomeProgress}%` }}
                          />
                        </div>
                        {trackingMode === 'page' ? (
                          <p className="text-[11px] text-gray-700">{book.currentPage}/{book.totalPages} sayfa</p>
                        ) : (
                          <p className="text-[11px] text-gray-700">{selectedOutcomeCount}/{totalOutcomeCount} kazanım</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Kitap Detay Modal */}
      {showBookDetailModal && selectedBookDetail && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeBookDetailModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg my-8 pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Kitap Detayı</h2>
                  <p className="text-sm text-gray-600">{selectedBookDetail.title}</p>
                </div>
                <button onClick={closeBookDetailModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const trackingMode = selectedBookDetail.trackingMode || 'page';
                const pageProgress = selectedBookDetail.totalPages > 0
                  ? (selectedBookDetail.currentPage / selectedBookDetail.totalPages) * 100
                  : 0;
                const selectedOutcomeCount = (selectedBookDetail.selectedOutcomes || []).length;
                const totalOutcomeCount = (selectedBookDetail.learningOutcomes || []).length;
                const outcomeProgress = totalOutcomeCount > 0 ? (selectedOutcomeCount / totalOutcomeCount) * 100 : 0;
                const homeworkStats = getHomeworkStats(selectedBookDetail);

                return (
                  <div className="space-y-4">
                    <div className="text-xs text-gray-600 flex items-center justify-between">
                      <span>{selectedBookDetail.grade || student.grade}. Sınıf</span>
                      <span>{trackingMode === 'outcome' ? 'Kazanım Bazlı' : 'Sayfa Bazlı'}</span>
                    </div>

                    {trackingMode === 'page' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={selectedBookDetail.currentPage}
                            onChange={(e) => handleUpdateBook(selectedBookDetail.id, parseInt(e.target.value, 10) || 0)}
                            className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                            min="0"
                            max={selectedBookDetail.totalPages}
                          />
                          <span className="text-sm text-gray-600">/{selectedBookDetail.totalPages}</span>
                          <span className="text-sm font-medium text-gray-700 ml-auto">%{pageProgress.toFixed(0)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${pageProgress}%` }} />
                        </div>
                        <p className="text-xs text-gray-600">
                          Ödev: {homeworkStats.total} • Tamamlanan: {homeworkStats.completed}
                        </p>
                        <button
                          onClick={() => openHomeworkModal(selectedBookDetail)}
                          className="w-full btn-primary py-2"
                        >
                          Ödev Ver
                        </button>

                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-900">Aktif Ödevler</h3>
                          {homeworkStats.active.length === 0 ? (
                            <p className="text-xs text-gray-500">Kontrol bekleyen ödev yok.</p>
                          ) : (
                            <div className="space-y-2">
                              {homeworkStats.active
                                .sort((a, b) => new Date(a.dueDate || a.assignedAt) - new Date(b.dueDate || b.assignedAt))
                                .map((homework) => (
                                  <div key={homework.id} className="rounded-lg border border-gray-200 p-2.5 bg-gray-50">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                      <span className="font-medium text-gray-800">Sayfa {homework.fromPage}-{homework.toPage}</span>
                                      <span className={'px-2 py-0.5 rounded-full text-[11px] ' + getHomeworkStatusClass(homework.status)}>
                                        {getHomeworkStatusLabel(homework.status)}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-2">Son tarih: {formatShortDate(homework.dueDate)}</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <button
                                        onClick={() => handleUpdateHomeworkStatus(selectedBookDetail.id, homework.id, 'done')}
                                        className="px-2 py-1 rounded-md text-[11px] bg-green-100 text-green-700 hover:bg-green-200"
                                      >
                                        Yapıldı
                                      </button>
                                      <button
                                        onClick={() => handleUpdateHomeworkStatus(selectedBookDetail.id, homework.id, 'partial')}
                                        className="px-2 py-1 rounded-md text-[11px] bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      >
                                        Kısmi
                                      </button>
                                      <button
                                        onClick={() => handleUpdateHomeworkStatus(selectedBookDetail.id, homework.id, 'missed')}
                                        className="px-2 py-1 rounded-md text-[11px] bg-red-100 text-red-700 hover:bg-red-200"
                                      >
                                        Yapılmadı
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {homeworkStats.history.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-900">Son Kontroller</h3>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {homeworkStats.history.slice(0, 8).map((homework) => (
                                <div key={homework.id} className="flex items-center justify-between text-xs rounded-lg border border-gray-200 px-2.5 py-2">
                                  <span className="text-gray-700">{homework.fromPage}-{homework.toPage}</span>
                                  <span className={'px-2 py-0.5 rounded-full text-[11px] ' + getHomeworkStatusClass(homework.status)}>
                                    {getHomeworkStatusLabel(homework.status)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="w-full bg-primary-100 rounded-full h-2">
                          <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${outcomeProgress}%` }} />
                        </div>
                        <p className="text-sm text-primary-800">
                          {selectedOutcomeCount}/{totalOutcomeCount} kazanım • %{outcomeProgress.toFixed(0)}
                        </p>
                        <button
                          onClick={() => openOutcomeModal(selectedBookDetail)}
                          className="w-full btn-primary py-2"
                        >
                          Kazanım Seç
                        </button>
                      </>
                    )}

                    <button
                      onClick={handleDeleteBookFromDetail}
                      className="w-full py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Kitabı Sil
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Ders CRUD Modal */}
      {showLessonForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeLessonForm} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{editingLessonIndex !== null ? 'Dersi Düzenle' : 'Ders Ekle'}</h2>
                  <p className="text-sm text-gray-600">Konu, açıklama, fiyat ve tahsilat durumunu düzenleyin</p>
                  {editingLessonIndex !== null && (
                    <p className="text-xs text-primary-700 mt-1">
                      Düzenleme kapsamı: {editingScope === 'single' ? 'Bu ders' : editingScope === 'fromHere' ? 'Bu ve sonraki dersler' : 'Tüm dersler'}
                    </p>
                  )}
                </div>
                <button onClick={closeLessonForm} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={lessonForm.date}
                    onChange={(e) => setLessonForm({ ...lessonForm, date: e.target.value })}
                    disabled={editingLessonIndex !== null && editingScope !== 'single'}
                    className="input-field"
                  />
                  {editingLessonIndex !== null && editingScope !== 'single' && (
                    <p className="text-[11px] text-gray-500 mt-1">Toplu düzenlemede tarih sabit kalır, sadece seçilen derslerde saat/süre/fiyat/içerik güncellenir.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Saat</label>
                  <input
                    type="time"
                    value={lessonForm.time}
                    onChange={(e) => setLessonForm({ ...lessonForm, time: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Süre (dk)</label>
                  <input
                    type="number"
                    min="15"
                    value={lessonForm.duration}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ders Ücreti (TL)</label>
                  <input
                    type="number"
                    min="1"
                    value={lessonForm.amount}
                    onChange={(e) => setLessonForm({ ...lessonForm, amount: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tahsilat Durumu</label>
                  <select
                    value={lessonForm.paymentStatus}
                    onChange={(e) => setLessonForm({ ...lessonForm, paymentStatus: e.target.value })}
                    className="input-field"
                  >
                    <option value="pending">Beklemede</option>
                    <option value="collected">Tahsil Edildi</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Konu</label>
                  <input
                    type="text"
                    value={lessonForm.topic}
                    onChange={(e) => setLessonForm({ ...lessonForm, topic: e.target.value })}
                    className="input-field"
                    placeholder="örn: Problemler"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
                  <textarea
                    value={lessonForm.description}
                    onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                    className="input-field min-h-[84px]"
                    placeholder="Ders notları veya hedefler"
                  />
                </div>

                {editingLessonIndex === null && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ders Ekleme Tipi</label>
                      <select
                        value={lessonForm.addMode}
                        onChange={(e) => setLessonForm({ ...lessonForm, addMode: e.target.value })}
                        className="input-field"
                      >
                        <option value="single">Bir ders ekle</option>
                        <option value="untilDate">Şu tarihe kadar ekle</option>
                        <option value="count">Şu kadar sayıda ekle</option>
                      </select>
                    </div>

                    {lessonForm.addMode !== 'single' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tekrar Aralığı (Hafta)</label>
                        <input
                          type="number"
                          min="1"
                          value={lessonForm.repeatEveryWeeks}
                          onChange={(e) => setLessonForm({ ...lessonForm, repeatEveryWeeks: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    )}

                    {lessonForm.addMode !== 'single' && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Haftanın Günleri</label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAY_LABELS.map((label, dayIndex) => {
                            const isActive = getActiveLessonRecurrenceDays().includes(dayIndex);
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => toggleLessonRecurrenceDay(dayIndex)}
                                className={'px-2.5 py-1 rounded-full text-xs font-medium border ' + (isActive ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300')}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">Haftada iki gün için iki günü seçebilir, iki haftada bir için aralığı 2 yapabilirsin.</p>
                      </div>
                    )}

                    {lessonForm.addMode === 'untilDate' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bitiş Tarihi</label>
                        <input
                          type="date"
                          value={lessonForm.untilDate}
                          onChange={(e) => setLessonForm({ ...lessonForm, untilDate: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    )}

                    {lessonForm.addMode === 'count' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ders Sayısı</label>
                        <input
                          type="number"
                          min="1"
                          value={lessonForm.count}
                          onChange={(e) => setLessonForm({ ...lessonForm, count: e.target.value })}
                          className="input-field"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={closeLessonForm} className="flex-1 btn-secondary py-2">İptal</button>
                <button onClick={handleSaveLesson} className="flex-1 btn-primary py-2">
                  {editingLessonIndex !== null ? 'Değişiklikleri Kaydet' : 'Dersi Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ödev Ver Modal */}
      {showHomeworkModal && selectedBookForHomework && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeHomeworkModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg my-8 pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Ödev Ver</h2>
                  <p className="text-sm text-gray-600">{selectedBookForHomework.title}</p>
                </div>
                <button onClick={closeHomeworkModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBookForHomework.totalPages}
                      value={homeworkForm.fromPage}
                      onChange={(e) => {
                        const nextFrom = Math.max(1, parseInt(e.target.value, 10) || 1);
                        const currentTo = Math.max(1, parseInt(homeworkForm.toPage, 10) || nextFrom);
                        setHomeworkForm({
                          ...homeworkForm,
                          fromPage: String(nextFrom),
                          toPage: String(Math.max(nextFrom, currentTo))
                        });
                      }}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBookForHomework.totalPages}
                      value={homeworkForm.toPage}
                      onChange={(e) => {
                        const currentFrom = Math.max(1, parseInt(homeworkForm.fromPage, 10) || 1);
                        const nextToRaw = parseInt(e.target.value, 10) || currentFrom;
                        const nextTo = Math.max(currentFrom, Math.min(nextToRaw, selectedBookForHomework.totalPages));
                        setHomeworkForm({ ...homeworkForm, toPage: String(nextTo) });
                      }}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Son Tarih</label>
                  <input
                    type="date"
                    value={homeworkForm.dueDate}
                    onChange={(e) => setHomeworkForm({ ...homeworkForm, dueDate: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={closeHomeworkModal} className="flex-1 btn-secondary py-2">İptal</button>
                <button onClick={handleCreateHomework} className="flex-1 btn-primary py-2">Ödevi Kaydet</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Kitap Kazanım Modal */}
      {showOutcomeModal && selectedBookForOutcome && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeOutcomeModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Kazanım Takibi</h2>
                  <p className="text-sm text-gray-600">{selectedBookForOutcome.title}</p>
                </div>
                <button onClick={closeOutcomeModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(selectedBookForOutcome.learningOutcomes || []).length === 0 ? (
                  <p className="text-sm text-gray-500">Bu kitap için kazanım bulunamadı.</p>
                ) : (
                  (selectedBookForOutcome.learningOutcomes || []).map((outcome, idx) => {
                    const checked = (selectedBookForOutcome.selectedOutcomes || []).includes(outcome);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleBookOutcome(selectedBookForOutcome.id, outcome)}
                        className={'w-full text-left p-3 rounded-lg border-2 transition-all ' +
                          (checked ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}
                      >
                        <div className="flex items-start gap-2">
                          <div className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ' +
                            (checked ? 'border-primary-600 bg-primary-600' : 'border-gray-300')}>
                            {checked && <CheckCircle className="w-4 h-4 text-white" />}
                          </div>
                          <span className={'text-sm ' + (checked ? 'text-primary-900 font-medium' : 'text-gray-700')}>
                            {outcome}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={closeOutcomeModal}
                className="w-full mt-4 btn-primary py-3"
              >
                Tamam
              </button>
            </div>
          </div>
        </>
      )}

      {/* Yeni Kitap Modal */}
      {showNewBookModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowNewBookModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div 
              className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Yeni Kitap Ekle</h2>
                <button 
                  onClick={() => setShowNewBookModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kitap Adı
                  </label>
                  <input 
                    type="text" 
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="örn: MEB Matematik Kitabı"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Toplam Sayfa Sayısı
                  </label>
                  <input 
                    type="number" 
                    value={newBook.totalPages}
                    onChange={(e) => setNewBook({ ...newBook, totalPages: e.target.value })}
                    placeholder="300"
                    className="input-field"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Müfredat (Sınıf) - Öğrencinin Sınıfı: {student.grade}
                  </label>
                  <select 
                    value={newBook.curriculum}
                    onChange={(e) => setNewBook({ ...newBook, curriculum: e.target.value })}
                    className="input-field"
                  >
                    <option value="5">5. Sınıf</option>
                    <option value="6">6. Sınıf</option>
                    <option value="7">7. Sınıf</option>
                    <option value="8">8. Sınıf</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {newBook.curriculum === student.grade && '✓ Öğrencinin sınıfı otomatik seçildi'}
                    {newBook.curriculum !== student.grade && 'Not: Farklı bir müfredat seçtiniz'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Takip Türü
                  </label>
                  <select
                    value={newBook.trackingMode}
                    onChange={(e) => setNewBook({ ...newBook, trackingMode: e.target.value })}
                    className="input-field"
                  >
                    <option value="page">Sayfa Bazlı</option>
                    <option value="outcome">Kazanım Bazlı</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {newBook.trackingMode === 'page'
                      ? 'Ödev ve ilerleme sayfa numarası üzerinden takip edilir.'
                      : 'Kitap ilerlemesi kazanım işaretleme ile takip edilir.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewBookModal(false)}
                  className="flex-1 btn-secondary py-2"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateBook}
                  className="flex-1 btn-primary py-2"
                >
                  Kitabı Oluştur
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Kazanım Seçme Modal */}
      {showObjectivesModal && selectedWeek !== null && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowObjectivesModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div 
              className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 pointer-events-auto"
            >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Hafta {student.schedule[selectedWeek].week}</h2>
                <p className="text-sm text-gray-600">İşlenen kazanımları seçin</p>
              </div>
              <button 
                onClick={() => setShowObjectivesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>

            {curriculum.find(c => c.week === student.schedule[selectedWeek].week) ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const weekCurr = curriculum.find(c => c.week === student.schedule[selectedWeek].week);
                  const objectives = weekCurr.objectives || weekCurr.learningOutcomes || [];
                  
                  return objectives.map((objective, idx) => {
                    const selected = isObjectiveSelected(objective);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleObjective(objective)}
                        className={'w-full text-left p-3 rounded-lg border-2 transition-all ' + 
                          (selected 
                            ? 'border-primary-600 bg-primary-50' 
                            : 'border-gray-200 hover:border-gray-300'
                          )}
                      >
                        <div className="flex items-start gap-2">
                          <div className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ' +
                            (selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300')}>
                            {selected && <CheckCircle className="w-4 h-4 text-white" />}
                          </div>
                          <span className={'text-sm ' + (selected ? 'text-primary-900 font-medium' : 'text-gray-700')}>
                            {objective}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>Bu hafta için kazanım bulunamadı</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowObjectivesModal(false)}
                className="flex-1 btn-primary py-3"
              >
                Tamam
              </button>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentDetail;
