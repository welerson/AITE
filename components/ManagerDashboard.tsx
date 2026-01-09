
import React, { useState } from 'react';
import { Shift, AlertStatus } from '../types';
import { COLORS } from '../constants';

interface Props {
  shifts: Shift[];
}

const ManagerDashboard: React.FC<Props> = ({ shifts }) => {
  const [filter, setFilter] = useState('');

  const getAlertStatus = (shift: Shift): AlertStatus => {
    if (shift.flags.length > 0) return AlertStatus.INCONSISTENTE;
    if (shift.metrics.totalTimeMs === 0 && (shift.declaredAitCount || 0) > 0) return AlertStatus.ATENCAO;
    return AlertStatus.OK;
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case AlertStatus.OK: return 'bg-green-100 text-green-800';
      case AlertStatus.ATENCAO: return 'bg-yellow-100 text-yellow-800';
      case AlertStatus.INCONSISTENTE: return 'bg-red-100 text-red-800';
    }
  };

  const filteredShifts = shifts.filter(s => 
    s.userName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Stats Summary */}
      <div className="p-4 grid grid-cols-3 gap-3 shrink-0">
        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Dias</p>
          <p className="text-xl font-bold">{shifts.length}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Alertas</p>
          <p className="text-xl font-bold text-red-600">
            {shifts.filter(s => s.flags.length > 0).length}
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase">AITs Total</p>
          <p className="text-xl font-bold text-blue-600">
            {shifts.reduce((acc, s) => acc + (s.declaredAitCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 mb-2">
        <input 
          type="text" 
          placeholder="Filtrar por nome do agente..." 
          className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#001F3F]"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Shift List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 ml-1">Relatórios de Hoje</h3>
        
        {filteredShifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm italic">Nenhum turno encerrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShifts.map(shift => (
              <div key={shift.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-800">{shift.userName}</h4>
                    <p className="text-xs text-gray-400">Início: {new Date(shift.startTime).toLocaleTimeString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(getAlertStatus(shift))}`}>
                    {getAlertStatus(shift)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-xl">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">AITs</p>
                    <p className="text-sm font-bold">{shift.declaredAitCount}</p>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <p className="text-[10px] text-gray-400">Uso (min)</p>
                    <p className="text-sm font-bold">{(shift.metrics.totalTimeMs / 60000).toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">Sessões</p>
                    <p className="text-sm font-bold">{shift.metrics.sessionCount}</p>
                  </div>
                </div>

                {shift.flags.length > 0 && (
                  <div className="bg-red-50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-red-600 mb-1">⚠️ ALERTAS DE INCONSISTÊNCIA:</p>
                    {shift.flags.map((flag, idx) => (
                      <p key={idx} className="text-[10px] text-red-800 leading-tight">• {flag}</p>
                    ))}
                  </div>
                )}

                {shift.observations && (
                  <div className="text-[10px] text-gray-500 italic bg-gray-50 p-2 rounded-lg">
                    " {shift.observations} "
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
