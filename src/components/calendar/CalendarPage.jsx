/*
 * File: src/components/calendar/CalendarPage.jsx
 * Description: Ders etkinliklerini günlük/haftalık/aylık/yıllık görünümde yönetir; ders ekleme/silme CRUD akışlarını içerir.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../../hooks/useDatabase';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatShortDate, getDayName, getStudentColorHex, hexToRgba } from '../../utils/helpers';
import {
  getWeekStart,
  getMondayIndexFromDate,
  parseTimeToMinutes,
  hasTimeRangeOverlap,
  getTimeRangeLabel,
  buildRecurringDateKeys,
  createLessonPayload,
  normalizeDuration
} from '../../utils/lessonSchedule';
import { useFeedback } from '../../context/FeedbackContext';

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_LABELS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DEFAULT_WEEKLY_START_HOUR = 9;
const DEFAULT_WEEKLY_END_HOUR = 22;
const WEEKLY_PIXELS_PER_HOUR = 56;
const DRAG_SNAP_MINUTES = 15;
const CALENDAR_VIEW_KEY = 'mathup.calendar.viewMode';

const getInitialViewMode = () => {
  return 'weekly';
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
  const lessonDateKey = getEventDateKey(lesson?.date);
  const time = lesson?.time || '00:00';
  return new Date(`${lessonDateKey}T${time}`);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatMinutesToTime = (minutes) => {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const { getLessonEvents, getStudents, getStudentById, updateStudent, isReady } = useDatabase();
  const { notify } = useFeedback();

  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [draggedLesson, setDraggedLesson] = useState(null);
  const [isMoveScopeDialogOpen, setIsMoveScopeDialogOpen] = useState(false);
  const [moveScopeChoice, setMoveScopeChoice] = useState('single');
  const moveScopeResolverRef = useRef(null);
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
      return getDayName(key);
    }
    if (viewMode === 'weekly') {
      const start = getWeekStart(referenceDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startMonthLabel = start.toLocaleDateString('tr-TR', { month: 'long' });
      const endMonthLabel = end.toLocaleDateString('tr-TR', { month: 'long' });
      if (startMonthLabel === endMonthLabel) {
        return startMonthLabel;
      }
      return `${startMonthLabel} - ${endMonthLabel}`;
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

    const minStartMinutes = visibleEvents.reduce((minMinutes, event) => {
      const startMinutes = parseTimeToMinutes(event?.time);
      if (startMinutes === null) return minMinutes;
      return Math.min(minMinutes, startMinutes);
    }, Number.POSITIVE_INFINITY);

    const startHour = minStartMinutes === Number.POSITIVE_INFINITY
      ? DEFAULT_WEEKLY_START_HOUR
      : Math.max(0, Math.floor(minStartMinutes / 60) - 1);

    const defaultEndMinutes = DEFAULT_WEEKLY_END_HOUR * 60;
    const maxEndMinutes = visibleEvents.reduce((maxMinutes, event) => {
      const startMinutes = parseTimeToMinutes(event?.time);
      if (startMinutes === null) return maxMinutes;

      const duration = Math.max(15, parseInt(event?.duration || 60, 10) || 60);
      return Math.max(maxMinutes, startMinutes + duration);
    }, defaultEndMinutes);

    const endHour = Math.max(DEFAULT_WEEKLY_END_HOUR, Math.ceil(maxEndMinutes / 60));
    const hourCount = Math.max(1, endHour - startHour);
    const hourLabels = Array.from({ length: hourCount + 1 }).map((_, index) => {
      const hour = startHour + index;
      return `${String(hour).padStart(2, '0')}:00`;
    });

    return {
      startMinutes: startHour * 60,
      endMinutes: endHour * 60,
      hourLabels,
      totalHeight: hourCount * WEEKLY_PIXELS_PER_HOUR
    };
  }, [viewMode, visibleEvents]);

  const dailyTimeline = useMemo(() => {
    if (viewMode !== 'daily') return null;

    const minStartMinutes = visibleEvents.reduce((minMinutes, event) => {
      const startMinutes = parseTimeToMinutes(event?.time);
      if (startMinutes === null) return minMinutes;
      return Math.min(minMinutes, startMinutes);
    }, Number.POSITIVE_INFINITY);

    const startHour = minStartMinutes === Number.POSITIVE_INFINITY
      ? DEFAULT_WEEKLY_START_HOUR
      : Math.max(0, Math.floor(minStartMinutes / 60) - 1);

    const defaultEndMinutes = DEFAULT_WEEKLY_END_HOUR * 60;
    const maxEndMinutes = visibleEvents.reduce((maxMinutes, event) => {
      const startMinutes = parseTimeToMinutes(event?.time);
      if (startMinutes === null) return maxMinutes;

      const duration = Math.max(15, parseInt(event?.duration || 60, 10) || 60);
      return Math.max(maxMinutes, startMinutes + duration);
    }, defaultEndMinutes);

    const endHour = Math.max(DEFAULT_WEEKLY_END_HOUR, Math.ceil(maxEndMinutes / 60));
    const hourCount = Math.max(1, endHour - startHour);
    const hourLabels = Array.from({ length: hourCount + 1 }).map((_, index) => {
      const hour = startHour + index;
      return `${String(hour).padStart(2, '0')}:00`;
    });

    return {
      startMinutes: startHour * 60,
      endMinutes: endHour * 60,
      hourLabels,
      totalHeight: hourCount * WEEKLY_PIXELS_PER_HOUR
    };
  }, [viewMode, visibleEvents]);

  const getEventStyleForTimeline = (event, timeline) => {
    const startMinutes = parseTimeToMinutes(event?.time);
    if (startMinutes === null || !timeline?.hourLabels?.length) {
      return null;
    }

    const duration = Math.max(15, parseInt(event?.duration || 60, 10) || 60);
    const originalEnd = startMinutes + duration;

    const boundedStart = Math.max(startMinutes, timeline.startMinutes);
    const boundedEnd = Math.min(originalEnd, timeline.endMinutes);

    if (boundedStart >= timeline.endMinutes || boundedEnd <= timeline.startMinutes) {
      return null;
    }

    const top = ((boundedStart - timeline.startMinutes) / 60) * WEEKLY_PIXELS_PER_HOUR;
    const height = Math.max(24, ((boundedEnd - boundedStart) / 60) * WEEKLY_PIXELS_PER_HOUR);

    return {
      top,
      height
    };
  };

  const getWeeklyEventStyle = (event) => getEventStyleForTimeline(event, weeklyTimeline);
  const getDailyEventStyle = (event) => getEventStyleForTimeline(event, dailyTimeline);

  const askMoveScope = () => {
    setMoveScopeChoice('single');
    setIsMoveScopeDialogOpen(true);

    return new Promise((resolve) => {
      moveScopeResolverRef.current = resolve;
    });
  };

  const closeMoveScopeDialog = (value) => {
    setIsMoveScopeDialogOpen(false);
    const resolver = moveScopeResolverRef.current;
    moveScopeResolverRef.current = null;
    if (resolver) resolver(value);
  };

  const getDropTime = (clientY, timeline, containerRect) => {
    if (!timeline?.hourLabels?.length || !containerRect) return null;

    const relativeY = clamp(clientY - containerRect.top, 0, containerRect.height);
    const minuteOffset = (relativeY / WEEKLY_PIXELS_PER_HOUR) * 60;
    const rawMinutes = timeline.startMinutes + minuteOffset;
    const snappedMinutes = Math.round(rawMinutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    const maxMinutes = Math.max(0, timeline.endMinutes - DRAG_SNAP_MINUTES);
    return formatMinutesToTime(clamp(snappedMinutes, 0, maxMinutes));
  };

  const handleMoveLesson = async (sourceEvent, nextDateKey, nextTime) => {
    if (!sourceEvent?.studentId || !nextDateKey || !nextTime) return;

    const currentDateKey = getEventDateKey(sourceEvent.date);
    const currentTime = sourceEvent.time || '00:00';
    if (currentDateKey === nextDateKey && currentTime === nextTime) {
      return;
    }

    const scope = await askMoveScope();
    if (!scope) return;

    const [student, allStudents] = await Promise.all([
      getStudentById(sourceEvent.studentId),
      getStudents()
    ]);

    if (!student || !Array.isArray(student.schedule)) {
      notify('Öğrenci ders programı bulunamadı.', 'error');
      return;
    }

    const schedule = [...student.schedule];
    const targetIndex = schedule.findIndex((lesson) => {
      const weekMatch = sourceEvent.week && lesson.week === sourceEvent.week;
      const dateMatch = getEventDateKey(lesson.date) === currentDateKey;
      const timeMatch = (lesson.time || '') === currentTime;
      const durationMatch = normalizeDuration(lesson.duration, 60) === normalizeDuration(sourceEvent.duration, 60);
      return weekMatch || (dateMatch && timeMatch && durationMatch);
    });

    if (targetIndex < 0) {
      notify('Taşınacak ders bulunamadı.', 'error');
      return;
    }

    const targetDateTime = createDateFromLesson(schedule[targetIndex]);
    const nextTargetDateTime = new Date(`${nextDateKey}T${nextTime}`);
    const deltaMinutes = Math.round((nextTargetDateTime.getTime() - targetDateTime.getTime()) / 60000);

    const indexesToMove = schedule
      .map((lesson, index) => ({ lesson, index }))
      .filter(({ lesson, index }) => {
        if (scope === 'single') return index === targetIndex;
        return createDateFromLesson(lesson) >= targetDateTime;
      })
      .map(({ index }) => index);

    if (indexesToMove.length === 0) {
      notify('Güncellenecek ders bulunamadı.', 'warning');
      return;
    }

    const movedIndexSet = new Set(indexesToMove);
    const movedSchedule = schedule.map((lesson, index) => {
      if (!movedIndexSet.has(index)) return lesson;

      const lessonDateTime = createDateFromLesson(lesson);
      const updatedDateTime = scope === 'single'
        ? nextTargetDateTime
        : new Date(lessonDateTime.getTime() + (deltaMinutes * 60000));

      const nextLessonDate = toDateKey(updatedDateTime);
      const nextLessonTime = formatMinutesToTime((updatedDateTime.getHours() * 60) + updatedDateTime.getMinutes());

      return {
        ...lesson,
        date: nextLessonDate,
        time: nextLessonTime,
        paymentDueDate: lesson.paymentDueDate === lesson.date ? nextLessonDate : lesson.paymentDueDate
      };
    });

    const ownCollisions = movedSchedule.some((lesson, index) => {
      return movedSchedule.some((otherLesson, otherIndex) => {
        if (index >= otherIndex) return false;
        return hasTimeRangeOverlap(lesson, otherLesson);
      });
    });

    if (ownCollisions) {
      notify('Taşıma sonrası aynı öğrencinin dersleri çakışıyor.', 'warning');
      return;
    }

    const otherStudentsLessons = (allStudents || [])
      .filter((entry) => entry.id !== student.id)
      .flatMap((entry) => (entry.schedule || []).map((lesson) => ({
        date: lesson.date,
        time: lesson.time,
        duration: lesson.duration || entry.lessonDuration || 60
      })));

    const hasGlobalConflict = movedSchedule.some((lesson) => {
      return otherStudentsLessons.some((otherLesson) => hasTimeRangeOverlap(lesson, otherLesson));
    });

    if (hasGlobalConflict) {
      notify('Taşıma işlemi diğer öğrencilerin dersleriyle çakışıyor.', 'warning');
      return;
    }

    await updateStudent({
      ...student,
      schedule: movedSchedule,
      updatedAt: new Date().toISOString()
    });

    await loadData();
    notify(
      scope === 'single'
        ? 'Ders yeni zamana taşındı.'
        : `${indexesToMove.length} ders yeni takvime kaydırıldı.`,
      'success'
    );
  };

  const handleTimelineDrop = async (dropEvent, targetDateKey, timeline) => {
    dropEvent.preventDefault();
    if (!draggedLesson) return;

    const dropTime = getDropTime(dropEvent.clientY, timeline, dropEvent.currentTarget.getBoundingClientRect());
    if (!dropTime) {
      setDraggedLesson(null);
      return;
    }

    await handleMoveLesson(draggedLesson, targetDateKey, dropTime);
    setDraggedLesson(null);
  };

  const handleLessonDragStart = (dragEvent, lesson) => {
    dragEvent.dataTransfer.effectAllowed = 'move';
    setDraggedLesson(lesson);
  };

  const handleLessonDragEnd = () => {
    setDraggedLesson(null);
  };

  const movePeriod = (direction) => {
    const next = new Date(referenceDate);

    if (viewMode === 'daily') next.setDate(next.getDate() + direction);
    else if (viewMode === 'weekly') next.setDate(next.getDate() + (7 * direction));
    else if (viewMode === 'monthly') next.setMonth(next.getMonth() + direction);
    else next.setFullYear(next.getFullYear() + direction);

    setReferenceDate(next);
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();

    if (viewMode === 'daily') {
      return toDateKey(referenceDate) === toDateKey(now);
    }

    if (viewMode === 'weekly') {
      return toDateKey(getWeekStart(referenceDate)) === toDateKey(getWeekStart(now));
    }

    if (viewMode === 'monthly') {
      return referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() === now.getMonth();
    }

    return true;
  }, [referenceDate, viewMode]);

  const quickReturnLabel = useMemo(() => {
    if (viewMode === 'daily') return 'Bugün';
    if (viewMode === 'weekly') return 'Bu hafta';
    if (viewMode === 'monthly') return 'Bu ay';
    return '';
  }, [viewMode]);

  const todayKey = toDateKey(new Date());
  const isPastDateKey = (dateKey) => dateKey < todayKey;

  const studentColorMap = useMemo(() => {
    const map = {};
    students.forEach((student) => {
      map[student.id] = getStudentColorHex(student, student.id);
    });
    return map;
  }, [students]);

  const getStudentColor = (studentId) => {
    return studentColorMap[studentId] || getStudentColorHex(null, studentId);
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
    return buildRecurringDateKeys({
      startDate: addForm.date,
      addMode: addForm.addMode,
      repeatEveryWeeks: addForm.repeatEveryWeeks,
      recurrenceDays: addForm.recurrenceDays,
      untilDate: addForm.untilDate,
      count: addForm.count
    });
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
      notify('Lütfen öğrenci, tarih ve saat bilgilerini doldurun.', 'warning');
      return;
    }

    const amount = parseFloat(addForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      notify('Lütfen geçerli bir ders ücreti girin.', 'warning');
      return;
    }

    if (addForm.addMode === 'untilDate' && addForm.untilDate < addForm.date) {
      notify('Bitiş tarihi başlangıç tarihinden önce olamaz.', 'warning');
      return;
    }

    const [student, allStudents] = await Promise.all([
      getStudentById(addForm.studentId),
      getStudents()
    ]);
    if (!student) {
      notify('Öğrenci bulunamadı.', 'error');
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
        duration: normalizeDuration(addForm.duration, 60)
      };

      const hasConflictInStudent = schedule.some((lesson) => hasTimeRangeOverlap(candidateLesson, lesson));
      const hasConflictGlobal = otherStudentsLessons.some((lesson) => hasTimeRangeOverlap(candidateLesson, lesson));

      if (hasConflictInStudent || hasConflictGlobal) {
        conflictCount += 1;
        continue;
      }

      schedule.push({
        week: nextWeek,
        ...createLessonPayload({
          date,
          time: addForm.time,
          duration: addForm.duration,
          amount,
          paymentStatus: 'pending',
          topic: null,
          description: null,
          completed: false,
          paymentCollectedAt: null,
          paymentDueDate: date,
          calendarHidden: false
        })
      });

      nextWeek += 1;
      addedCount += 1;
    }

    if (addedCount === 0) {
      notify('Eklenecek yeni ders bulunamadı. Seçili saat aralığı mevcut derslerle çakışıyor olabilir.', 'warning');
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
      notify(`${addedCount} ders eklendi. ${conflictCount} ders çakışma nedeniyle eklenmedi.`, 'success');
    } else {
      notify(`${addedCount} ders eklendi.`, 'success');
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
    const confirmMessages = {
      single: 'Bu dersi silmek istediğinize emin misiniz?',
      fromHere: 'Bu dersi ve sonraki dersleri silmek istediğinize emin misiniz?',
      all: 'Bu öğrenciye ait takvimdeki tüm dersleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'
    };

    const shouldProceed = window.confirm(confirmMessages[mode] || 'Bu işlemi yapmak istediğinize emin misiniz?');
    if (!shouldProceed) {
      return;
    }

    const student = await getStudentById(event.studentId);
    if (!student || !Array.isArray(student.schedule)) {
      notify('Öğrenci dersleri bulunamadı.', 'error');
      return;
    }

    const targetIndex = student.schedule.findIndex((lesson) => {
      const weekMatch = event.week && lesson.week === event.week;
      const dateTimeMatch = lesson.date === event.date && lesson.time === event.time;
      return weekMatch || dateTimeMatch;
    });

    const { nextSchedule, removedCount, hiddenCount } = removeFromSchedule(student.schedule, targetIndex, mode);

    if (removedCount === 0 && hiddenCount === 0) {
      notify('İşlem yapılacak ders bulunamadı.', 'warning');
      return;
    }

    await updateStudent({
      ...student,
      schedule: nextSchedule,
      updatedAt: new Date().toISOString()
    });

    await loadData();
    notify(`${removedCount} gelecek ders silindi, ${hiddenCount} ders takvimden gizlendi.`, 'success');
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {[
              { id: 'daily', label: 'G' },
              { id: 'weekly', label: 'H' },
              { id: 'monthly', label: 'A' },
              { id: 'yearly', label: 'Y' }
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

          <div className="flex items-center gap-2">
            {quickReturnLabel && !isCurrentPeriod && (
              <button
                onClick={() => setReferenceDate(new Date())}
                className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                {quickReturnLabel}
              </button>
            )}

            <button onClick={() => movePeriod(-1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Önceki periyot">
              <ChevronLeft className="w-5 h-5" />
            </button>

            <p className="font-semibold text-gray-900 min-w-[120px] sm:min-w-[170px] text-center text-sm sm:text-base">{periodLabel}</p>

            <button onClick={() => movePeriod(1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Sonraki periyot">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'weekly' && (
        <div className="card mb-4">
          <div className="overflow-x-auto">
            <div className="min-w-[1060px] border border-gray-200 rounded-xl">
              <div className="grid grid-cols-[72px_repeat(7,minmax(130px,1fr))] bg-gray-50 border-b border-gray-200">
                <div className="p-2 text-[11px] text-gray-500 font-medium">Saat</div>
                {weeklyOverview.map((day) => {
                  const isToday = day.dateKey === todayKey;
                  const isPast = !isToday && isPastDateKey(day.dateKey);
                  const dayNumber = parseDateKeyLocal(day.dateKey).getDate();

                  return (
                    <button
                      key={`header-${day.dateKey}`}
                      onClick={() => {
                        setReferenceDate(parseDateKeyLocal(day.dateKey));
                        setViewMode('daily');
                      }}
                      className={'p-2 text-center transition-colors ' + (isToday ? 'bg-primary-50' : 'hover:bg-gray-100') + (isPast ? ' opacity-50' : '')}
                    >
                      <p className={'text-xs font-semibold ' + (isToday ? 'text-primary-800' : 'text-primary-700')}>{day.label}</p>
                      <div className={'mt-1 inline-flex items-center justify-center w-10 h-10 rounded-full text-xl leading-none font-semibold ' + (isToday ? 'bg-primary-600 text-white' : 'text-gray-900')}>
                        {dayNumber}
                      </div>
                    </button>
                  );
                })}
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

                  {weeklyOverview.map((day) => {
                    const isToday = day.dateKey === todayKey;
                    const isPast = !isToday && isPastDateKey(day.dateKey);
                    return (
                      <div
                        key={`timeline-${day.dateKey}`}
                        className={'relative border-r ' + (isToday ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-white') + (isPast ? ' opacity-50' : '')}
                        style={{ height: `${weeklyTimeline.totalHeight}px` }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleTimelineDrop(event, day.dateKey, weeklyTimeline)}
                      >
                      {weeklyTimeline.hourLabels.slice(0, -1).map((hourLabel, index) => (
                        <div
                          key={`line-${day.dateKey}-${hourLabel}`}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: `${index * WEEKLY_PIXELS_PER_HOUR}px` }}
                        />
                      ))}

                      {(() => {
                        const sortedItems = day.items
                          .slice()
                          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

                        const slotIndexMap = {};
                        sortedItems.forEach((item, index) => {
                          const slotKey = `${item.time || ''}-${parseInt(item.duration || 60, 10) || 60}`;
                          if (!slotIndexMap[slotKey]) {
                            slotIndexMap[slotKey] = [];
                          }
                          slotIndexMap[slotKey].push(index);
                        });

                        return sortedItems.map((item, index) => {
                          const eventStyle = getWeeklyEventStyle(item);
                          if (!eventStyle) return null;

                          const slotKey = `${item.time || ''}-${parseInt(item.duration || 60, 10) || 60}`;
                          const slotIndexes = slotIndexMap[slotKey] || [index];
                          const slotCount = slotIndexes.length;
                          const slotPosition = Math.max(0, slotIndexes.indexOf(index));
                          const cardHeight = Math.max(20, eventStyle.height - 2);
                          const showStudent = cardHeight >= 34;
                          const showStatus = cardHeight >= 48;

                          return (
                            <button
                              key={item.id || `${item.studentId}-${item.date}-${item.time}-${index}`}
                              onClick={() => navigate(`/students/${item.studentId}?tab=schedule&lessonDate=${encodeURIComponent(getEventDateKey(item.date))}&lessonTime=${encodeURIComponent(item.time || '')}`)}
                              draggable
                              onDragStart={(event) => handleLessonDragStart(event, item)}
                              onDragEnd={handleLessonDragEnd}
                              className="absolute text-left text-[11px] rounded-md px-1.5 py-1 border overflow-hidden"
                              style={{
                                top: `${eventStyle.top + 1}px`,
                                left: slotCount > 1 ? `calc(${(100 / slotCount) * slotPosition}% + 4px)` : '4px',
                                width: slotCount > 1 ? `calc(${100 / slotCount}% - 6px)` : 'calc(100% - 8px)',
                                height: `${cardHeight}px`,
                                backgroundColor: hexToRgba(getStudentColor(item.studentId), 0.13),
                                borderColor: hexToRgba(getStudentColor(item.studentId), 0.4),
                                color: '#1f2937'
                              }}
                              title={`${item.studentName} • ${item.time}`}
                            >
                              <p className="truncate font-medium leading-tight">{getTimeRangeLabel(item.time, item.duration)}</p>
                              {showStudent && <p className="truncate text-[10px] leading-tight mt-0.5">{item.studentName}</p>}
                              {showStatus && <p className="text-[10px] opacity-80 mt-0.5 leading-tight">{item.paymentStatus === 'collected' ? 'Tahsil' : 'Bekliyor'}</p>}
                            </button>
                          );
                        });
                      })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Kartlar başlangıç saatine göre yerleşir, yükseklik ders süresini yansıtır. Gün başlığına tıklayınca günlük detay açılır.</p>
        </div>
      )}

      {viewMode === 'daily' && dailyTimeline && (
        <div className="card mb-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[72px_1fr] bg-gray-50 border-b border-gray-200">
              <div className="p-2 text-[11px] text-gray-500 font-medium">Saat</div>
              <div className="p-2 text-xs font-semibold text-primary-700">
                {getDayName(toDateKey(referenceDate))}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              <div className="grid grid-cols-[72px_1fr]">
                <div className="relative border-r border-gray-200 bg-white" style={{ height: `${dailyTimeline.totalHeight}px` }}>
                  {dailyTimeline.hourLabels.map((hourLabel, index) => {
                    const top = index * WEEKLY_PIXELS_PER_HOUR;
                    return (
                      <div
                        key={`daily-scale-${hourLabel}`}
                        className="absolute left-0 right-0 text-[11px] text-gray-500 pl-2"
                        style={{ top: `${top - 8}px` }}
                      >
                        {hourLabel}
                      </div>
                    );
                  })}
                </div>

                <div
                  className="relative border-r border-gray-100 bg-white"
                  style={{ height: `${dailyTimeline.totalHeight}px` }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleTimelineDrop(event, toDateKey(referenceDate), dailyTimeline)}
                >
                  {dailyTimeline.hourLabels.slice(0, -1).map((hourLabel, index) => (
                    <div
                      key={`daily-line-${hourLabel}`}
                      className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: `${index * WEEKLY_PIXELS_PER_HOUR}px` }}
                    />
                  ))}

                  {visibleEvents
                    .slice()
                    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                    .map((item, index) => {
                      const eventStyle = getDailyEventStyle(item);
                      if (!eventStyle) return null;

                      const cardHeight = Math.max(22, eventStyle.height - 2);
                      const showStudent = cardHeight >= 34;
                      const showStatus = cardHeight >= 48;

                      return (
                        <button
                          key={`daily-${item.id || `${item.studentId}-${item.date}-${item.time}-${index}`}`}
                          onClick={() => navigate(`/students/${item.studentId}?tab=schedule&lessonDate=${encodeURIComponent(getEventDateKey(item.date))}&lessonTime=${encodeURIComponent(item.time || '')}`)}
                          draggable
                          onDragStart={(event) => handleLessonDragStart(event, item)}
                          onDragEnd={handleLessonDragEnd}
                          className="absolute text-left text-[11px] rounded-md px-1.5 py-1 border overflow-hidden"
                          style={{
                            top: `${eventStyle.top + 1}px`,
                            left: '4px',
                            width: 'calc(100% - 8px)',
                            height: `${cardHeight}px`,
                            backgroundColor: hexToRgba(getStudentColor(item.studentId), 0.13),
                            borderColor: hexToRgba(getStudentColor(item.studentId), 0.4),
                            color: '#1f2937'
                          }}
                          title={`${item.studentName} • ${item.time}`}
                        >
                          <p className="truncate font-medium leading-tight">{getTimeRangeLabel(item.time, item.duration)}</p>
                          {showStudent && <p className="truncate text-[10px] leading-tight mt-0.5">{item.studentName}</p>}
                          {showStatus && <p className="text-[10px] opacity-80 mt-0.5 leading-tight">{item.paymentStatus === 'collected' ? 'Tahsil' : 'Bekliyor'}</p>}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Dersi sürükleyip bırakınca saat güncellenir. Kaydetmede “Bu ders” veya “Bu ve takip eden” seçebilirsin.</p>
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="card mb-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] text-gray-500 font-medium py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthlyOverview.cells.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="h-16" />;
              }

              const isToday = cell.dateKey === todayKey;
              const isPast = !isToday && isPastDateKey(cell.dateKey);

              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setReferenceDate(parseDateKeyLocal(cell.dateKey));
                    setViewMode('daily');
                  }}
                  className={'h-16 border rounded-lg p-1 text-left transition-colors ' + (isToday ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:bg-gray-50') + (isPast ? ' opacity-50' : '')}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className={'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ' + (isToday ? 'bg-primary-600 text-white' : 'text-gray-900')}>
                      {cell.day}
                    </p>
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
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Güne tıklayınca günlük detay açılır.</p>
        </div>
      )}

      {viewMode === 'yearly' && (
        <div className="card mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {yearlyOverview.map((month) => {
              const now = new Date();
              const isCurrentMonth = referenceDate.getFullYear() === now.getFullYear() && month.monthIndex === now.getMonth();
              const isPastMonth = referenceDate.getFullYear() < now.getFullYear()
                || (referenceDate.getFullYear() === now.getFullYear() && month.monthIndex < now.getMonth());

              return (
                <button
                  key={month.label}
                  onClick={() => {
                    setReferenceDate(new Date(referenceDate.getFullYear(), month.monthIndex, 1));
                    setViewMode('monthly');
                  }}
                  className={'border rounded-xl p-3 text-left transition-colors ' + (isCurrentMonth ? 'border-primary-300 bg-primary-50 hover:bg-primary-50' : 'border-gray-200 hover:bg-gray-50') + (isPastMonth && !isCurrentMonth ? ' opacity-50' : '')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{month.label}</p>
                    {isCurrentMonth && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-600 text-white">Bu ay</span>}
                  </div>
                  <p className="text-sm text-primary-700 mt-1">Toplam: {month.count} ders</p>
                  <p className="text-xs text-emerald-700">Tahsil: {month.collected}</p>
                  <p className="text-xs text-amber-700">Bekleyen: {month.pending}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Aya tıklayınca aylık detay açılır.</p>
        </div>
      )}

      {groupedEvents.length === 0 ? (
        <div className="card text-center text-gray-500">Bu periyot için ders bulunmuyor.</div>
      ) : (
        <div className="space-y-3">
          {groupedEvents.map((group) => (
            <div key={group.date} className={'card ' + (isPastDateKey(group.date) ? 'opacity-60' : '')}>
              {viewMode !== 'daily' && (
                <p className="text-xs font-semibold text-primary-700 mb-2">{formatShortDate(group.date)} {getDayName(group.date)}</p>
              )}

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

      {isMoveScopeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Taşıma kapsamı penceresini kapat"
            className="absolute inset-0 bg-black/40"
            onClick={() => closeMoveScopeDialog(null)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-lg p-4">
            <h3 className="text-base font-semibold text-gray-900">Taşıma kapsamı</h3>
            <p className="text-sm text-gray-600 mt-1">Ders taşıma işlemi hangi derslere uygulansın?</p>

            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="move-scope"
                  checked={moveScopeChoice === 'single'}
                  onChange={() => setMoveScopeChoice('single')}
                  className="h-4 w-4 text-primary-600 border-gray-300"
                />
                Bu ders
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="move-scope"
                  checked={moveScopeChoice === 'fromHere'}
                  onChange={() => setMoveScopeChoice('fromHere')}
                  className="h-4 w-4 text-primary-600 border-gray-300"
                />
                Bu ve takip eden dersler
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => closeMoveScopeDialog(null)}
                className="btn-secondary py-2"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => closeMoveScopeDialog(moveScopeChoice)}
                className="btn-primary py-2"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
