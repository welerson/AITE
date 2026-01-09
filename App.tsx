
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserRole, Shift, AITSession } from './types';
import Layout from './components/Layout';
import { COLORS } from './constants';
import ManagerDashboard from './components/ManagerDashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isAITeOpenInSystem, setIsAITeOpenInSystem] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'TERMS' | 'HOME' | 'CLOSING' | 'MANAGER'>('LOGIN');
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{msg: string, time: string}[]>([]);
  
  const activeShiftRef = useRef<Shift | null>(null);
  const isAITeOpenRef = useRef<boolean>(false);

  useEffect(() => {
    activeShiftRef.current = activeShift;
    isAITeOpenRef.current = isAITeOpenInSystem;
  }, [activeShift, isAITeOpenInSystem]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{msg, time}, ...prev].slice(0, 15));
  };

  const refreshTelemetry = () => {
    const shift = activeShiftRef.current;
    if (!shift || shift.status !== 'ACTIVE') return;

    const now = Date.now();
    let updated = { ...shift };
    let hasChanged = false;

    const sessions = [...updated.sessions];
    const lastSession = sessions[sessions.length - 1];

    if (isAITeOpenRef.current) {
      if (!lastSession || lastSession.end) {
        const newSess: AITSession = { id: `s_${now}`, start: now, durationMs: 0 };
        sessions.push(newSess);
        updated.sessions = sessions;
        hasChanged = true;
        addLog("TELEMETRIA: Iniciando contagem de tela...");
      }
    } else {
      if (lastSession && !lastSession.end) {
        lastSession.end = now;
        lastSession.durationMs = now - lastSession.start;
        updated.sessions = sessions;
        hasChanged = true;
        addLog(`TELEMETRIA: Sessão encerrada (${(lastSession.durationMs/1000).toFixed(1)}s)`);
      }
    }

    const totalMs = sessions.reduce((acc, s) => {
      const duration = s.end ? s.durationMs : (now - s.start);
      return acc + duration;
    }, 0);

    updated.metrics = {
      ...updated.metrics,
      totalTimeMs: totalMs,
      sessionCount: sessions.length,
      lastAccess: now
    };

    if (hasChanged || Math.abs(totalMs - shift.metrics.totalTimeMs) > 1000) {
      setActiveShift(updated);
    }
  };

  useEffect(() => {
    const handleAndroidEvent = (e: any) => {
      if (e.detail && e.detail.packageName === 'br.gov.aite') {
        setIsAITeOpenInSystem(e.detail.isForeground);
      }
    };

    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        refreshTelemetry();
        addLog("SISTEMA: Sincronizando dados ao retornar...");
      }
    };

    window.addEventListener('android_foreground_event', handleAndroidEvent);
    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('android_foreground_event', handleAndroidEvent);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  useEffect(() => {
    refreshTelemetry();
  }, [isAITeOpenInSystem]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isAITeOpenInSystem) {
        refreshTelemetry();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isAITeOpenInSystem]);

  const handleLogin = (role: UserRole) => {
    setUser({
      uid: `ag_${Math.floor(Math.random() * 1000)}`,
      name: role === UserRole.AGENTE ? 'Agente Silva' : 'Gestor Oliveira',
      matricula: role === UserRole.AGENTE ? '88.123-4' : '44.987-0',
      sector: 'Setor Centro',
      role,
      termsAccepted: true
    });
    setView(role === UserRole.AGENTE ? 'HOME' : 'MANAGER');
  };

  const triggerSimulation = () => {
    const nextState = !isAITeOpenInSystem;
    const event = new CustomEvent('android_foreground_event', { 
      detail: { packageName: 'br.gov.aite', isForeground: nextState } 
    });
    window.dispatchEvent(event);
    addLog(`MANUAL: Simulação de ${nextState ? 'ENTRADA' : 'SAÍDA'} no AITe`);
  };

  const submitClosing = async (count: number, obs: string) => {
    if (!activeShift) return;
    const finalShift: Shift = { ...activeShift, status: 'CLOSED', endTime: Date.now(), declaredAitCount: count, observations: obs };
    setAllShifts(prev => [...prev, finalShift]);
    setActiveShift(null);
    setView('HOME');
  };

  if (view === 'LOGIN') {
    return (
      <Layout title="Controle Operacional">
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-24 h-24 bg-[#001F3F] rounded-[32px] flex items-center justify-center mb-10 shadow-2xl">
            <span className="text-white text-4xl font-black">A</span>
          </div>
          <h2 className="text-3xl font-black mb-12 text-center text-gray-900 leading-tight">Auditoria<br/>de Escala</h2>
          <button onClick={() => handleLogin(UserRole.AGENTE)} className="w-full py-6 bg-[#001F3F] text-white font-black rounded-3xl mb-4 shadow-xl active:scale-95 transition-all text-lg">ÁREA DO AGENTE</button>
          <button onClick={() => handleLogin(UserRole.GESTOR)} className="w-full py-5 border-2 border-gray-100 text-gray-400 font-bold rounded-3xl">ÁREA DO GESTOR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={activeShift ? "Auditoria Ativa" : "Início de Turno"} showBack onBack={() => setView('LOGIN')}>
        <div className="p-6 flex-1 flex flex-col gap-6">
          {activeShift ? (
            <>
              {/* Alerta de Modo de Teste */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl">
                <p className="text-[10px] font-black text-amber-800 uppercase mb-1">⚠️ Aviso de Teste (Navegador)</p>
                <p className="text-[11px] text-amber-700 leading-tight font-medium">O navegador bloqueia o monitoramento automático de outros apps. Use o botão abaixo para testar a contagem.</p>
                <button 
                  onClick={triggerSimulation} 
                  className={`w-full mt-3 py-4 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 ${isAITeOpenInSystem ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}
                >
                  {isAITeOpenInSystem ? 'PARAR SIMULAÇÃO (SAIR DO AITE)' : 'INICIAR SIMULAÇÃO (ENTRAR NO AITE)'}
                </button>
              </div>

              {/* Status Visual */}
              <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isAITeOpenInSystem ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-gray-100 text-gray-300'}`}>
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                 </div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status do AITe</p>
                 <h3 className={`text-xl font-black ${isAITeOpenInSystem ? 'text-blue-600' : 'text-gray-400'}`}>
                    {isAITeOpenInSystem ? 'CONTABILIZANDO...' : 'AGUARDANDO ABERTURA'}
                 </h3>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-[32px] p-6 text-white text-center shadow-xl">
                  <p className="text-[10px] font-bold opacity-40 uppercase mb-1">Tempo Total</p>
                  <p className="text-4xl font-black tracking-tighter">{(activeShift.metrics.totalTimeMs / 60000).toFixed(1)}<span className="text-sm opacity-50 ml-1">m</span></p>
                </div>
                <div className="bg-white rounded-[32px] p-6 border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Acessos</p>
                  <p className="text-4xl font-black text-gray-800 tracking-tighter">{activeShift.metrics.sessionCount}</p>
                </div>
              </div>

              {/* Logs */}
              <div className="bg-gray-50 rounded-[32px] p-6 flex-1 flex flex-col min-h-0 border border-gray-200">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-4 text-center tracking-widest">Linha do Tempo da Telemetria</p>
                 <div className="flex-1 overflow-y-auto space-y-3">
                    {auditLogs.map((log, i) => (
                      <div key={i} className="flex justify-between items-start text-[10px] border-b border-gray-200 pb-2">
                        <span className={`font-bold pr-4 ${log.msg.includes('SISTEMA') ? 'text-blue-600' : 'text-gray-500'}`}>{log.msg}</span>
                        <span className="font-mono text-gray-300 shrink-0">{log.time}</span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p className="text-xs text-gray-300 italic text-center py-10">Aguardando sinais...</p>}
                 </div>
              </div>

              <button onClick={() => setView('CLOSING')} className="w-full py-5 border-2 border-red-600 text-red-600 font-black rounded-3xl active:bg-red-600 active:text-white transition-all shadow-sm">ENCERRAR AUDITORIA</button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-8 border border-gray-100 shadow-inner">
                 <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Turno Pronto</h3>
              <p className="text-sm text-gray-400 mb-12 px-4 leading-relaxed">Inicie sua escala para ativar a coleta de dados de produtividade automática.</p>
              <button onClick={() => { 
                const newShift: Shift = {
                  id: `shift_${Date.now()}`,
                  userId: user!.uid,
                  userName: user!.name,
                  startTime: Date.now(),
                  status: 'ACTIVE',
                  sessions: [],
                  metrics: { totalTimeMs: 0, sessionCount: 0, avgSessionTimeMs: 0 },
                  flags: []
                };
                setActiveShift(newShift);
                addLog("TURNO: Iniciado pelo agente");
              }} className="w-full py-6 bg-[#001F3F] text-white font-black rounded-[32px] shadow-2xl active:scale-95 transition-all text-xl">INICIAR ESCALA</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Resumo do Turno">
        <form className="p-8 flex flex-col flex-1" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); submitClosing(Number(d.get('count')), d.get('obs') as string); }}>
          <div className="bg-[#001F3F] p-8 rounded-[48px] text-white mb-10 text-center shadow-2xl">
            <p className="text-[10px] font-black opacity-30 uppercase mb-4 tracking-widest">Dados Auditados</p>
            <div className="flex justify-around items-center">
               <div>
                  <span className="text-5xl font-black block">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase">Minutos Tela</span>
               </div>
               <div className="w-px h-10 bg-white/10"></div>
               <div>
                  <span className="text-5xl font-black block">{activeShift!.metrics.sessionCount}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase">Acessos</span>
               </div>
            </div>
          </div>
          <div className="space-y-8 mb-12">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Total de Multas Digitadas:</label>
              <input name="count" type="number" required className="w-full p-6 bg-white border border-gray-100 rounded-3xl text-4xl font-black outline-none focus:ring-4 focus:ring-blue-50/50 shadow-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Observações:</label>
              <textarea name="obs" rows={3} className="w-full p-6 bg-white border border-gray-100 rounded-3xl text-sm outline-none focus:ring-4 focus:ring-blue-50/50" placeholder="Relate inconsistências aqui..."></textarea>
            </div>
          </div>
          <button type="submit" className="w-full py-6 bg-[#001F3F] text-white font-black rounded-[32px] shadow-2xl mt-auto">FINALIZAR TURNO</button>
        </form>
      </Layout>
    );
  }

  if (view === 'MANAGER') {
    return (
      <Layout title="Dashboard Gestor" showBack onBack={() => setView('LOGIN')}>
        <ManagerDashboard shifts={allShifts} />
      </Layout>
    );
  }

  return null;
};

export default App;
