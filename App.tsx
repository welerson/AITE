
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
  
  const lastStateChangeRef = useRef<number>(0);

  // Função para adicionar logs de auditoria
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{msg, time}, ...prev].slice(0, 5));
  };

  // Simulação de Sincronização Cloud
  const syncToCloud = async (data: any) => {
    setIsSyncing(true);
    // Em produção: await addDoc(collection(db, "turnos"), data);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSyncing(false);
  };

  // ESCUTADOR DO SISTEMA ANDROID (PONTE ACESSIBILIDADE)
  // Este evento é disparado pelo código Nativo do Android
  useEffect(() => {
    const handleAndroidEvent = (e: any) => {
      // e.detail.appName == 'AITe' ? true : false
      if (e.detail && e.detail.packageName === 'br.gov.aite') {
        setIsAITeOpenInSystem(e.detail.isForeground);
      }
    };

    window.addEventListener('android_foreground_event', handleAndroidEvent);
    return () => window.removeEventListener('android_foreground_event', handleAndroidEvent);
  }, []);

  // LÓGICA DE TELEMETRIA AUTOMÁTICA
  useEffect(() => {
    if (!activeShift || activeShift.status !== 'ACTIVE') return;

    const now = Date.now();
    // Proteção contra oscilações rápidas (debounce de 1.5s)
    if (now - lastStateChangeRef.current < 1500) return;

    if (isAITeOpenInSystem) {
      const lastSession = activeShift.sessions[activeShift.sessions.length - 1];
      if (!lastSession || lastSession.end) {
        const newSession: AITSession = {
          id: `sess_${now}`,
          start: now,
          durationMs: 0
        };
        const updated = { ...activeShift, sessions: [...activeShift.sessions, newSession] };
        setActiveShift(updated);
        lastStateChangeRef.current = now;
        addLog("SISTEMA: AITe detectado em tela");
        syncToCloud(updated);
      }
    } else {
      const lastSessionIndex = activeShift.sessions.length - 1;
      const lastSession = activeShift.sessions[lastSessionIndex];
      
      if (lastSession && !lastSession.end) {
        const duration = now - lastSession.start;
        
        // Filtro: Acessos menores que 2s não contam como trabalho real (evita burlas rápidas)
        if (duration > 2000) {
          const endedSession = { ...lastSession, end: now, durationMs: duration };
          const newSessions = [...activeShift.sessions];
          newSessions[lastSessionIndex] = endedSession;
          
          const totalTime = newSessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          
          const updated: Shift = {
            ...activeShift,
            sessions: newSessions,
            metrics: {
              ...activeShift.metrics,
              totalTimeMs: totalTime,
              sessionCount: newSessions.length,
              avgSessionTimeMs: totalTime / newSessions.length,
              lastAccess: now
            }
          };
          setActiveShift(updated);
          lastStateChangeRef.current = now;
          addLog(`SISTEMA: AITe minimizado (${(duration/1000).toFixed(1)}s)`);
          syncToCloud(updated);
        } else {
          const newSessions = activeShift.sessions.filter(s => s.id !== lastSession.id);
          setActiveShift(prev => prev ? { ...prev, sessions: newSessions } : null);
          lastStateChangeRef.current = now;
        }
      }
    }
  }, [isAITeOpenInSystem]);

  // Cronômetro Visual de Tempo de Tela
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
    addLog("AUDITORIA ATIVADA PELO AGENTE");
    syncToCloud(newShift);
  };

  // FUNÇÃO DE TESTE (APENAS PARA VOCÊ TESTAR NO NAVEGADOR AGORA)
  const triggerSimulation = () => {
    const event = new CustomEvent('android_foreground_event', { 
      detail: { packageName: 'br.gov.aite', isForeground: !isAITeOpenInSystem } 
    });
    window.dispatchEvent(event);
  };

  // Fix: Implementação da função submitClosing para finalizar o turno
  const submitClosing = async (count: number, obs: string) => {
    if (!activeShift) return;

    const now = Date.now();
    const finalShift: Shift = {
      ...activeShift,
      status: 'CLOSED',
      endTime: now,
      declaredAitCount: count,
      observations: obs,
      flags: []
    };

    // Lógica de detecção de fraudes simples
    if (count > 0 && finalShift.metrics.totalTimeMs < 30000) {
      finalShift.flags.push("Tempo de uso insuficiente para a produtividade declarada.");
    }
    if (count > 0 && finalShift.metrics.sessionCount === 0) {
      finalShift.flags.push("Nenhuma sessão de uso registrada mas AITs foram informados.");
    }

    setAllShifts(prev => [...prev, finalShift]);
    setActiveShift(null);
    setView('HOME');
    addLog("TURNO ENCERRADO E DADOS ENVIADOS");
    await syncToCloud(finalShift);
  };

  if (view === 'LOGIN') {
    return (
      <Layout title="Android Auditor">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
          <div style={{ backgroundColor: COLORS.NAVY }} className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-12 shadow-2xl">
             <span className="text-white text-4xl font-black">A</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Acesso Restrito</h2>
          <p className="text-gray-400 text-sm mb-12 px-6">Aplicativo de monitoramento obrigatório para agentes de trânsito.</p>
          <button onClick={() => handleLogin(UserRole.AGENTE)} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-3xl mb-4 shadow-xl active:scale-95 transition-all">INICIAR COMO AGENTE</button>
          <button onClick={() => handleLogin(UserRole.GESTOR)} className="w-full py-5 border-2 border-[#001F3F] text-[#001F3F] font-black rounded-3xl active:scale-95 transition-all">PAINEL GESTOR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'TERMS') {
    return (
      <Layout title="Termos de Auditoria">
        <div className="p-8 flex flex-col flex-1">
          <div className="bg-red-50 p-6 rounded-3xl mb-8 border border-red-100">
            <h3 className="font-bold text-red-900 mb-3 text-lg italic">Aviso de Monitoramento:</h3>
            <p className="text-xs text-red-800 leading-relaxed font-medium">Este dispositivo está configurado para registrar automaticamente todo o tempo de permanência no sistema AITe. A tentativa de desativação do monitoramento será reportada como falta funcional.</p>
          </div>
          <button onClick={() => { setUser({...user!, termsAccepted: true}); setView('HOME'); }} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-3xl mt-auto shadow-2xl">ESTOU CIENTE E OPERANTE</button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={activeShift ? "Auditoria em Curso" : "Monitor de Turno"} showBack onBack={() => setView('LOGIN')}>
        <div className="p-6 flex-1 flex flex-col">
          {activeShift ? (
            <div className="flex-1 flex flex-col gap-6">
              {/* Cloud Status */}
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cloud: {isSyncing ? 'Sincronizando' : 'Seguro'}</span>
                </div>
                <button onClick={triggerSimulation} className="text-[10px] text-gray-300 font-bold uppercase underline">Simular Sistema (Dev)</button>
              </div>

              {/* AUTOMATIC STATUS - SEM BOTÃO PARA O AGENTE */}
              <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 text-center relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-3 h-full transition-colors duration-700 ${isAITeOpenInSystem ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
                <div className="flex flex-col items-center">
                    {isAITeOpenInSystem ? (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                           <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                           <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                        </div>
                    )}
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Estado Atual</p>
                    <h4 className={`text-2xl font-black tracking-tight ${isAITeOpenInSystem ? 'text-blue-600' : 'text-gray-400'}`}>
                    {isAITeOpenInSystem ? 'AITe EM TELA' : 'SISTEMA OCULTO'}
                    </h4>
                </div>
              </div>

              {/* Large Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#001F3F] p-8 rounded-[40px] text-white text-center shadow-2xl">
                  <p className="text-[10px] opacity-40 uppercase font-bold mb-1">Tempo Total</p>
                  <p className="text-4xl font-black">{(activeShift.metrics.totalTimeMs / 60000).toFixed(1)}<span className="text-lg opacity-50">m</span></p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Acessos Reais</p>
                  <p className="text-4xl font-black text-gray-800">{activeShift.metrics.sessionCount}</p>
                </div>
              </div>

              {/* Anti-fraud Protection Logs */}
              <div className="bg-gray-50 rounded-[32px] p-6 border border-gray-200 flex-1 flex flex-col min-h-0 shadow-inner">
                <div className="flex justify-between items-center mb-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Logs de Acessibilidade</p>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-ping"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4">
                  {auditLogs.map((log, i) => (
                    <div key={i} className="flex justify-between items-start border-b border-gray-200 pb-2">
                      <p className="text-[11px] text-gray-600 font-bold max-w-[70%]">
                        {log.msg.includes('SISTEMA') ? '🛡️ ' : '👤 '} {log.msg}
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono font-bold">{log.time}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-gray-300 italic text-center py-6">Aguardando eventos do sistema Android...</p>}
                </div>
              </div>

              <button onClick={() => setView('CLOSING')} className="w-full py-5 border-2 border-red-600 text-red-600 font-black rounded-[24px] hover:bg-red-50 transition-colors">FECHAR TURNO E ENVIAR</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-10 border border-gray-100 text-[#001F3F] shadow-xl">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               </div>
               <h3 className="text-2xl font-black text-gray-900 mb-4">Pronto para a Escala?</h3>
               <p className="text-sm text-gray-400 mb-12 px-10">Ao clicar em ativar, o monitoramento de acessos será iniciado automaticamente pelo sistema.</p>
               <button onClick={startShift} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-[32px] shadow-2xl active:scale-95 transition-all text-xl tracking-tight">ATIVAR AUDITORIA</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Relatório Final">
        <form className="p-8 flex flex-col flex-1" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); submitClosing(Number(d.get('count')), d.get('obs') as string); }}>
          <div className="bg-[#001F3F] p-8 rounded-[48px] text-white mb-10 shadow-2xl">
            <p className="text-[10px] font-black opacity-30 uppercase mb-6 tracking-widest text-center">Resumo da Telemetria</p>
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <span className="text-5xl font-black block">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)}</span>
                <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Minutos de Tela</span>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="text-center flex-1">
                <span className="text-5xl font-black block">{activeShift!.metrics.sessionCount}</span>
                <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Acessos Reais</span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Total de Multas Digitadas:</label>
              <input name="count" type="number" required placeholder="0" className="w-full p-6 bg-white border-2 border-gray-100 rounded-[28px] text-3xl font-black focus:border-[#001F3F] outline-none shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Ocorrências Adicionais:</label>
              <textarea name="obs" rows={3} placeholder="Algum erro no sistema?" className="w-full p-6 bg-white border-2 border-gray-100 rounded-[28px] text-sm focus:border-[#001F3F] outline-none shadow-sm"></textarea>
            </div>
          </div>
          <button type="submit" style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-[32px] shadow-xl mt-auto text-lg tracking-tight">SUBMETER AUDITORIA</button>
        </form>
      </Layout>
    );
  }

  if (view === 'MANAGER') {
    return (
      <Layout title="Dashboard do Gestor" showBack onBack={() => setView('LOGIN')}>
        <ManagerDashboard shifts={allShifts} />
      </Layout>
    );
  }

  return null;
};

export default App;
