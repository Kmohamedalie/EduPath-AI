
import React, { useState, useRef, useEffect } from 'react';
import { GenerationState, Curriculum, SkillRating, UserProfile } from './types';
import { generateCurriculum } from './services/geminiService';
import { generateDossierHtml } from './services/exportService';
import ModuleCard from './components/ModuleCard';

type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<'Industry' | 'Academic' | 'Balanced'>('Balanced');
  const [experience, setExperience] = useState('Beginner');
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessment, setAssessment] = useState<SkillRating[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [activeModal, setActiveModal] = useState<'docs' | 'standards' | 'terms' | 'support' | 'signin' | 'profile' | null>(null);
  
  // Persisted Login States
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [savedPaths, setSavedPaths] = useState<Curriculum[]>([]);
  
  // UI States
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Ref to track the current request to allow for cancellation logic
  const activeRequestId = useRef<number>(0);

  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    curriculum: null
  });

  // Persist login state
  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    localStorage.setItem('userEmail', userEmail);
  }, [isLoggedIn, userEmail]);

  // Handle Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: Theme) => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(systemDark ? 'dark' : 'light');
      } else {
        root.classList.add(t);
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const handleDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const requestId = ++activeRequestId.current;
    setState({ ...state, isLoading: true, error: null });

    try {
      const curriculum = await generateCurriculum(query, focus, experience, assessment);
      
      // Only update state if this is still the active request
      if (requestId === activeRequestId.current) {
        setState({ isLoading: false, error: null, curriculum });
      }
    } catch (err: any) {
      if (requestId === activeRequestId.current) {
        setState({ isLoading: false, error: err.message, curriculum: null });
      }
    }
  };

  const handleStop = () => {
    activeRequestId.current++; // Incrementing the ID effectively "ignores" the current pending promise
    setState({ ...state, isLoading: false, error: "Generation cancelled by user." });
  };

  const toggleModuleCompletion = (moduleId: string) => {
    const toggleInCurriculum = (curr: Curriculum): Curriculum => ({
      ...curr,
      modules: curr.modules.map(m => m.id === moduleId ? { ...m, isCompleted: !m.isCompleted } : m)
    });

    if (state.curriculum) {
      const isModuleInActive = state.curriculum.modules.some(m => m.id === moduleId);
      if (isModuleInActive) {
        setState(prev => ({
          ...prev,
          curriculum: prev.curriculum ? toggleInCurriculum(prev.curriculum) : null
        }));
      }
    }

    setSavedPaths(prev => prev.map(path => {
      const isModuleInPath = path.modules.some(m => m.id === moduleId);
      return isModuleInPath ? toggleInCurriculum(path) : path;
    }));
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setAssessment([...assessment, { skill: newSkill, level: 3 }]);
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    setAssessment(assessment.filter((_, i) => i !== index));
  };

  const updateSkillLevel = (index: number, level: number) => {
    const next = [...assessment];
    next[index].level = level;
    setAssessment(next);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (userEmail.includes('@')) {
      setIsLoggingIn(true);
      // Mock a slight delay for better UX feel
      setTimeout(() => {
        setIsLoggedIn(true);
        setIsLoggingIn(false);
        setActiveModal(null);
      }, 800);
    }
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUserEmail('');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    setIsMobileMenuOpen(false);
  };

  const saveToProfile = () => {
    if (!isLoggedIn) {
      setActiveModal('signin');
      return;
    }
    if (state.curriculum) {
      // Check if already saved (based on specialization and overview for uniqueness)
      const alreadyExists = savedPaths.some(p => 
        p.specialization === state.curriculum?.specialization && 
        p.overview === state.curriculum?.overview
      );
      
      if (alreadyExists) {
        alert('This curriculum is already in your profile.');
        return;
      }

      const pathWithMeta = { ...state.curriculum, timestamp: Date.now() };
      setSavedPaths([pathWithMeta, ...savedPaths]);
      alert('Curriculum saved to your profile!');
    }
  };

  const handleExportDossier = () => {
    if (state.curriculum) {
      const dossierHtml = generateDossierHtml(state.curriculum);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(dossierHtml);
        printWindow.document.close();
      }
    }
  };

  const loadSavedPath = (path: Curriculum) => {
    setState({ ...state, curriculum: path });
    setActiveModal(null);
  };

  const calculateProgress = (curr: Curriculum) => {
    const completed = curr.modules.filter(m => m.isCompleted).length;
    return Math.round((completed / curr.modules.length) * 100);
  };

  const ThemeToggle = () => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
            theme === t 
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Universal Modal Container */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
                {activeModal === 'docs' && 'Platform Documentation'}
                {activeModal === 'standards' && 'Global Standards Library'}
                {activeModal === 'terms' && 'Terms of Service'}
                {activeModal === 'support' && 'Contact Support'}
                {activeModal === 'signin' && 'Sign In to EduPath'}
                {activeModal === 'profile' && 'Professional Profile'}
              </h2>
              <button 
                onClick={() => setActiveModal(null)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {activeModal === 'profile' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                      {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[200px]">{userEmail}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Architect Member since 2024</p>
                    </div>
                  </div>

                  <section>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Mastered Skill Map</h4>
                    {assessment.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {assessment.map((skill, i) => (
                          <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{skill.skill}</span>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">Lvl {skill.level}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-600" 
                                style={{ width: `${(skill.level / 5) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No skills tracked in your assessment yet.</p>
                    )}
                  </section>

                  <section>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Saved Roadmaps & Progress</h4>
                    {savedPaths.length > 0 ? (
                      <div className="space-y-4">
                        {savedPaths.map((path, i) => {
                          const progress = calculateProgress(path);
                          return (
                            <div key={i} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl group hover:border-blue-200 dark:hover:border-blue-500 transition-all shadow-sm">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-grow">
                                  <p className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{path.specialization}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                    Generated {new Date(path.timestamp || 0).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs font-black px-3 py-1 rounded-full ${
                                    progress === 100 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {progress}% Complete
                                  </span>
                                </div>
                              </div>
                              
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-5">
                                <div 
                                  className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'}`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>

                              <button 
                                onClick={() => loadSavedPath(path)}
                                className="w-full py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 text-slate-900 dark:text-white"
                              >
                                View Roadmap
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                        <p className="text-sm text-slate-400 font-medium">No saved curricula yet. Start architecting!</p>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeModal === 'signin' && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-slate-600 dark:text-slate-400">Enter your email to save your architectural roadmaps and sync across devices.</p>
                  </div>
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <div>
                      <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Email Address</label>
                      <input 
                        type="email" 
                        required
                        autoFocus
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none" 
                        placeholder="your@email.com"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full bg-slate-900 dark:bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-xl shadow-slate-200 dark:shadow-black/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
                    >
                      {isLoggingIn ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Signing In...
                        </>
                      ) : (
                        'Continue to EduPath'
                      )}
                    </button>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4">No password required • Instant Session Activation</p>
                  </form>
                </div>
              )}

              {activeModal === 'docs' && (
                <div className="space-y-6 text-slate-600 dark:text-slate-400 leading-relaxed">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-2">Adaptive Methodology</h3>
                    <p>EduPath AI uses complex reasoning to map career goals to some knowledge units. Our algorithms prioritize depth in areas identified through assessment.</p>
                  </div>
                  <section>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">How to architect your path:</h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Enter a high-level specialization (e.g., "Full Stack Web3 Development").</li>
                      <li>Use the <strong>Self-Assessment</strong> tool to define your current levels.</li>
                      <li>Choose your balance between industry and academic focus.</li>
                    </ol>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-900 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="bg-blue-600 p-2 rounded-xl group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-0.5">EduPath AI</h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-[0.2em]">Curriculum Architect</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6 text-sm font-bold mr-4">
              <button onClick={() => setActiveModal('docs')} className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</button>
              <button onClick={() => setActiveModal('standards')} className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Standards Library</button>
            </div>

            <div className="hidden md:block border-l border-slate-200 dark:border-slate-800 h-8 mr-4"></div>
            
            <div className="hidden md:flex items-center gap-4">
              <ThemeToggle />
              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveModal('profile')}
                    className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-sm font-black hover:scale-105 transition-transform shadow-sm"
                  >
                    {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                  </button>
                  <button onClick={handleSignOut} className="text-slate-400 dark:text-slate-500 hover:text-red-500 text-xs font-bold">Sign Out</button>
                </div>
              ) : (
                <button 
                  onClick={() => setActiveModal('signin')}
                  className="bg-slate-900 dark:bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md active:scale-95 text-sm font-bold"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile Burger Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in slide-in-from-top duration-300 z-40 backdrop-blur-lg bg-opacity-95 dark:bg-opacity-95">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <button onClick={() => { setActiveModal('docs'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300">Documentation</button>
                <button onClick={() => { setActiveModal('standards'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300">Standards Library</button>
                <button onClick={() => { setActiveModal('support'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300">Support</button>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Appearance</span>
                <ThemeToggle />
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
              {isLoggedIn ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-sm font-black">
                      {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{userEmail}</span>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => { setActiveModal('profile'); setIsMobileMenuOpen(false); }} className="text-blue-600 dark:text-blue-400 font-bold text-sm">Profile</button>
                    <button onClick={handleSignOut} className="text-red-500 font-bold text-sm">Sign Out</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => { setActiveModal('signin'); setIsMobileMenuOpen(false); }}
                  className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-bold text-center active:scale-[0.98] transition-transform"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow max-w-5xl mx-auto px-4 py-12 md:py-20 w-full">
        <section className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-[1.1]">
            Architect Your <span className="text-blue-600 dark:text-blue-500">Next Chapter</span>
          </h2>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Professional-grade curriculum design, synthesizing academic frameworks and job-market demand into a single cohesive path.
          </p>
        </section>

        {/* Search Engine Area */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 dark:shadow-black/20 p-6 md:p-10 mb-16 border border-slate-100 dark:border-slate-800 transition-colors">
          <form onSubmit={handleDesign} className="space-y-8">
            <div className="relative">
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Topic (e.g., Computer Vision)"
                className="w-full pl-6 pr-16 md:pr-60 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
              
              {state.isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="absolute right-3 top-3 bottom-3 bg-slate-800 dark:bg-slate-700 text-white px-4 md:px-8 rounded-xl font-black hover:bg-red-600 transition-all flex items-center gap-3 shadow-lg group"
                >
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden md:block">Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white px-4 md:px-8 rounded-xl font-black hover:bg-blue-700 transition-all flex items-center gap-3 shadow-lg shadow-blue-200 dark:shadow-blue-900/40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  <span className="hidden md:block">Architect Path</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Learning Paradigm</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                  {(['Academic', 'Balanced', 'Industry'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={state.isLoading}
                      onClick={() => setFocus(opt)}
                      className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${
                        focus === opt 
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                      } disabled:opacity-50`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Current Competency</label>
                <select
                  value={experience}
                  disabled={state.isLoading}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none px-5 py-4 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 cursor-pointer disabled:opacity-50"
                >
                  <option>Beginner (Fresh Start)</option>
                  <option>Undergraduate Student</option>
                  <option>Junior Professional</option>
                  <option>Senior Transitioning</option>
                </select>
              </div>
            </div>

            {/* Assessment Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
              <button
                type="button"
                disabled={state.isLoading}
                onClick={() => setShowAssessment(!showAssessment)}
                className={`flex items-center gap-3 text-sm font-black transition-all ${showAssessment ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'} disabled:opacity-50`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${showAssessment ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <svg className={`w-4 h-4 transition-transform ${showAssessment ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </div>
                {showAssessment ? 'Hide Self-Assessment Filters' : 'Activate Personalized Assessment'}
              </button>

              {showAssessment && (
                <div className="mt-6 p-6 md:p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                      <h4 className="text-slate-900 dark:text-white font-black">Skill Proficiency Map</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Fine-tune the curriculum by indicating your current mastery level.</p>
                    </div>
                    <div className="flex w-full md:w-auto gap-2">
                      <input
                        type="text"
                        disabled={state.isLoading}
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add skill (e.g. AWS)"
                        className="flex-grow md:w-64 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 outline-none disabled:opacity-50"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      />
                      <button
                        type="button"
                        disabled={state.isLoading}
                        onClick={addSkill}
                        className="px-6 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-slate-800 dark:hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-slate-200 dark:shadow-black/20 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  
                  {assessment.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                      <p className="text-slate-400 dark:text-slate-500 text-sm font-bold italic">No specific skills added yet. Add one above to start tailoring.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {assessment.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 group">
                          <div className="flex-grow">
                            <span className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{item.skill}</span>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" min="1" max="5" 
                                disabled={state.isLoading}
                                value={item.level} 
                                onChange={(e) => updateSkillLevel(idx, parseInt(e.target.value))}
                                className="flex-grow h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                              />
                              <span className="text-xs font-black text-blue-600 dark:text-blue-400 w-14 text-right">Lvl {item.level}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeSkill(idx)} 
                            disabled={state.isLoading}
                            className="p-2 text-slate-200 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Results Logic */}
        {state.error && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 p-6 rounded-3xl mb-12 flex items-start justify-between gap-4 animate-in shake duration-500">
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="font-black mb-1">Architectural Feedback</p>
                <p className="text-sm font-medium opacity-80">{state.error}</p>
              </div>
            </div>
            <button onClick={() => setState({...state, error: null})} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {state.isLoading && (
          <div className="space-y-8 animate-pulse">
            <div className="h-64 bg-white dark:bg-slate-900 rounded-[2.5rem] w-full border border-slate-100 dark:border-slate-800"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-3xl w-full border border-slate-100 dark:border-slate-800"></div>)}
              </div>
              <div className="h-96 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800"></div>
            </div>
          </div>
        )}

        {state.curriculum && !state.isLoading && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Curriculum Master Card */}
            <div className="bg-slate-900 dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-white border border-slate-800">
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex flex-wrap gap-4">
                    <span className="bg-blue-600/20 text-blue-400 border border-blue-600/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em]">
                      Validated Roadmap
                    </span>
                    <span className="bg-white/5 text-white/60 border border-white/10 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {state.curriculum.totalDuration}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={saveToProfile}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border border-white/10 active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>
                      Save to Profile
                    </button>
                    <button 
                      onClick={handleExportDossier}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4H5v4a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11v3m-3-3v3m-3-3v3M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2" /></svg>
                      Synergy Dossier
                    </button>
                  </div>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{state.curriculum.specialization}</h2>
                <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-4xl mb-10 font-medium">
                  {state.curriculum.overview}
                </p>
                
                {state.curriculum.adaptiveFocusReasoning && (
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 mb-10 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2">Architectural Logic</p>
                    <p className="text-sm italic text-slate-300 font-medium leading-relaxed">"{state.curriculum.adaptiveFocusReasoning}"</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Career Goal</span>
                    <span className="text-lg font-black text-white">{state.curriculum.targetRole}</span>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] -mr-64 -mt-64"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Learning Sequence</h3>
                  <span className="text-sm font-bold text-slate-400">{state.curriculum.modules.length} Modules Total</span>
                </div>
                <div className="space-y-4">
                  {state.curriculum.modules.map((module, index) => (
                    <ModuleCard key={module.id} module={module} index={index} onToggleCompletion={toggleModuleCompletion} />
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">Foundational Knowledge</h3>
                  <ul className="space-y-4">
                    {state.curriculum.prerequisites.map((p, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                        <div className="w-2 h-2 bg-blue-600 dark:bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">External Benchmarks</h3>
                  <div className="space-y-3">
                    {state.curriculum.suggestedCertifications.map((cert, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-500 transition-all">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138z" /></svg>
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">{cert}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleExportDossier}
                  className="w-full group flex items-center justify-center gap-3 py-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-[2rem] font-black transition-all text-sm active:scale-95"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4H5v4a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11v3m-3-3v3m-3-3v3M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2" /></svg>
                  Export Synergy Dossier
                </button>
              </div>
            </div>
          </div>
        )}

        {!state.curriculum && !state.isLoading && !state.error && (
          <div className="text-center py-32 opacity-20 group">
            <svg className="w-32 h-32 mx-auto text-slate-400 dark:text-slate-600 mb-8 group-hover:scale-110 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.283a2 2 0 01-1.631 0l-.628-.283a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547V10a2 2 0 012-2h12a2 2 0 012 2v5.428z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 3a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1V3z" />
            </svg>
            <p className="text-2xl font-black text-slate-400 dark:text-slate-600 tracking-tight">Ready to architect your expertise.</p>
          </div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-20 mt-20 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-600 p-2 rounded-xl">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">EduPath AI</h3>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-sm">
                Synthesis of world-class educational standards and industry demand for the ambitious lifelong learner.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">Resources</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-slate-500">
                <li><button onClick={() => setActiveModal('docs')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</button></li>
                <li><button onClick={() => setActiveModal('standards')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Standards Library</button></li>
                <li><button onClick={() => setActiveModal('support')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact Support</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">Legal</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-slate-500">
                <li><button onClick={() => setActiveModal('terms')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</button></li>
                <li><button onClick={() => setActiveModal('terms')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              © 2024 EduPath AI Research Lab. Powered by Gemini.
            </p>
            <div className="flex gap-6">
              {['Twitter', 'GitHub', 'LinkedIn'].map(p => (
                <a key={p} href="#" className="text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-black text-[10px] uppercase tracking-widest">{p}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
