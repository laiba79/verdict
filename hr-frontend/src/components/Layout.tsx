import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ChatWidget from './ChatWidget';

const Layout = () => {
  return (
    <div className="relative flex h-screen bg-slate-50 dark:bg-ink-900 overflow-hidden">
      {/* Ambient floating background — subtle, low-opacity, ignores pointer events */}
      <div className="ambient-field">
        <div
          className="ambient-blob bg-primary-400 dark:bg-primary-400 animate-floatSlow"
          style={{ width: 420, height: 420, top: '-8%', left: '-6%' }}
        />
        <div
          className="ambient-blob bg-clay-400 animate-floatDrift"
          style={{ width: 320, height: 320, bottom: '-10%', right: '4%' }}
        />
        <div
          className="ambient-blob bg-approve-400 animate-floatSlower"
          style={{ width: 260, height: 260, top: '38%', right: '22%' }}
        />
      </div>

      <div className="relative z-10 flex w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-auto p-8">
            <Outlet />
          </main>
        </div>
        <ChatWidget />
      </div>
    </div>
  );
};

export default Layout;
