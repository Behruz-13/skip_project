import React from 'react';
import { weekday } from '../utils.js';

const openPicker = (e) => {
  try {
    e.target.showPicker?.();
  } catch {
    /* браузер не поддерживает */
  }
};

// Поле срока: дата (календарь открывается по клику) + время + день недели
export default function DateTimeInput({ date, time, onChange, required = true }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        className="input w-auto min-w-[10rem] flex-1 cursor-pointer"
        value={date}
        onClick={openPicker}
        onChange={(e) => onChange({ date: e.target.value, time })}
        required={required}
      />
      <input
        type="time"
        className="input w-auto min-w-[6.5rem]"
        value={time}
        onClick={openPicker}
        onChange={(e) => onChange({ date, time: e.target.value })}
        required={required}
      />
      <span className="w-8 text-sm font-semibold text-blue-800">{date ? weekday(date) : ''}</span>
    </div>
  );
}
