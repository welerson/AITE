
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
  
  const lastStateChangeRef = useRef<number>(0);
  const activeShiftRef = useRef<Shift | null>(null);

  // Sincroniza o ref com o state para evitar stale closures em eventos do sistema
  useEffect(() => {
    activeShiftRef.current = activeShift;
  }, [activeShift]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{msg, time}, ...prev].slice(0, 8));
  };

  const syncToCloud = async (data: any) => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsSyncing(false);
  };

  // PONTE NATIVA: Escuta eventos do AccessibilityService do Android
  useEffect(() => {
    const handleAndroidEvent = (e: any) => {
      if (e.detail && e.detail.packageName === 'br.gov.aite') {
        const isForeground = e.detail.isForeground;
        setLastBridgeSignal(Date.now());
        setIsAITeOpenInSystem(isForeground);
        addLog(`SINAL ANDROID: AITe ${isForeground ? 'em foco' : 'em background'}`);
      }
    };

    // Escuta quando a aba/app volta a ter visibilidade (ao alternar entre apps)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addLog("AUDITOR: Retornou ao primeiro plano. Sincronizando...");
        // Em um app real, aqui dispararíamos uma requisição para o Android via interface JS
        // para saber o estado atual do AITe.
      }
    };

    window.addEventListener('android_foreground_event', handleAndroidEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('android_foreground_event', handleAndroidEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // LÓGICA DE TELEMETRIA (Garantia de contagem persistente)
  useEffect(() => {
    const shift = activeShiftRef.current;
    if (!shift || shift.status !== 'ACTIVE') return;

    const now = Date.now();
    
    if (isAITeOpenInSystem) {
      // Iniciar nova sessão se não houver uma aberta
      const lastSession = shift.sessions[shift.sessions.length - 1];
      if (!lastSession || lastSession.end) {
        const newSession: AITSession = {
          id: `sess_${now}`,
          start: now,
          durationMs: 0
        };
        const updated = { 
          ...shift, 
          sessions: [...shift.sessions, newSession],
          metrics: { ...shift.metrics, lastAccess: now } 
        };
        setActiveShift(updated);
        syncToCloud(updated);
      }
    } else {
      // Fechar sessão aberta
      const lastIdx = shift.sessions.length - 1;
      const lastSession = shift.sessions[lastIdx];
      
      if (lastSession && !lastSession.end) {
        const duration = now - lastSession.start;
        const endedSession = { ...lastSession, end: now, durationMs: duration };
        const newSessions = [...shift.sessions];
        newSessions[lastIdx] = endedSession;
        
        const totalTime = newSessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
        
        const updated: Shift = {
          ...shift,
          sessions: newSessions,
          metrics: {
            ...shift.metrics,
            totalTimeMs: totalTime,
            sessionCount: newSessions.length,
            avgSessionTimeMs: totalTime / newSessions.length
          }
        };
        setActiveShift(updated);
        syncToCloud(updated);
      }
    }
  }, [isAITeOpenInSystem]);

  // Cronômetro visual (apenas para interface)
  useEffect(() => {
    let timer: any;
    if (activeShift && isAITeOpenInSystem) {
      timer = setInterval(() => {
        setActiveShift(prev => {
          if (!prev) return null;
          const lastIdx = prev.sessions.length - 1;
          const last = prev.sessions[lastIdx];
          if (last && !last.end) {
            const currentSessionTime = Date.now() - last.start;
            const prevTime = prev.sessions.slice(0, lastIdx).reduce((acc, s) => acc + (s.durationMs || 0), 0);
            return {
              ...prev,
              metrics: { ...prev.metrics, totalTimeMs: prevTime + currentSessionTime }
            };
          }
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAITeOpenInSystem, activeShift?.id]);

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
    syncToCloud(newShift);
  };

  const submitClosing = async (count: number, obs: string) => {
    if (!activeShift) return;
    const finalShift: Shift = { ...activeShift, status: 'CLOSED', endTime: Date.now(), declaredAitCount: count, observations: obs };
    setAllShifts(prev => [...prev, finalShift]);
    setActiveShift(null);
    setView('HOME');
    syncToCloud(finalShift);
  };

  // BOTÃO DE SIMULAÇÃO (Para você testar no navegador)
  const triggerSimulation = () => {
    const nextState = !isAITeOpenInSystem;
    const event = new CustomEvent('android_foreground_event', { 
      detail: { packageName: 'br.gov.aite', isForeground: nextState } 
    });
    window.dispatchEvent(event);
  };

  if (view === 'LOGIN') {
    return (
      <Layout title="Auditor Operacional">
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
            <span className="text-white text-3xl font-black">A</span>
          </div>
          <h2 className="text-2xl font-black mb-8">Login de Auditoria</h2>
          <button onClick={() => handleLogin(UserRole.AGENTE)} className="w-full py-5 bg-[#001F3F] text-white font-bold rounded-2xl mb-4">ENTRAR COMO AGENTE</button>
          <button onClick={() => handleLogin(UserRole.GESTOR)} className="w-full py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl">PAINEL GESTOR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'TERMS') {
    return (
      <Layout title="Contrato de Monitoramento">
        <div className="p-8 flex flex-col flex-1">
          <div className="bg-blue-50 p-6 rounded-3xl mb-8 border border-blue-100">
            <p className="text-sm text-blue-900 leading-relaxed">Este app utiliza permissões de acessibilidade para monitorar o tempo de tela do sistema AITe de forma automática e inviolável.</p>
          </div>
          <button onClick={() => setView('HOME')} className="w-full py-5 bg-[#001F3F] text-white font-black rounded-2xl mt-auto">ESTOU CIENTE</button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={activeShift ? "Auditoria Ativa" : "Turno Offline"} showBack onBack={() => setView('LOGIN')}>
        <div className="p-5 flex-1 flex flex-col gap-4">
          {activeShift ? (
            <>
              {/* Painel de Diagnóstico da Ponte Nativa */}
              <div className="bg-white border border-gray-100 rounded-[32px] p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${lastBridgeSignal ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Ponte Nativa Android</span>
                   </div>
                   <button onClick={triggerSimulation} className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full text-gray-600 active:bg-gray-200">
                      {isAITeOpenInSystem ? 'SIMULAR: SAIR DO AITE' : 'SIMULAR: ENTRAR NO AITE'}
                   </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-500 ${isAITeOpenInSystem ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'}`}>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-800 tracking-tight">Status do App AITe</p>
                    <p className={`text-[11px] font-bold ${isAITeOpenInSystem ? 'text-blue-600' : 'text-gray-400'}`}>
                      {isAITeOpenInSystem ? 'EM PRIMEIRO PLANO (CONTANDO...)' : 'AGUARDANDO ABERTURA DO APP'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Métricas Grandes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-[32px] p-6 text-white text-center shadow-xl">
                  <p className="text-[9px] font-bold opacity-40 uppercase mb-1">Tempo Total</p>
                  <p className="text-3xl font-black">{(activeShift.metrics.totalTimeMs / 60000).toFixed(1)}<span className="text-xs opacity-50 ml-1">min</span></p>
                </div>
                <div className="bg-white rounded-[32px] p-6 border border-gray-100 text-center shadow-sm">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Acessos Reais</p>
                  <p className="text-3xl font-black text-gray-800">{activeShift.metrics.sessionCount}</p>
                </div>
              </div>

              {/* Log Técnico de Transição */}
              <div className="bg-gray-50 border border-gray-200 rounded-[32px] p-5 flex-1 flex flex-col min-h-0 shadow-inner">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest text-center">Histórico de Telemetria Nativa</p>
                 <div className="flex-1 overflow-y-auto space-y-3 px-1">
                    {auditLogs.map((log, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] border-b border-gray-100 pb-2">
                        <span className={`font-bold ${log.msg.includes('SINAL') ? 'text-blue-500' : 'text-gray-500'}`}>{log.msg}</span>
                        <span className="font-mono text-gray-400">{log.time}</span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p className="text-[10px] text-gray-300 italic text-center py-8">Nenhum evento registrado pelo Android.</p>}
                 </div>
              </div>

              <button onClick={() => setView('CLOSING')} className="w-full py-5 border-2 border-red-500 text-red-500 font-black rounded-3xl active:bg-red-500 active:text-white transition-all">ENCERRAR AUDITORIA</button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-8 border border-gray-100 shadow-inner">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-black mb-2">Monitor Pronto</h3>
              <p className="text-xs text-gray-400 mb-10">O sistema aguarda sua autorização para iniciar a coleta automática de dados nativos.</p>
              <button onClick={startShift} className="w-full py-5 bg-[#001F3F] text-white font-black rounded-[32px] shadow-2xl">INICIAR TURNO</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Fechamento">
        <form className="p-8 flex flex-col flex-1" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); submitClosing(Number(d.get('count')), d.get('obs') as string); }}>
          <div className="bg-gray-900 p-8 rounded-[40px] text-white mb-10 text-center shadow-xl">
            <p className="text-[10px] font-black opacity-30 uppercase mb-4">Relatório de Telemetria</p>
            <div className="flex justify-around">
               <div>
                  <span className="text-4xl font-black block">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase">Minutos</span>
               </div>
               <div className="w-px h-10 bg-white/10 my-auto"></div>
               <div>
                  <span className="text-4xl font-black block">{activeShift!.metrics.sessionCount}</span>
                  <span className="text-[10px] font-bold opacity-40 uppercase">Acessos</span>
               </div>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2">Total de AITs realizados:</label>
              <input name="count" type="number" required className="w-full p-5 bg-white border border-gray-200 rounded-3xl text-2xl font-black outline-none focus:border-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2">Notas Operacionais:</label>
              <textarea name="obs" rows={3} className="w-full p-4 bg-white border border-gray-200 rounded-3xl text-sm outline-none" placeholder="Ex: problemas com GPS ou rede"></textarea>
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-[#001F3F] text-white font-black rounded-3xl shadow-xl mt-auto">FINALIZAR E ENVIAR</button>
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
