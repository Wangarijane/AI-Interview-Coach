import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewInterview from './pages/NewInterview';
import PracticeSession from './pages/PracticeSession';
import LiveSession from './pages/LiveSession';
import Review from './pages/Review';
import { useAuth } from './hooks/useAuth';
import { Home, Briefcase, FilePlus, LogOut, User as UserIcon, LogIn, Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-100 font-sans">
        <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
        <main className="flex-1 flex flex-col overflow-hidden">
           {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between bg-primary-600 text-white p-4 shadow-md">
              <div className="flex items-center">
                  <Briefcase className="h-7 w-7 mr-2" />
                  <span className="text-xl font-semibold">AI Coach</span>
              </div>
              <button onClick={() => setIsSidebarOpen(true)} className="p-1" aria-label="Open menu">
                  <Menu className="h-6 w-6" />
              </button>
          </header>
          <div className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<NewInterview />} />
              <Route path="/session/:id" element={<PracticeSession />} />
              <Route path="/live/:id" element={<LiveSession />} />
              <Route path="/review/:id" element={<Review />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

// Sidebar component props
interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

// Reusable content part of the sidebar
const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const location = useLocation();
    const { user, signInWithGoogle, signOut } = useAuth();

    const navItems = [
        { href: '/', icon: Home, label: 'Dashboard' },
        { href: '/new', icon: FilePlus, label: 'New Interview' }
    ];

    return (
        <div className="flex flex-col w-64 h-full">
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-600 text-white">
                <Briefcase className="h-8 w-8 mr-2" />
                <span className="text-2xl font-semibold">AI Coach</span>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto bg-white border-r border-gray-200">
                <nav className="flex-1 px-2 py-4 space-y-1">
                    {navItems.map(item => (
                        <Link
                            key={item.label}
                            to={item.href}
                            onClick={onNavigate}
                            className={`flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                                location.pathname === item.href
                                    ? 'bg-primary-100 text-primary-700 font-semibold'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            <item.icon className="mr-3 h-6 w-6" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="mt-auto p-2 border-t border-gray-200">
                    {user ? (
                        <>
                            <div className="p-2 rounded-md hover:bg-gray-100">
                                <div className="flex items-center">
                                    {user?.photoURL ? (
                                        <img className="h-8 w-8 rounded-full" src={user.photoURL} alt="User avatar" />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                            <UserIcon className="h-5 w-5 text-gray-500"/>
                                        </div>
                                    )}
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{user?.displayName || "User"}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { signOut(); onNavigate?.(); }}
                                className="w-full mt-2 flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-red-100 hover:text-red-700 transition-colors duration-150"
                            >
                                <LogOut className="mr-3 h-6 w-6" />
                                Sign Out
                            </button>
                        </>
                    ) : (
                         <div className="p-2">
                            <p className="text-sm text-center text-gray-600 mb-3">Sign in to save your progress and track your history.</p>
                            <button
                                onClick={() => { signInWithGoogle(); onNavigate?.(); }}
                                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                                <LogIn className="w-5 h-5 mr-2" />
                                Sign in with Google
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// The main Sidebar component that handles responsiveness
const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
    return (
        <>
            {/* Mobile Sidebar: Overlay and sliding panel */}
            <div className={`fixed inset-0 z-40 md:hidden transition-all ease-in-out duration-300 ${isSidebarOpen ? 'block' : 'hidden'}`}>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setIsSidebarOpen(false)}></div>
                
                {/* Sliding panel */}
                <div className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transform transition-transform ease-in-out duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                        <button onClick={() => setIsSidebarOpen(false)} className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" aria-label="Close sidebar">
                            <X className="h-6 w-6 text-white" />
                        </button>
                    </div>
                    <SidebarContent onNavigate={() => setIsSidebarOpen(false)} />
                </div>
            </div>

            {/* Desktop Sidebar: Static */}
            <aside className="hidden md:flex md:flex-shrink-0">
                <SidebarContent />
            </aside>
        </>
    );
};


export default App;