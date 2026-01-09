
import React, { useState, useEffect, useCallback } from 'react';
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

  // Simulation of AUTOMATIC background monitoring
  // In a real Android app, this logic would be triggered by UsageStatsManager events.
  // Here we simulate the agent "using" the external app at random intervals while the shift is active.
  useEffect(() => {
    let interval: any;
    if (activeShift && activeShift.status === 'ACTIVE') {
      interval = setInterval(() => {
        // 30% chance of state change (simulating user opening/closing the other app)
        if (Math.random() > 0.7) {
          setIsAITeOpenInSystem(prev => !prev);
        }
      }, 5000);
    } else {
      setIsAITeOpenInSystem(false);
    }
    return () => clearInterval(interval);
  }, [activeShift?.id, activeShift?.status]);

  // Session Management based on "System Detection"
  useEffect(() => {
    if (!activeShift) return;

    if (isAITeOpenInSystem) {
      // System detected AITe app is now in foreground
      const lastSession = activeShift.sessions[activeShift.sessions.length - 1];
      if (!lastSession || lastSession.end) {
        const newSession: AITSession = {
          id: Math.random().toString(36).substr(2, 9),
          start: Date.now(),
          durationMs: 0
        };
        setActiveShift(prev => ({
          ...prev!,
          sessions: [...prev!.sessions, newSession]
        }));
      }
    } else {
      // System detected AITe app is now in background/closed
      const lastSessionIndex = activeShift.sessions.length - 1;
      const lastSession = activeShift.sessions[lastSessionIndex];
      if (lastSession && !lastSession.end) {
        const now = Date.now();
        const endedSession = { ...lastSession, end: now, durationMs: now - lastSession.start };
        const newSessions = [...activeShift.sessions];
        newSessions[lastSessionIndex] = endedSession;
        
        const totalTime = newSessions.reduce((acc, s) => acc + (s.end ? s.durationMs : (now - s.start)), 0);
        
        setActiveShift(prev => ({
          ...prev!,
          sessions: newSessions,
          metrics: {
            ...prev!.metrics,
            totalTimeMs: totalTime,
            sessionCount: newSessions.length,
            avgSessionTimeMs: totalTime / (newSessions.length || 1),
            lastAccess: now
          }
        }));
      }
    }
  }, [isAITeOpenInSystem]);

  // Update duration timer for active sessions
  useEffect(() => {
    let timer: any;
    if (activeShift && isAITeOpenInSystem) {
      timer = setInterval(() => {
        setActiveShift(prev => {
          if (!prev) return null;
          const lastIdx = prev.sessions.length - 1;
          const last = prev.sessions[lastIdx];
          if (last && !last.end) {
            const total = prev.sessions.reduce((acc, s, idx) => {
               if (idx === lastIdx) return acc + (Date.now() - s.start);
               return acc + (s.durationMs || 0);
            }, 0);
            return {
              ...prev,
              metrics: { ...prev.metrics, totalTimeMs: total }
            };
          }
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAITeOpenInSystem, activeShift?.id]);

  const handleLogin = (role: UserRole) => {
    const mockUser: UserProfile = {
      uid: 'user_123',
      name: role === UserRole.AGENTE ? 'Agente Silva' : 'Gestor Oliveira',
      matricula: role === UserRole.AGENTE ? '88.123-4' : '44.987-0',
      sector: 'Mobilidade Urbana - Centro',
      role,
      termsAccepted: false
    };
    setUser(mockUser);
    setView(role === UserRole.AGENTE ? 'TERMS' : 'MANAGER');
  };

  const acceptTerms = () => {
    if (user) {
      setUser({ ...user, termsAccepted: true, termsAcceptedAt: Date.now() });
      setView('HOME');
    }
  };

  const startShift = () => {
    const newShift: Shift = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user!.uid,
      userName: user!.name,
      startTime: Date.now(),
      status: 'ACTIVE',
      sessions: [],
      metrics: {
        totalTimeMs: 0,
        sessionCount: 0,
        avgSessionTimeMs: 0
      },
      flags: []
    };
    setActiveShift(newShift);
  };

  const endShift = () => {
    setView('CLOSING');
  };

  const submitClosing = (count: number, obs: string) => {
    if (!activeShift) return;

    const flags: string[] = [];
    const totalMinutes = activeShift.metrics.totalTimeMs / 60000;
    
    if (count > 0 && totalMinutes < 2) flags.push('FLAG 1: Multas declaradas com tempo de uso irrisório');
    if (count > 10 && activeShift.metrics.sessionCount < 2) flags.push('FLAG 2: Volume de multas incompatível com número de acessos');
    if (count > 0 && activeShift.metrics.totalTimeMs === 0) flags.push('FLAG 3: Multas declaradas sem nenhum registro de abertura do AITe');
    
    const finalizedShift: Shift = {
      ...activeShift,
      endTime: Date.now(),
      status: 'CLOSED',
      declaredAitCount: count,
      observations: obs,
      flags
    };

    setAllShifts(prev => [finalizedShift, ...prev]);
    setActiveShift(null);
    setIsAITeOpenInSystem(false);
    setView('HOME');
  };

  if (view === 'LOGIN') {
    return (
      <Layout title="Auditoria AITe">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div style={{ backgroundColor: COLORS.NAVY }} className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg">
             <span className="text-white text-3xl font-bold">AITe</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Auditoria Operacional</h2>
          <p className="text-gray-500 mb-8">O monitoramento automático será ativado após o início do turno.</p>
          
          <button 
            onClick={() => handleLogin(UserRole.AGENTE)}
            style={{ backgroundColor: COLORS.NAVY }}
            className="w-full py-4 text-white font-bold rounded-xl mb-4 android-shadow active:scale-95 transition-transform"
          >
            ENTRAR COMO AGENTE
          </button>
          
          <button 
            onClick={() => handleLogin(UserRole.GESTOR)}
            className="w-full py-4 border-2 border-[#001F3F] text-[#001F3F] font-bold rounded-xl android-shadow active:scale-95 transition-transform"
          >
            PAINEL DO GESTOR
          </button>
          
          <p className="mt-auto text-[10px] text-gray-400 uppercase tracking-widest">Tecnologia de Telemetria Passiva</p>
        </div>
      </Layout>
    );
  }

  if (view === 'TERMS') {
    return (
      <Layout title="Termo de Uso">
        <div className="p-6 flex flex-col flex-1">
          <div className="bg-gray-100 p-5 rounded-2xl border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-blue-600">🛡️</span> Monitoramento Automático
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Ao iniciar seu turno, este aplicativo coletará <strong>automaticamente</strong> em segundo plano:
            </p>
            <ul className="text-xs text-gray-500 space-y-3">
              <li className="flex gap-2">
                <span className="text-blue-500">✓</span> 
                Horários de abertura e fechamento do aplicativo oficial AITe.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500">✓</span> 
                Tempo de permanência em tela no sistema de lavratura.
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500">✓</span> 
                Inconsistências entre o uso do sistema e as multas declaradas.
              </li>
            </ul>
          </div>
          
          <div className="flex-1 flex items-start gap-3 p-2 bg-blue-50 rounded-xl mb-6">
            <input type="checkbox" id="agree" className="mt-1 w-5 h-5 rounded border-gray-300 text-[#001F3F]" />
            <label htmlFor="agree" className="text-sm text-blue-900 font-medium leading-tight">
              Estou ciente que o app funcionará de forma passiva coletando dados de uso do sistema de trânsito.
            </label>
          </div>

          <button 
            onClick={acceptTerms}
            style={{ backgroundColor: COLORS.NAVY }}
            className="w-full py-4 text-white font-bold rounded-xl mt-4 active:scale-95 shadow-lg"
          >
            ACEITAR E INICIAR
          </button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={`Agente: ${user?.name}`} showBack onBack={() => setView('LOGIN')}>
        <div className="p-6 flex-1 flex flex-col">
          {/* Status Badge */}
          <div className={`flex items-center justify-between p-4 rounded-2xl mb-6 shadow-sm border ${activeShift ? 'bg-green-50 border-green-100 text-green-800' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${activeShift ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-bold uppercase tracking-tight">
                {activeShift ? 'Monitoramento Ativo' : 'Turno Não Iniciado'}
              </span>
            </div>
            {activeShift && <span className="text-[10px] font-bold bg-green-200 px-2 py-0.5 rounded-full">LIVE</span>}
          </div>

          {activeShift ? (
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Tempo no AITe</p>
                  <p className="text-3xl font-black text-gray-800 tracking-tighter">
                    {Math.floor(activeShift.metrics.totalTimeMs / 60000)}<span className="text-sm ml-0.5 font-normal">min</span>
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Acessos Detectados</p>
                  <p className="text-3xl font-black text-gray-800 tracking-tighter">
                    {activeShift.metrics.sessionCount}
                  </p>
                </div>
              </div>

              {/* Automatic Activity Detection Visualization */}
              <div className="bg-[#001F3F] text-white p-6 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                </div>
                
                <div className="z-10 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {isAITeOpenInSystem ? (
                      <>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                        <p className="text-xs font-bold text-yellow-400 uppercase">App AITe em Uso agora</p>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <p className="text-xs font-bold text-blue-300 uppercase">Aguardando abertura do AITe</p>
                      </>
                    )}
                  </div>
                  <h4 className="text-lg font-medium opacity-80 leading-tight">O sistema está detectando sua atividade automaticamente</h4>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <button 
                  onClick={endShift}
                  className="w-full py-4 bg-white border-2 border-red-500 text-red-500 font-black rounded-2xl active:bg-red-50 shadow-sm transition-all"
                >
                  FINALIZAR EXPEDIENTE
                </button>
                <p className="text-center text-[10px] text-gray-400 mt-3 font-medium uppercase">Relatório final será exigido ao encerrar</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">Inicie seu Turno</h3>
              <p className="text-sm text-gray-500 mb-10 px-4 leading-relaxed">
                Ao clicar abaixo, o monitoramento automático de segundo plano será ativado. Você poderá usar o aplicativo <strong>AITe</strong> normalmente.
              </p>
              
              <button 
                onClick={startShift}
                style={{ backgroundColor: COLORS.NAVY }}
                className="w-full py-5 text-white font-black rounded-3xl android-shadow active:scale-[0.98] transition-all text-lg shadow-xl"
              >
                COMEÇAR AGORA
              </button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Fechamento de Turno">
        <form 
          className="p-6 flex flex-col flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            submitClosing(Number(formData.get('count')), formData.get('obs') as string);
          }}
        >
          <div className="bg-[#001F3F] p-5 rounded-3xl text-white mb-8 shadow-inner">
            <h4 className="text-[10px] font-black text-blue-300 uppercase mb-4 tracking-widest">Telemetria Consolidada</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] opacity-60 uppercase font-bold">Uso Líquido</p>
                <p className="text-xl font-black">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)} <span className="text-xs font-normal">min</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-60 uppercase font-bold">Sessões AITe</p>
                <p className="text-xl font-black">{activeShift!.metrics.sessionCount}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-200">
              <label className="block text-xs font-black text-gray-400 uppercase mb-2">
                Total de Multas Lavradas no Turno *
              </label>
              <input 
                name="count"
                type="number" 
                required
                autoFocus
                placeholder="Insira o número de AITs"
                className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#001F3F] text-xl font-bold"
              />
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-gray-200">
              <label className="block text-xs font-black text-gray-400 uppercase mb-2">
                Justificativas ou Observações
              </label>
              <textarea 
                name="obs"
                rows={4}
                placeholder="Houve algum problema técnico com o AITe ou falha de conexão?"
                className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#001F3F] text-sm"
              ></textarea>
            </div>
          </div>

          <div className="mt-auto pt-8">
            <button 
              type="submit"
              style={{ backgroundColor: COLORS.NAVY }}
              className="w-full py-5 text-white font-black rounded-3xl active:scale-[0.98] shadow-xl text-lg"
            >
              ENVIAR RELATÓRIO
            </button>
          </div>
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
