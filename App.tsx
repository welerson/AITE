
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, UserRole, Shift, AITSession } from './types';
import Layout from './components/Layout';
import { COLORS } from './constants';
import ManagerDashboard from './components/ManagerDashboard';

// NOTA PARA O USUÁRIO: Para usar o Firebase real, você deve descomentar a seção abaixo 
// e preencher com seus dados do Firebase Console.
/*
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
*/

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isAITeOpenInSystem, setIsAITeOpenInSystem] = useState(false);
  const [view, setView] = useState<'LOGIN' | 'TERMS' | 'HOME' | 'CLOSING' | 'MANAGER'>('LOGIN');
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<{msg: string, time: string}[]>([]);
  
  const lastStateChangeRef = useRef<number>(0);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setAuditLogs(prev => [{msg, time}, ...prev].slice(0, 4));
  };

  // Lógica de Sincronização (Aqui entraria a chamada ao Firestore)
  const syncToCloud = async (data: any) => {
    setIsSyncing(true);
    console.log("Sincronizando com Firestore...", data);
    
    // Simulação de delay de rede
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Exemplo Real:
    // await addDoc(collection(db, "turnos"), data);
    
    setIsSyncing(false);
  };

  useEffect(() => {
    if (!activeShift || activeShift.status !== 'ACTIVE') return;

    const now = Date.now();
    if (now - lastStateChangeRef.current < 1500) return;

    if (isAITeOpenInSystem) {
      const lastSession = activeShift.sessions[activeShift.sessions.length - 1];
      if (!lastSession || lastSession.end) {
        const newSession: AITSession = {
          id: `sess_${now}`,
          start: now,
          durationMs: 0
        };
        const updatedShift = {
          ...activeShift,
          sessions: [...activeShift.sessions, newSession]
        };
        setActiveShift(updatedShift);
        lastStateChangeRef.current = now;
        addLog("AITe Detectado");
        syncToCloud(updatedShift); // Persiste a abertura
      }
    } else {
      const lastSessionIndex = activeShift.sessions.length - 1;
      const lastSession = activeShift.sessions[lastSessionIndex];
      
      if (lastSession && !lastSession.end) {
        const duration = now - lastSession.start;
        
        if (duration > 2000) {
          const endedSession = { ...lastSession, end: now, durationMs: duration };
          const newSessions = [...activeShift.sessions];
          newSessions[lastSessionIndex] = endedSession;
          
          const totalTime = newSessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
          
          const updatedShift: Shift = {
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
          setActiveShift(updatedShift);
          lastStateChangeRef.current = now;
          addLog(`Encerrado (${(duration/1000).toFixed(1)}s)`);
          syncToCloud(updatedShift); // Persiste o fechamento
        } else {
          const newSessions = activeShift.sessions.filter(s => s.id !== lastSession.id);
          setActiveShift(prev => prev ? { ...prev, sessions: newSessions } : null);
          lastStateChangeRef.current = now;
        }
      }
    }
  }, [isAITeOpenInSystem]);

  // Restante da lógica de UI...
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
    addLog("Turno Iniciado");
    syncToCloud(newShift);
  };

  const submitClosing = (count: number, obs: string) => {
    if (!activeShift) return;
    const finalized: Shift = {
      ...activeShift,
      endTime: Date.now(),
      status: 'CLOSED',
      declaredAitCount: count,
      observations: obs,
      flags: (count > 0 && activeShift.metrics.totalTimeMs < 60000) ? ['Inconsistência Tempo vs Multas'] : []
    };
    setAllShifts(prev => [finalized, ...prev]);
    syncToCloud(finalized);
    setActiveShift(null);
    setAuditLogs([]);
    setView('HOME');
  };

  if (view === 'LOGIN') {
    return (
      <Layout title="Controle AITe">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
          <div style={{ backgroundColor: COLORS.NAVY }} className="w-20 h-20 rounded-3xl flex items-center justify-center mb-10 shadow-2xl rotate-2">
             <span className="text-white text-3xl font-black">A</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Login Operacional</h2>
          <p className="text-gray-400 text-sm mb-12 px-4 italic">Seu turno monitorado começa aqui.</p>
          <button onClick={() => handleLogin(UserRole.AGENTE)} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-2xl mb-4 shadow-lg active:scale-95 transition-all">SOU AGENTE</button>
          <button onClick={() => handleLogin(UserRole.GESTOR)} className="w-full py-5 border-2 border-[#001F3F] text-[#001F3F] font-black rounded-2xl active:scale-95 transition-all">SOU GESTOR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'TERMS') {
    return (
      <Layout title="Termos de Uso">
        <div className="p-8 flex flex-col flex-1">
          <div className="bg-gray-900 p-6 rounded-3xl mb-8">
            <h3 className="font-bold text-white mb-3 text-lg">⚠️ Monitoramento Ativo</h3>
            <p className="text-xs text-gray-300 leading-relaxed opacity-80">Ao iniciar o turno, este dispositivo registrará automaticamente os horários de tela do aplicativo AITe para fins de auditoria e produtividade.</p>
          </div>
          <button onClick={() => { setUser({...user!, termsAccepted: true}); setView('HOME'); }} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-2xl mt-auto shadow-xl">ACEITO E INICIAR</button>
        </div>
      </Layout>
    );
  }

  if (view === 'HOME') {
    return (
      <Layout title={activeShift ? "Em Operação" : "Início de Turno"} showBack onBack={() => setView('LOGIN')}>
        <div className="p-6 flex-1 flex flex-col">
          {activeShift ? (
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Firestore {isSyncing ? 'Sincronizando...' : 'Conectado'}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">ID: {activeShift.id.slice(-6)}</span>
              </div>

              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 text-center relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${isAITeOpenInSystem ? 'bg-yellow-400' : 'bg-green-500'}`}></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Aplicação AITe</p>
                <h4 className={`text-xl font-black ${isAITeOpenInSystem ? 'text-yellow-600' : 'text-green-600'}`}>
                   {isAITeOpenInSystem ? 'EM USO NO MOMENTO' : 'SISTEMA EM ESPERA'}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-8 rounded-[40px] text-white text-center shadow-2xl">
                  <p className="text-[10px] opacity-40 uppercase font-bold mb-1">Total Minutos</p>
                  <p className="text-4xl font-black">{(activeShift.metrics.totalTimeMs / 60000).toFixed(1)}</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Acessos</p>
                  <p className="text-4xl font-black text-gray-800">{activeShift.metrics.sessionCount}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
                <button 
                  onClick={() => setIsAITeOpenInSystem(!isAITeOpenInSystem)}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-md ${isAITeOpenInSystem ? 'bg-red-500 text-white' : 'bg-[#001F3F] text-white'}`}
                >
                  {isAITeOpenInSystem ? 'SAIR DO AITe (Simular)' : 'ENTRAR NO AITe (Simular)'}
                </button>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-gray-100 flex-1 flex flex-col min-h-0 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Monitoramento em Tempo Real</p>
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">Live</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {auditLogs.map((log, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-2">
                      <span className="text-xs text-gray-700 font-medium tracking-tight"> {log.msg}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{log.time}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-gray-300 italic text-center py-4">Aguardando atividade operacional...</p>}
                </div>
              </div>

              <button onClick={() => setView('CLOSING')} className="w-full py-5 border-2 border-red-500 text-red-500 font-black rounded-3xl active:bg-red-500 active:text-white transition-all">ENCERRAR E ENVIAR AO GESTOR</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
               <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-8 border border-gray-100 text-[#001F3F] shadow-sm">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-5.09 3.302-9.305 6.516-12.018" /></svg>
               </div>
               <h3 className="text-2xl font-black text-gray-900 mb-2">Turno em Espera</h3>
               <p className="text-sm text-gray-400 mb-10 px-6">Clique abaixo para iniciar a coleta automática de dados.</p>
               <button onClick={startShift} style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-[32px] shadow-2xl active:scale-95 transition-all text-lg">ATIVAR AGORA</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'CLOSING') {
    return (
      <Layout title="Resumo Final">
        <form className="p-8 flex flex-col flex-1" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); submitClosing(Number(d.get('count')), d.get('obs') as string); }}>
          <div className="bg-[#001F3F] p-8 rounded-[40px] text-white mb-10 shadow-2xl">
            <p className="text-[10px] font-bold opacity-40 uppercase mb-4 tracking-widest text-center">Dados Coletados no Cloud</p>
            <div className="flex justify-between items-center">
              <div className="text-center flex-1 border-r border-white/10">
                <span className="text-4xl font-black block">{(activeShift!.metrics.totalTimeMs / 60000).toFixed(1)}</span>
                <span className="text-[10px] font-bold opacity-60 uppercase">Minutos</span>
              </div>
              <div className="text-center flex-1">
                <span className="text-4xl font-black block">{activeShift!.metrics.sessionCount}</span>
                <span className="text-[10px] font-bold opacity-60 uppercase">Acessos</span>
              </div>
            </div>
          </div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Total de AITs Lavrados:</label>
          <input name="count" type="number" required placeholder="Ex: 12" className="w-full p-6 bg-white border-2 border-gray-100 rounded-3xl mb-8 text-2xl font-black focus:border-[#001F3F] outline-none transition-all shadow-sm" />
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Observações:</label>
          <textarea name="obs" rows={3} placeholder="Ocorreu algum problema?" className="w-full p-5 bg-white border-2 border-gray-100 rounded-3xl mb-8 text-sm focus:border-[#001F3F] outline-none shadow-sm"></textarea>
          <button type="submit" style={{ backgroundColor: COLORS.NAVY }} className="w-full py-5 text-white font-black rounded-3xl shadow-xl mt-auto">SINCRONIZAR E FINALIZAR</button>
        </form>
      </Layout>
    );
  }

  if (view === 'MANAGER') {
    return (
      <Layout title="Dashboard de Gestão" showBack onBack={() => setView('LOGIN')}>
        <ManagerDashboard shifts={allShifts} />
      </Layout>
    );
  }

  return null;
};

export default App;
