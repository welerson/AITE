
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
  const [lastBridgeSignal, setLastBridgeSignal] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<{msg: string, time: string}[]>([]);
  
  // Refs para evitar problemas de escopo (stale closures) com eventos de sistema
  const activeShiftRef = useRef<Shift | null>(null);
  const isAITeOpenRef = useRef<boolean>(false);

  useEffect(() => {
    activeShiftRef.current = activeShift;
    isAITeOpenRef.current = isAITeOpenInSystem;
  }, [activeShift, isAITeOpenInSystem]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{msg, time}, ...prev].slice(0, 10));
  };

  const syncToCloud = async (data: any) => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSyncing(false);
  };

  // Função mestre de cálculo de tempo (imune a background pause)
  const refreshTelemetry = () => {
    const shift = activeShiftRef.current;
    if (!shift || shift.status !== 'ACTIVE') return;

    const now = Date.now();
    let updated = { ...shift };
    let hasChanged = false;

    // Se o AITe está aberto, calculamos o tempo desde o início da última sessão
    const sessions = [...updated.sessions];
    const lastSession = sessions[sessions.length - 1];

    if (isAITeOpenRef.current) {
      if (!lastSession || lastSession.end) {
        // Criar nova sessão se não houver uma ativa
        const newSess: AITSession = { id: `s_${now}`, start: now, durationMs: 0 };
        sessions.push(newSess);
        updated.sessions = sessions;
        hasChanged = true;
        addLog("SISTEMA: Iniciando cronometragem via relógio");
      }
    } else {
      if (lastSession && !lastSession.end) {
        // Fechar sessão ativa
        lastSession.end = now;
        lastSession.durationMs = now - lastSession.start;
        updated.sessions = sessions;
        hasChanged = true;
        addLog(`SISTEMA: Sessão finalizada (${(lastSession.durationMs/1000).toFixed(1)}s)`);
      }
    }

    // Recalcular métricas totais baseado na soma de todas as durações
    // Para a sessão ativa (sem 'end'), calculamos (agora - start)
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

  // Ponte com Android e Sincronização de Visibilidade
  useEffect(() => {
    const handleAndroidEvent = (e: any) => {
      if (e.detail && e.detail.packageName === 'br.gov.aite') {
        const isForeground = e.detail.isForeground;
        setLastBridgeSignal(Date.now());
        setIsAITeOpenInSystem(isForeground);
        // O state não atualiza imediatamente dentro desta função, por isso usamos o Ref ou chamamos a função após o render
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        addLog("AUDITOR: Sincronizando relógios de background...");
        refreshTelemetry();
      }
    };

    window.addEventListener('android_foreground_event', handleAndroidEvent);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('android_foreground_event', handleAndroidEvent);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // Efeito para reagir a mudanças no sinal do AITe
  useEffect(() => {
    refreshTelemetry();
    if (activeShift) syncToCloud(activeShift);
  }, [isAITeOpenInSystem]);

  // Loop de atualização visual (só roda se estivermos vendo o app)
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
      termsAccepted: false
    });
    setView(role === UserRole.AGENTE ? 'TERMS' : 'MANAGER');
  };

  const startShift = () => {
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
    addLog("AUDITORIA: Iniciada");
  };

  const triggerSimulation = () => {
    const nextState = !isAITeOpenInSystem;
    const event = new CustomEvent('android_foreground_event', { 
      detail: { packageName: 'br.gov.aite', isForeground: nextState } 
    });
    window.dispatchEvent(event);
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
      <Layout title="Auditor Operacional">
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
            <span className="text-white text-3xl font-black">A</span>
          </div>
          <h2 className="text-2xl font-black mb-8 tracking-tight">Login Auditoria</h2>
          <button onClick={() => handleLogin(UserRole.AGENTE)} className="w-full py-5 bg-[#001F3F] text-white font-bold rounded-2xl mb-4 shadow-lg active:scale-95 transition-transform">ENTRAR COMO AGENTE</button>
          <button onClick={() => handleLogin(UserRole.GESTOR)} className="w-full py-4 border-2 border-gray-100 text-gray-400 font-bold rounded-2xl">PAINEL GESTOR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'TERMS') {
    return (
      <Layout title="Contrato Digital">
        <div className="p-8 flex flex-col flex-1">
          <div className="bg-blue-50 p-6 rounded-[32px] mb-8 border border-blue-100">
            <p className="text-xs text-blue-900 leading-relaxed font-medium">Este dispositivo monitora o tempo de tela do sistema AITe via relógio atômico do sistema, sendo impossível burlar via background.</p>
          </div>
          <button onClick={() => setView('HOME')} className="w-full py-5 bg-[#001F3F] text-white font-black rounded-3xl mt-auto shadow-xl">CONCORDAR E CONTINUAR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={activeShift ? "Auditoria em Tempo Real" : "Monitor Offline"} showBack onBack={() => setView('LOGIN')}>
        <div className="p-5 flex-1 flex flex-col gap-4">
          {activeShift ? (
            <>
              {/* Diagnóstico */}
              <div className="bg-white border border-gray-100 rounded-[32px] p-5 shadow-sm">
                <div className="flex justify-between items-center mb-5">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isAITeOpenInSystem ? 'bg-blue-500 animate-ping' : 'bg-gray-300'}`}></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase">Sincronia de Relógio Ativa</span>
                   </div>
                   <button onClick={triggerSimulation} className="text-[9px] font-black bg-blue-50 px-3 py-1.5 rounded-full text-blue-600 active:bg-blue-100">
                      {isAITeOpenInSystem ? 'SAIR DO AITE' : 'ENTRAR NO AITE'}
                   </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isAITeOpenInSystem ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg scale-105' : 'bg-gray-100 text-gray-300'}`}>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 tracking-tight">Status do AITe</p>
                    <p className={`text-[11px] font-bold ${isAITeOpenInSystem ? 'text-blue-600' : 'text-gray-400'}`}>
                      {isAITeOpenInSystem ? 'CONTABILIZANDO TEMPO...' : 'AGUARDANDO ABERTURA'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#001F3F] rounded-[32px] p-6 text-white text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <svg className="w-12 h-12" fill="white" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                  </div>
                  <p className="text-[9px] font-bold opacity-40 uppercase mb-1">Tempo Total</p>
                  <p className="text-4xl font-black tracking-tighter">{(activeShift.metrics.totalTimeMs / 60000).toFixed(1)}<span className="text-xs opacity-50 ml-1">min</span></p>
                </div>
                <div className="bg-white rounded-[32px] p-6 border border-gray-100 text-center shadow-sm">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Acessos Reais</p>
                  <p className="text-4xl font-black text-gray-800 tracking-tighter">{activeShift.metrics.sessionCount}</p>
                </div>
              </div>

              {/* Histórico detalhado */}
              <div className="bg-gray-50 border border-gray-200 rounded-[32px] p-5 flex-1 flex flex-col min-h-0">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest text-center">Logs de Sincronia de Escala</p>
                 <div className="flex-1 overflow-y-auto space-y-2.5">
                    {auditLogs.map((log, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-white p-2 rounded-xl border border-gray-100">
                        <span className={`font-bold ${log.msg.includes('SISTEMA') ? 'text-blue-600' : 'text-gray-500'}`}>{log.msg}</span>
                        <span className="font-mono text-gray-300 text-[9px]">{log.time}</span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p className="text-[10px] text-gray-300 italic text-center py-10">Nenhuma telemetria recebida.</p>}
                 </div>
              </div>

              <button onClick={() => setView('CLOSING')} className="w-full py-5 bg-red-50 text-red-600 font-black rounded-[24px] border border-red-100 active:bg-red-600 active:text-white transition-all">ENCERRAR AUDITORIA</button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-8 border border-gray-100 shadow-inner">
                 <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl font-black mb-2">Relógio de Auditoria</h3>
              <p className="text-xs text-gray-400 mb-10 px-6">O monitoramento automático será ativado após o início do seu turno.</p>
              <button onClick={startShift} className="w-full py-5 bg-[#001F3F] text-white font-black rounded-[32px] shadow-2xl active:scale-95 transition-transform">INICIAR TURNO</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Fechamento do Dia">
        <form className="p-8 flex flex-col flex-1" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); submitClosing(Number(d.get('count')), d.get('obs') as string); }}>
          <div className="bg-[#001F3F] p-8 rounded-[40px] text-white mb-10 text-center shadow-xl">
            <p className="text-[10px] font-black opacity-30 uppercase mb-4 tracking-widest">Resumo Consolidado</p>
            <div className="flex justify-around items-center">
               <div>
                  <span className="text-5xl font-black block">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Minutos de Tela</span>
               </div>
               <div className="w-px h-10 bg-white/10"></div>
               <div>
                  <span className="text-5xl font-black block">{activeShift!.metrics.sessionCount}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Sessões Reais</span>
               </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-widest">AITs Lavrados (App AITe):</label>
              <input name="count" type="number" required className="w-full p-6 bg-white border border-gray-100 rounded-3xl text-4xl font-black outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-widest">Justificativas/Notas:</label>
              <textarea name="obs" rows={3} className="w-full p-6 bg-white border border-gray-100 rounded-3xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Houve algum problema técnico?"></textarea>
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-[#001F3F] text-white font-black rounded-3xl shadow-2xl mt-auto active:scale-95 transition-transform">FINALIZAR E TRANSMITIR</button>
        </form>
      </Layout>
    );
  }

  if (view === 'MANAGER') {
    return (
      <Layout title="Controle Gestor" showBack onBack={() => setView('LOGIN')}>
        <ManagerDashboard shifts={allShifts} />
      </Layout>
    );
  }

  return null;
};

export default App;
