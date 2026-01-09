
import React from 'react';
import { COLORS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onBack }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md h-[100vh] sm:h-[800px] bg-white rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border-x-0 sm:border-x-8 border-t-0 sm:border-t-8 border-b-0 sm:border-b-8 border-gray-800 relative">
        {/* Status Bar */}
        <div className="bg-[#001F3F] text-white px-4 py-1 text-xs flex justify-between items-center shrink-0">
          <span>10:45</span>
          <div className="flex gap-2">
            <span>📶</span>
            <span>🔋 85%</span>
          </div>
        </div>

        {/* Toolbar */}
        <header style={{ backgroundColor: COLORS.NAVY }} className="text-white px-4 py-4 flex items-center shadow-md shrink-0">
          {showBack && (
            <button onClick={onBack} className="mr-4 p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-bold truncate">{title}</h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
          {children}
        </main>

        {/* Navigation Bar (Android style) */}
        <nav className="bg-white border-t border-gray-200 py-3 flex justify-around shrink-0">
          <div className="w-4 h-4 border-2 border-gray-400 rounded-sm"></div>
          <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
          <div className="w-4 h-4 border-b-2 border-r-2 border-gray-400 rotate-45 transform -translate-y-1"></div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
