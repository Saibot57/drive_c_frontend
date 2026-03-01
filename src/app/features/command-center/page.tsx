'use client';

import { Calendar } from '@/components/calendar/Calendar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function CommandCenterPage() {
  return (
    <ProtectedRoute>
      {/* Root layout injects pt-8 (32px), so 100vh-32px fills the rest */}
      <div className="h-[calc(100vh-32px)] flex gap-3 overflow-hidden">

        {/* ── Left Column (35%) ─────────────────────────────── */}
        <div className="w-[35%] flex flex-col gap-3">

          {/* Notes Basket */}
          <div className="flex-1 border-2 border-black bg-[#fef9c3] shadow-[4px_4px_0px_0px_black] p-4 overflow-auto">
            <h2 className="font-bold text-base uppercase tracking-widest mb-3">
              Notes Basket
            </h2>
            <p className="text-xs text-gray-400">
              Anteckningar skapas via terminalen nedan.
            </p>
          </div>

          {/* Terminal Input */}
          <div className="h-[38%] border-2 border-black bg-black shadow-[4px_4px_0px_0px_black] p-4 font-mono flex flex-col overflow-hidden">
            <p className="text-green-400 text-xs mb-2 shrink-0">
              $ command-center terminal
            </p>
            <p className="text-gray-600 text-xs mb-3 shrink-0">
              Skriv kommandon för att skapa anteckningar och todos.
            </p>
            <div className="flex-1 overflow-auto" />
            <div className="flex items-center gap-2 shrink-0 mt-2 border-t border-gray-700 pt-2">
              <span className="text-green-400 text-sm">$</span>
              <span className="text-green-400 text-sm">_</span>
              <span className="w-2 h-4 bg-green-400 animate-pulse" />
            </div>
          </div>

        </div>

        {/* ── Right Column (65%) ────────────────────────────── */}
        <div className="w-[65%] flex flex-col gap-3">

          {/* Calendar */}
          <div className="flex-1 border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] overflow-auto">
            <Calendar />
          </div>

          {/* Todo List */}
          <div className="h-[34%] border-2 border-black bg-[#fce7f3] shadow-[4px_4px_0px_0px_black] p-4 flex flex-col overflow-hidden">
            <h2 className="font-bold text-base uppercase tracking-widest mb-3 shrink-0">
              Todo List
            </h2>
            <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">

              {/* This Week */}
              <div className="border-2 border-black bg-white p-3 flex flex-col overflow-hidden">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b-2 border-black">
                  This Week
                </h3>
                <div className="flex-1 overflow-auto">
                  <p className="text-xs text-gray-400 mt-1">Inga todos ännu.</p>
                </div>
              </div>

              {/* By Date */}
              <div className="border-2 border-black bg-white p-3 flex flex-col overflow-hidden">
                <h3 className="font-bold text-xs uppercase tracking-widest mb-2 shrink-0 pb-2 border-b-2 border-black">
                  By Date
                </h3>
                <div className="flex-1 overflow-auto">
                  <p className="text-xs text-gray-400 mt-1">Inga todos ännu.</p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </ProtectedRoute>
  );
}
