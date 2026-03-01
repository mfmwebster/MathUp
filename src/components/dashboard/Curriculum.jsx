/*
 * File: src/components/dashboard/Curriculum.jsx
 * Description: Müfredat verisini gösteren yardımcı bileşen; `data/curriculum.json` kullanır.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Target } from 'lucide-react';
import curriculumData from '../../data/curriculum.json';

const Curriculum = () => {
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 8, 1);
    const diffWeeks = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));
    setCurrentWeek(Math.max(1, Math.min(37, diffWeeks + 1)));
  }, []);

  const toggleWeek = (week) => {
    setExpandedWeek(expandedWeek === week ? null : week);
  };

  return (
    <div className="page-container pb-24">
      <h1 className="section-title flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-primary-600" />
        8. Sınıf Müfredatı
      </h1>
      <p className="text-gray-600 mb-4 text-sm">
        37 haftalik LGS hazirlik programi
      </p>

      <div className="space-y-2">
        {curriculumData.map((week) => (
          <div 
            key={week.week}
            className={'card overflow-hidden ' + (week.week === currentWeek ? 'ring-2 ring-primary-500 bg-primary-50' : '')}
          >
            <button
              onClick={() => toggleWeek(week.week)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className={'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ' + (week.week === currentWeek ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700')}>
                  {week.week}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{week.unit}</h3>
                  <p className="text-xs text-gray-500">{week.learningArea}</p>
                </div>
              </div>
              {expandedWeek === week.week ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedWeek === week.week && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <p className="text-sm text-gray-600 mb-3">{week.description}</p>
                
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Kazanimlar:
                  </h4>
                  {week.objectives.map((obj, idx) => (
                    <div 
                      key={idx}
                      className="text-xs bg-gray-50 p-2 rounded-lg text-gray-700"
                    >
                      {obj}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Curriculum;