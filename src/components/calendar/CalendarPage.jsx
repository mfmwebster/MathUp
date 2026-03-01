/*
 * File: src/components/calendar/CalendarPage.jsx
 * Description: Ders etkinliklerini günlük/haftalık/aylık/yıllık görünümde yönetir; ders ekleme/silme CRUD akışlarını içerir.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../../hooks/useDatabase';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatShortDate, getDayName } from '../../utils/helpers';

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_LABELS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKLY_START_HOUR = 9;
const DEFAULT_WEEKLY_END_HOUR = 22;
const WEEKLY_PIXELS_PER_HOUR = 56;
const CALENDAR_VIEW_KEY = 'mathup.calendar.viewMode';
const VALID_VIEW_MODES = ['daily', 'weekly', 'monthly', 'yearly'];
const STUDENT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#14b8a6',
  '#6366f1', '#ec4899'
];

const getInitialViewMode = () => {
  try {
    const saved = localStorage.getItem(CALENDAR_VIEW_KEY);
    if (saved && VALID_VIEW_MODES.includes(saved)) {
      return saved;
    }
  } catch (error) {
    return 'daily';
  }
  return 'daily';
};

const toDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getEventDateKey = (dateValue) => {
  const raw = String(dateValue || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return toDateKey(parsed);
};

const parseDateKeyLocal = (dateKey) => {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const createDateFromLesson = (lesson) => {
  const time = lesson?.time || '00:00';
  return new Date(`${lesson?.date}T${time}`);
};

const parseHourFromTime = (timeValue) => {
  const value = String(timeValue || '').trim();
  const match = value.match(/^(\d{1,2})/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  return Number.isNaN(hour) ? null : hour;
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

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { getLessonEvents, getStudents, getStudentById, updateStudent, isReady } = useDatabase();

  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [addForm, setAddForm] = useState({
    studentId: '',
    date: toDateKey(new Date()),
    time: '16:00',
    duration: '60',
    amount: '',
    addMode: 'single',
    repeatEveryWeeks: '1',
    recurrenceDays: [],
    untilDate: '',
    count: '4'
  });

  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady]);

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_VIEW_KEY, viewMode);
    } catch (error) {
      // ignore storage errors
    }
  }, [viewMode]);

  const loadData = async () => {
    const [lessonEvents, studentList] = await Promise.all([getLessonEvents(), getStudents()]);

    const sortedEvents = (lessonEvents || []).sort((a, b) => {
      const aKey = `${a.date || ''} ${a.time || ''}`;
      const bKey = `${b.date || ''} ${b.time || ''}`;
      return aKey.localeCompare(bKey);
    });

    setEvents(sortedEvents);
    setStudents(studentList || []);

    if (studentList?.length > 0) {
      const first = studentList[0];
      const defaultAmount = parseFloat(first?.fee) || parseFloat(first?.initialFee) || 0;
      setAddForm((prev) => ({
        ...prev,
        studentId: prev.studentId || first.id,
        amount: prev.amount || (defaultAmount > 0 ? String(defaultAmount) : '')
      }));
    }
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'daily') {
      const key = toDateKey(referenceDate);
      return `${formatShortDate(key)} ${getDayName(key)}`;
    }
    if (viewMode === 'weekly') {
      const start = getWeekStart(referenceDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${formatShortDate(toDateKey(start))} - ${formatShortDate(toDateKey(end))}`;
    }
    if (viewMode === 'monthly') {
      return referenceDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }
    return referenceDate.toLocaleDateString('tr-TR', { year: 'numeric' });
  }, [referenceDate, viewMode]);

  const visibleEvents = useMemo(() => {
    if (!events.length) return [];

    return events.filter((event) => {
      if (event?.calendarHidden) return false;
      if (!event?.date) return false;
      const eventDateKey = getEventDateKey(event.date);
      if (!eventDateKey) return false;

      if (viewMode === 'daily') {
        return eventDateKey === toDateKey(referenceDate);
      }

      if (viewMode === 'weekly') {
        const start = getWeekStart(referenceDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const startKey = toDateKey(start);
        const endKey = toDateKey(end);
        return eventDateKey >= startKey && eventDateKey <= endKey;
      }

      if (viewMode === 'monthly') {
        const monthKey = String(referenceDate.getMonth() + 1).padStart(2, '0');
        const yearKey = String(referenceDate.getFullYear());
        return eventDateKey.startsWith(`${yearKey}-${monthKey}-`);
      }

      return eventDateKey.startsWith(`${String(referenceDate.getFullYear())}-`);
    });
  }, [events, referenceDate, viewMode]);

  const groupedEvents = useMemo(() => {
    const groups = {};
    for (const event of visibleEvents) {
      const key = getEventDateKey(event.date);
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map((key) => ({
      date: key,
      items: groups[key].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    }));
  }, [visibleEvents]);

  const weeklyOverview = useMemo(() => {
    if (viewMode !== 'weekly') return [];

    const start = getWeekStart(referenceDate);
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = toDateKey(date);
      const items = visibleEvents.filter((event) => getEventDateKey(event.date) === dateKey);
      return { dateKey, items, label: WEEKDAY_LABELS[index] };
    });
  }, [referenceDate, viewMode, visibleEvents]);

  const monthlyOverview = useMemo(() => {
    if (viewMode !== 'monthly') return { cells: [] };

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const monthStartIndex = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];

    for (let i = 0; i < monthStartIndex; i += 1) {
      cells.push({ key: `empty-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toDateKey(new Date(year, month, day));
      const items = visibleEvents.filter((event) => getEventDateKey(event.date) === dateKey);
      cells.push({ key: dateKey, day, dateKey, items, empty: false });
    }

    return { cells };
  }, [referenceDate, viewMode, visibleEvents]);

  const yearlyOverview = useMemo(() => {
    if (viewMode !== 'yearly') return [];

    const year = referenceDate.getFullYear();
    return Array.from({ length: 12 }).map((_, monthIndex) => {
      const monthEvents = visibleEvents.filter((event) => {
        const d = parseDateKeyLocal(getEventDateKey(event.date));
        return d.getFullYear() === year && d.getMonth() === monthIndex;
      });

      const collected = monthEvents.filter((event) => event.paymentStatus === 'collected').length;
      const pending = monthEvents.length - collected;

      return {
        monthIndex,
        label: MONTH_LABELS[monthIndex],
        count: monthEvents.length,
        collected,
        pending
      };
    });
  }, [referenceDate, viewMode, visibleEvents]);

  const weeklyTimeline = useMemo(() => {
    if (viewMode !== 'weekly') return [];

    const defaultEndMinutes = DEFAULT_WEEKLY_END_HOUR * 60;
    const maxEndMinutes = visibleEvents.reduce((maxMinutes, event) => {
      const startMinutes = parseTimeToMinutes(event?.time);
      if (startMinutes === null) return maxMinutes;

      const duration = Math.max(15, parseInt(event?.duration || 60, 10) || 60);
      return Math.max(maxMinutes, startMinutes + duration);
    }, defaultEndMinutes);

    const endHour = Math.max(DEFAULT_WEEKLY_END_HOUR, Math.ceil(maxEndMinutes / 60));
    const hourCount = Math.max(1, endHour - WEEKLY_START_HOUR);
    const hourLabels = Array.from({ length: hourCount + 1 }).map((_, index) => {
      const hour = WEEKLY_START_HOUR + index;
      return `${String(hour).padStart(2, '0')}:00`;
    });

    return {
      startMinutes: WEEKLY_START_HOUR * 60,
      endMinutes: endHour * 60,
      hourLabels,
      totalHeight: hourCount * WEEKLY_PIXELS_PER_HOUR
    };
  }, [viewMode, visibleEvents]);

  const getWeeklyEventStyle = (event) => {
    const startMinutes = parseTimeToMinutes(event?.time);
    if (startMinutes === null || !weeklyTimeline?.hourLabels?.length) {
      return null;
    }

    const duration = Math.max(15, parseInt(event?.duration || 60, 10) || 60);
    const originalEnd = startMinutes + duration;

    const boundedStart = Math.max(startMinutes, weeklyTimeline.startMinutes);
    const boundedEnd = Math.min(originalEnd, weeklyTimeline.endMinutes);

    if (boundedStart >= weeklyTimeline.endMinutes || boundedEnd <= weeklyTimeline.startMinutes) {
      return null;
    }

    const top = ((boundedStart - weeklyTimeline.startMinutes) / 60) * WEEKLY_PIXELS_PER_HOUR;
    const height = Math.max(24, ((boundedEnd - boundedStart) / 60) * WEEKLY_PIXELS_PER_HOUR);

    return {
      top,
      height
    };
  };

  const movePeriod = (direction) => {
    const next = new Date(referenceDate);

    if (viewMode === 'daily') next.setDate(next.getDate() + direction);
    else if (viewMode === 'weekly') next.setDate(next.getDate() + (7 * direction));
    else if (viewMode === 'monthly') next.setMonth(next.getMonth() + direction);
    else next.setFullYear(next.getFullYear() + direction);

    setReferenceDate(next);
  };

  const studentColorMap = useMemo(() => {
    const map = {};
    students.forEach((student, index) => {
      map[student.id] = STUDENT_COLORS[index % STUDENT_COLORS.length];
    });
    return map;
  }, [students]);

  const getStudentColor = (studentId) => {
    return studentColorMap[studentId] || STUDENT_COLORS[0];
  };

  const handleStudentSelectForAdd = (studentId) => {
    const target = students.find((student) => student.id === studentId);
    const defaultAmount = parseFloat(target?.fee) || parseFloat(target?.initialFee) || 0;

    setAddForm((prev) => ({
      ...prev,
      studentId,
      amount: defaultAmount > 0 ? String(defaultAmount) : prev.amount
    }));
  };

  const buildRecurringDates = () => {
    const start = new Date(addForm.date);
    start.setHours(0, 0, 0, 0);

    if (addForm.addMode === 'single') {
      return [toDateKey(start)];
    }

    const dates = [];
    const intervalWeeks = Math.max(1, parseInt(addForm.repeatEveryWeeks || '1', 10));
    const selectedDays = [...(addForm.recurrenceDays || [])];
    if (selectedDays.length === 0) {
      selectedDays.push(getMondayIndexFromDate(addForm.date));
    }
    selectedDays.sort((a, b) => a - b);

    const startWeek = getWeekStart(start);

    if (addForm.addMode === 'untilDate') {
      const end = new Date(addForm.untilDate || addForm.date);
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

    const count = Math.max(1, parseInt(addForm.count || '1', 10));
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

  const getActiveRecurrenceDays = () => {
    if (Array.isArray(addForm.recurrenceDays) && addForm.recurrenceDays.length > 0) {
      return [...addForm.recurrenceDays].sort((a, b) => a - b);
    }
    return [getMondayIndexFromDate(addForm.date)];
  };

  const toggleRecurrenceDay = (dayIndex) => {
    const activeDays = getActiveRecurrenceDays();
    const exists = activeDays.includes(dayIndex);

    if (exists && activeDays.length === 1) {
      return;
    }

    const nextDays = exists
      ? activeDays.filter((day) => day !== dayIndex)
      : [...activeDays, dayIndex].sort((a, b) => a - b);

    setAddForm((prev) => ({
      ...prev,
      recurrenceDays: nextDays
    }));
  };

  const handleAddLessons = async () => {
    if (!addForm.studentId || !addForm.date || !addForm.time) {
      alert('Lütfen öğrenci, tarih ve saat bilgilerini doldurun.');
      return;
    }

    const amount = parseFloat(addForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Lütfen geçerli bir ders ücreti girin.');
      return;
    }

    if (addForm.addMode === 'untilDate' && addForm.untilDate < addForm.date) {
      alert('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    const [student, allStudents] = await Promise.all([
      getStudentById(addForm.studentId),
      getStudents()
    ]);
    if (!student) {
      alert('Öğrenci bulunamadı.');
      return;
    }

    const schedule = Array.isArray(student.schedule) ? [...student.schedule] : [];
    const otherStudentsLessons = (allStudents || [])
      .filter((entry) => entry.id !== student.id)
      .flatMap((entry) => (entry.schedule || []).map((lesson) => ({
        date: lesson.date,
        time: lesson.time,
        duration: lesson.duration || entry.lessonDuration || 60
      })));

    const dates = buildRecurringDates();

    let nextWeek = schedule.reduce((max, lesson) => Math.max(max, lesson.week || 0), 0) + 1;
    let addedCount = 0;
    let conflictCount = 0;

    for (const date of dates) {
      const candidateLesson = {
        date,
        time: addForm.time,
        duration: parseInt(addForm.duration || '60', 10)
      };

      const hasConflictInStudent = schedule.some((lesson) => hasTimeRangeOverlap(candidateLesson, lesson));
      const hasConflictGlobal = otherStudentsLessons.some((lesson) => hasTimeRangeOverlap(candidateLesson, lesson));

      if (hasConflictInStudent || hasConflictGlobal) {
        conflictCount += 1;
        continue;
      }

      schedule.push({
        week: nextWeek,
        date,
        time: addForm.time,
        duration: parseInt(addForm.duration || '60', 10),
        completed: false,
        topic: null,
        paymentAmount: amount,
        paymentStatus: 'pending',
        paymentCollectedAt: null,
        paymentDueDate: date
      });

      nextWeek += 1;
      addedCount += 1;
    }

    if (addedCount === 0) {
      alert('Eklenecek yeni ders bulunamadı. Seçili saat aralığı mevcut derslerle çakışıyor olabilir.');
      return;
    }

    await updateStudent({
      ...student,
      fee: String(amount),
      schedule,
      updatedAt: new Date().toISOString()
    });

    await loadData();
    if (conflictCount > 0) {
      alert(`${addedCount} ders eklendi. ${conflictCount} ders çakışma nedeniyle eklenmedi.`);
    } else {
      alert(`${addedCount} ders eklendi.`);
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

  const handleDeleteOption = async (event, mode) => {
    const student = await getStudentById(event.studentId);
    if (!student || !Array.isArray(student.schedule)) {
      alert('Öğrenci dersleri bulunamadı.');
      return;
    }

    const targetIndex = student.schedule.findIndex((lesson) => {
      const weekMatch = event.week && lesson.week === event.week;
      const dateTimeMatch = lesson.date === event.date && lesson.time === event.time;
      return weekMatch || dateTimeMatch;
    });

    const { nextSchedule, removedCount, hiddenCount } = removeFromSchedule(student.schedule, targetIndex, mode);

    if (removedCount === 0 && hiddenCount === 0) {
      alert('İşlem yapılacak ders bulunamadı.');
      return;
    }

    await updateStudent({
      ...student,
      schedule: nextSchedule,
      updatedAt: new Date().toISOString()
    });

    await loadData();
    alert(`${removedCount} gelecek ders silindi, ${hiddenCount} ders takvimden gizlendi.`);
  };

  const renderAddLessonCard = () => (
    <div className="card mb-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary-600" />
        Ders Ekle
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Öğrenci</label>
          <select
            value={addForm.studentId}
            onChange={(e) => handleStudentSelectForAdd(e.target.value)}
            className="input-field"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.fullName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ders Ekleme Tipi</label>
          <select
            value={addForm.addMode}
            onChange={(e) => setAddForm({ ...addForm, addMode: e.target.value })}
            className="input-field"
          >
            <option value="single">Bir ders ekle</option>
            <option value="untilDate">Şu tarihe kadar ekle</option>
            <option value="count">Şu kadar sayıda ekle</option>
          </select>
        </div>

        {addForm.addMode !== 'single' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tekrar Aralığı (Hafta)</label>
            <input
              type="number"
              min="1"
              value={addForm.repeatEveryWeeks}
              onChange={(e) => setAddForm({ ...addForm, repeatEveryWeeks: e.target.value })}
              className="input-field"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Başlangıç Tarihi</label>
          <input
            type="date"
            value={addForm.date}
            onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Saat</label>
          <input
            type="time"
            value={addForm.time}
            onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Süre (dk)</label>
          <input
            type="number"
            min="15"
            value={addForm.duration}
            onChange={(e) => setAddForm({ ...addForm, duration: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ders Ücreti (TL)</label>
          <input
            type="number"
            min="1"
            value={addForm.amount}
            onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
            className="input-field"
          />
        </div>

        {addForm.addMode !== 'single' && (
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Haftanın Günleri</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, dayIndex) => {
                const isActive = getActiveRecurrenceDays().includes(dayIndex);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleRecurrenceDay(dayIndex)}
                    className={'px-2.5 py-1 rounded-full text-xs font-medium border ' + (isActive ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Aynı saatte haftada birden fazla gün için birden çok gün seçebilirsin.</p>
          </div>
        )}

        {addForm.addMode === 'untilDate' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bitiş Tarihi</label>
            <input
              type="date"
              value={addForm.untilDate}
              onChange={(e) => setAddForm({ ...addForm, untilDate: e.target.value })}
              className="input-field"
            />
          </div>
        )}

        {addForm.addMode === 'count' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ders Sayısı</label>
            <input
              type="number"
              min="1"
              value={addForm.count}
              onChange={(e) => setAddForm({ ...addForm, count: e.target.value })}
              className="input-field"
            />
          </div>
        )}
      </div>

      <button onClick={handleAddLessons} className="btn-primary mt-4 w-full py-2.5">
        Dersi Kaydet
      </button>
    </div>
  );

  return (
    <div className="page-container pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="section-title flex items-center gap-2 mb-0">
          <CalendarDays className="w-6 h-6 text-primary-600" />
          Takvim
        </h1>
      </div>

      <div className="card mb-4">
        <div className="flex gap-2 mb-3 overflow-x-auto hide-scrollbar">
          {[
            { id: 'daily', label: 'Günlük' },
            { id: 'weekly', label: 'Haftalık' },
            { id: 'monthly', label: 'Aylık' },
            { id: 'yearly', label: 'Yıllık' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ' + (viewMode === mode.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => movePeriod(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500">Seçili Periyot</p>
            <p className="font-semibold text-gray-900">{periodLabel}</p>
          </div>

          <button onClick={() => movePeriod(1)} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'weekly' && (
        <div className="card mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Haftalık Görünüm</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[1060px] border border-gray-200 rounded-xl">
              <div className="grid grid-cols-[72px_repeat(7,minmax(130px,1fr))] bg-gray-50 border-b border-gray-200">
                <div className="p-2 text-[11px] text-gray-500 font-medium">Saat</div>
                {weeklyOverview.map((day) => (
                  <button
                    key={`header-${day.dateKey}`}
                    onClick={() => {
                      setReferenceDate(parseDateKeyLocal(day.dateKey));
                      setViewMode('daily');
                    }}
                    className="p-2 text-left hover:bg-gray-100"
                  >
                    <p className="text-xs text-primary-700 font-semibold">{day.label}</p>
                    <p className="text-[11px] text-gray-500">{formatShortDate(day.dateKey)}</p>
                    <p className="text-[11px] text-gray-700 mt-0.5">{day.items.length} ders</p>
                  </button>
                ))}
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                <div className="grid grid-cols-[72px_repeat(7,minmax(130px,1fr))]">
                  <div className="relative border-r border-gray-200 bg-white" style={{ height: `${weeklyTimeline.totalHeight}px` }}>
                    {weeklyTimeline.hourLabels.map((hourLabel, index) => {
                      const top = index * WEEKLY_PIXELS_PER_HOUR;
                      return (
                        <div
                          key={`scale-${hourLabel}`}
                          className="absolute left-0 right-0 text-[11px] text-gray-500 pl-2"
                          style={{ top: `${top - 8}px` }}
                        >
                          {hourLabel}
                        </div>
                      );
                    })}
                  </div>

                  {weeklyOverview.map((day) => (
                    <div
                      key={`timeline-${day.dateKey}`}
                      className="relative border-r border-gray-100 bg-white"
                      style={{ height: `${weeklyTimeline.totalHeight}px` }}
                    >
                      {weeklyTimeline.hourLabels.slice(0, -1).map((hourLabel, index) => (
                        <div
                          key={`line-${day.dateKey}-${hourLabel}`}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: `${index * WEEKLY_PIXELS_PER_HOUR}px` }}
                        />
                      ))}

                      {day.items
                        .slice()
                        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                        .map((item) => {
                          const eventStyle = getWeeklyEventStyle(item);
                          if (!eventStyle) return null;

                          return (
                            <button
                              key={item.id}
                              onClick={() => navigate(`/students/${item.studentId}?tab=schedule&lessonDate=${encodeURIComponent(getEventDateKey(item.date))}&lessonTime=${encodeURIComponent(item.time || '')}`)}
                              className="absolute left-1 right-1 text-left text-[11px] rounded-md px-1.5 py-1 border overflow-hidden"
                              style={{
                                top: `${eventStyle.top + 1}px`,
                                height: `${eventStyle.height - 2}px`,
                                backgroundColor: `${getStudentColor(item.studentId)}22`,
                                borderColor: `${getStudentColor(item.studentId)}66`,
                                color: '#1f2937'
                              }}
                              title={`${item.studentName} • ${item.time}`}
                            >
                              <p className="truncate font-medium">{getTimeRangeLabel(item.time, item.duration)}</p>
                              <p className="truncate text-[10px]">{item.studentName}</p>
                              <p className="text-[10px] opacity-80 mt-0.5">{item.paymentStatus === 'collected' ? 'Tahsil' : 'Bekliyor'}</p>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Kartlar başlangıç saatine göre yerleşir, yükseklik ders süresini yansıtır. Gün başlığına tıklayınca günlük detay açılır.</p>
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="card mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Aylık Görünüm</h3>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] text-gray-500 font-medium py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthlyOverview.cells.map((cell) => (
              cell.empty ? (
                <div key={cell.key} className="h-16" />
              ) : (
                <button
                  key={cell.key}
                  onClick={() => {
                    setReferenceDate(parseDateKeyLocal(cell.dateKey));
                    setViewMode('daily');
                  }}
                  className="h-16 border border-gray-200 rounded-lg p-1 text-left hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-medium text-gray-900">{cell.day}</p>
                    <p className="text-[10px] text-primary-700">{cell.items.length}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cell.items.map((item, index) => (
                      <span
                        key={`${cell.key}-${item.id || index}`}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getStudentColor(item.studentId) }}
                        title={item.studentName || 'Öğrenci'}
                      />
                    ))}
                  </div>
                </button>
              )
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Güne tıklayınca günlük detay açılır.</p>
        </div>
      )}

      {viewMode === 'yearly' && (
        <div className="card mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Yıllık Görünüm</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {yearlyOverview.map((month) => (
              <button
                key={month.label}
                onClick={() => {
                  setReferenceDate(new Date(referenceDate.getFullYear(), month.monthIndex, 1));
                  setViewMode('monthly');
                }}
                className="border border-gray-200 rounded-xl p-3 text-left hover:bg-gray-50"
              >
                <p className="font-medium text-gray-900">{month.label}</p>
                <p className="text-sm text-primary-700 mt-1">Toplam: {month.count} ders</p>
                <p className="text-xs text-emerald-700">Tahsil: {month.collected}</p>
                <p className="text-xs text-amber-700">Bekleyen: {month.pending}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Aya tıklayınca aylık detay açılır.</p>
        </div>
      )}

      {groupedEvents.length === 0 ? (
        <div className="card text-center text-gray-500">Bu periyot için ders bulunmuyor.</div>
      ) : (
        <div className="space-y-3">
          {groupedEvents.map((group) => (
            <div key={group.date} className="card">
              <p className="text-xs font-semibold text-primary-700 mb-2">{formatShortDate(group.date)} {getDayName(group.date)}</p>

              <div className="space-y-2">
                {group.items.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-xl p-3">
                    <button
                      onClick={() => navigate(`/students/${event.studentId}?tab=schedule&lessonDate=${encodeURIComponent(getEventDateKey(event.date))}&lessonTime=${encodeURIComponent(event.time || '')}`)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900">{event.studentName || 'Öğrenci'}</p>
                        <span className={'text-xs px-2 py-0.5 rounded-full ' + (event.paymentStatus === 'collected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                          {event.paymentStatus === 'collected' ? 'Tahsil Edildi' : 'Beklemede'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{getTimeRangeLabel(event.time, event.duration)} • {event.duration || 60} dk</p>
                      <p className="text-xs text-gray-500 mt-1">{(parseFloat(event.paymentAmount) || 0).toLocaleString('tr-TR')} TL</p>
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                      <button
                        onClick={() => handleDeleteOption(event, 'single')}
                        className="text-xs text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg"
                      >
                        Bu dersi sil
                      </button>
                      <button
                        onClick={() => handleDeleteOption(event, 'fromHere')}
                        className="text-xs text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg"
                      >
                        Bu ve sonrakileri sil
                      </button>
                      <button
                        onClick={() => handleDeleteOption(event, 'all')}
                        className="text-xs text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg"
                      >
                        Tüm dersleri sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {renderAddLessonCard()}
    </div>
  );
};

export default CalendarPage;
