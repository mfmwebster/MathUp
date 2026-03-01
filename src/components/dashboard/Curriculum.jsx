/*
 * File: src/components/dashboard/Curriculum.jsx
 * Description: Müfredat verisini gösteren yardımcı bileşen; sınıf düzeyine göre uygun curriculum dosyasını kullanır.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Target } from 'lucide-react';

const Curriculum = ({ grade = '8' }) => {
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [curriculumData, setCurriculumData] = useState([]);

  useEffect(() => {
    // Dinamik olarak curriculum dosyasını yükle
    const loadCurriculum = async () => {
      try {
        const module = await import(`../../data/curriculum${grade}.json`);
        setCurriculumData(module.default);
      } catch (error) {
        console.error(`Curriculum file for grade ${grade} not found:`, error);
        setCurriculumData([]);
      }
    };
    loadCurriculum();
  }, [grade]);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 8, 1);
    const diffWeeks = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));
    setCurrentWeek(Math.max(1, Math.min(37, diffWeeks + 1)));
  }, []);

  const toggleWeek = (week) => {
    setExpandedWeek(expandedWeek === week ? null : week);
  };

  const gradeTitle = `${grade}. Sınıf Müfredatı`;
  const subtitle = grade === '8' ? '37 haftalik LGS hazirlik programi' : '37 haftalik ögretim programi';

  return (
    <div className="page-container pb-24">
      <h1 className="section-title flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-primary-600" />
        {gradeTitle}
      </h1>
      <p className="text-gray-600 mb-4 text-sm">
        {subtitle}
      </p>

      <div className="space-y-2">
        {curriculumData.map((week) => {
          // Determine which fields to display - handle both old and new formats
          const title = week.unit || week.theme || 'Hafta';
          const subtitle = week.learningArea || week.topic || '';
          const displayDesc = week.description || week.dateRange || '';
          const outcomes = week.objectives || week.learningOutcomes || [];

          return (
            <div 
              key={week.week}
              className={'card overflow-hidden ' + (week.week === currentWeek ? 'ring-2 ring-primary-500 bg-primary-50' : '')}
            >
              <button
                onClick={() => toggleWeek(week.week)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ' + (week.week === currentWeek ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>
                    {week.week}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
                    <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                  </div>
                </div>
                {expandedWeek === week.week ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>

              {expandedWeek === week.week && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {displayDesc && <p className="text-sm text-gray-600 mb-3">{displayDesc}</p>}
                  {week.hours && <p className="text-xs text-gray-500 mb-2">Saat: {week.hours}</p>}
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Öğrenme Çıktıları:
                    </h4>
                    {outcomes.length > 0 ? (
                      outcomes.map((item, idx) => (
                        <div 
                          key={idx}
                          className="text-xs bg-gray-50 p-2 rounded-lg text-gray-700"
                        >
                          {item}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">Veri bulunmamaktadır.</p>
                    )}
                  </div>

                  {week.specialDays && week.specialDays.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Özel Günler:</p>
                      <div className="flex flex-wrap gap-1">
                        {week.specialDays.map((day, idx) => (
                          <span key={idx} className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Curriculum;