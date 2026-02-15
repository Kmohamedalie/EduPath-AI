import React, { useState, useRef, useEffect } from 'react';
import { GenerationState, Curriculum, SkillRating, ReminderFrequency } from './types';
import { generateCurriculum } from './services/geminiService';
import { generateDossierHtml } from './services/exportService';
import ModuleCard from './components/ModuleCard';

type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  // Persistence Layer: Load state from localStorage on init
  const [query, setQuery] = useState(() => localStorage.getItem('edupath_query') || '');
  const [focus, setFocus] = useState<'Industry' | 'Academic' | 'Balanced'>(() => 
    (localStorage.getItem('edupath_focus') as any) || 'Balanced'
  );
  const [experience, setExperience] = useState(() => localStorage.getItem('edupath_experience') || 'Beginner');
  const [assessment, setAssessment] = useState<SkillRating[]>(() => {
    try {
      const saved = localStorage.getItem('edupath_assessment');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showAssessment, setShowAssessment] = useState(assessment.length > 0);
  const [newSkill, setNewSkill] = useState('');
  const [activeModal, setActiveModal] = useState<'docs' | 'standards' | 'terms' | 'privacy' | 'support' | 'signin' | 'profile' | 'refine' | null>(null);
  const [refineQuery, setRefineQuery] = useState('');
  
  // Buzz System State
  const [activeBuzz, setActiveBuzz] = useState<Curriculum | null>(null);

  // Persisted Login States
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [savedPaths, setSavedPaths] = useState<Curriculum[]>(() => {
    try {
      const saved = localStorage.getItem('savedPaths');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse saved paths:", e);
      return [];
    }
  });
  
  // UI States
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Ref to track the current request to allow for cancellation logic
  const activeRequestId = useRef<number>(0);

  // Persistence Layer: Cache active curriculum workspace
  const [state, setState] = useState<GenerationState>(() => {
    try {
      const cached = localStorage.getItem('edupath_active_curriculum');
      return {
        isLoading: false,
        error: null,
        curriculum: cached ? JSON.parse(cached) : null
      };
    } catch {
      return { isLoading: false, error: null, curriculum: null };
    }
  });

  // Effect: Persist workspace input values
  useEffect(() => {
    localStorage.setItem('edupath_query', query);
    localStorage.setItem('edupath_focus', focus);
    localStorage.setItem('edupath_experience', experience);
    localStorage.setItem('edupath_assessment', JSON.stringify(assessment));
  }, [query, focus, experience, assessment]);

  // Effect: Persist active curriculum state (including covered module progress)
  useEffect(() => {
    if (state.curriculum) {
      localStorage.setItem('edupath_active_curriculum', JSON.stringify(state.curriculum));
    }
  }, [state.curriculum]);

  // Effect: Persist user profile and library
  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('savedPaths', JSON.stringify(savedPaths));
  }, [isLoggedIn, userEmail, savedPaths]);

  // Momentum Check Logic (The Buzz)
  useEffect(() => {
    if (savedPaths.length > 0) {
      const now = Date.now();
      const dueCheck = savedPaths.find(path => {
        if (!path.reminderFrequency || path.reminderFrequency === 'None') return false;
        const last = path.lastCheckIn || path.timestamp || now;
        const intervals: Record<string, number> = {
          'Weekly': 7 * 24 * 60 * 60 * 1000,
          'Monthly': 30 * 24 * 60 * 60 * 1000,
          'Yearly': 365 * 24 * 60 * 60 * 1000
        };
        const interval = intervals[path.reminderFrequency];
        return interval !== undefined && (now - last) >= interval;
      });

      if (dueCheck && !activeBuzz) {
        setActiveBuzz(dueCheck);
      }
    }
  }, [savedPaths, activeBuzz]);

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

  const handleDesign = async (e?: React.FormEvent, isRefinement = false) => {
    e?.preventDefault();
    if (!isRefinement && !query.trim()) return;
    if (isRefinement && !refineQuery.trim()) return;

    const requestId = ++activeRequestId.current;
    setState({ ...state, isLoading: true, error: null });
    if (isRefinement) setActiveModal(null);

    try {
      const curriculum = await generateCurriculum(
        query, 
        focus, 
        experience, 
        assessment, 
        isRefinement ? refineQuery : undefined,
        isRefinement ? state.curriculum : null
      );
      
      if (requestId === activeRequestId.current) {
        setState({ isLoading: false, error: null, curriculum });
        if (isRefinement) setRefineQuery('');
      }
    } catch (err: any) {
      if (requestId === activeRequestId.current) {
        setState({ isLoading: false, error: err.message, curriculum: null });
      }
    }
  };

  const handleStop = () => {
    activeRequestId.current++;
    setState({ ...state, isLoading: false, error: "Generation cancelled by user." });
  };

  const toggleModuleCompletion = (moduleId: string) => {
    const toggleInCurriculum = (curr: Curriculum): Curriculum => ({
      ...curr,
      modules: curr.modules.map(m => m.id === moduleId ? { ...m, isCompleted: !m.isCompleted } : m)
    });

    if (state.curriculum) {
      setState(prev => ({
        ...prev,
        curriculum: prev.curriculum ? toggleInCurriculum(prev.curriculum) : null
      }));
    }

    setSavedPaths(prev => prev.map(path => {
      const isModuleInPath = path.modules.some(m => m.id === moduleId);
      return isModuleInPath ? toggleInCurriculum(path) : path;
    }));
  };

  const updateReminder = (pathIndex: number, frequency: ReminderFrequency) => {
    const newPaths = [...savedPaths];
    newPaths[pathIndex] = { 
      ...newPaths[pathIndex], 
      reminderFrequency: frequency,
      lastCheckIn: Date.now() 
    };
    setSavedPaths(newPaths);
  };

  const acknowledgeBuzz = (path: Curriculum) => {
    const idx = savedPaths.findIndex(p => p.specialization === path.specialization && p.timestamp === path.timestamp);
    if (idx !== -1) {
      updateReminder(idx, path.reminderFrequency || 'None');
    }
    loadSavedPath(path);
    setActiveBuzz(null);
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
      const alreadyExists = savedPaths.some(p => 
        p.specialization === state.curriculum?.specialization && 
        p.overview === state.curriculum?.overview
      );
      
      if (alreadyExists) {
        alert('This curriculum is already in your profile.');
        return;
      }

      const pathWithMeta: Curriculum = { 
        ...state.curriculum, 
        timestamp: Date.now(), 
        reminderFrequency: 'None' as ReminderFrequency 
      };
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
    if (!curr.modules || curr.modules.length === 0) return 0;
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

  const currentProgress = state.curriculum ? calculateProgress(state.curriculum) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Buzz Alert Toast */}
      {activeBuzz && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-md animate-in slide-in-from-top-12 duration-500">
          <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-2xl flex items-center gap-5 border-4 border-white dark:border-slate-900">
            <div className="bg-white/20 p-3 rounded-full animate-bounce">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
            <div className="flex-grow">
              <h4 className="font-black text-lg">Check-in Buzz!</h4>
              <p className="text-sm font-medium text-blue-50 opacity-90">Time to review your progress in {activeBuzz.specialization}.</p>
            </div>
            <button onClick={() => acknowledgeBuzz(activeBuzz)} className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-black text-xs hover:scale-105 transition-transform active:scale-95 shadow-lg">
              Open
            </button>
          </div>
        </div>
      )}

      {/* Universal Modal Container */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
                {activeModal === 'docs' && 'Platform Documentation'}
                {activeModal === 'standards' && 'Global Standards Library'}
                {activeModal === 'terms' && 'Terms of Service'}
                {activeModal === 'privacy' && 'Privacy Policy'}
                {activeModal === 'support' && 'Contact Support'}
                {activeModal === 'signin' && 'Sign In to EduPath'}
                {activeModal === 'profile' && 'Professional Profile'}
                {activeModal === 'refine' && 'Refine Architecture'}
              </h2>
              <button 
                onClick={() => setActiveModal(null)} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {activeModal === 'docs' && (
                <div className="space-y-6 text-slate-600 dark:text-slate-400">
                  <section>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Architecting Your Path</h3>
                    <p className="text-sm leading-relaxed">EduPath AI utilizes the latest Gemini 3 series models to synthesize academic frameworks and industry demands. By leveraging real-time Google Search grounding, the system ensures that every module matches 2024/2025 technological shifts.</p>
                  </section>
                  <section>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Learning Momentum</h3>
                    <p className="text-sm leading-relaxed">Once you save a curriculum, you can enable "Buzzers" to receive weekly, monthly, or yearly check-ins. This helps you maintain long-term learning consistency.</p>
                  </section>
                  <section>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Exporting Dossiers</h3>
                    <p className="text-sm leading-relaxed">Use the "Export Dossier" feature to generate a professional PDF-ready overview of your specialization, including standard alignments and architectural reasoning.</p>
                  </section>
                </div>
              )}

              {activeModal === 'refine' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Instruct the architect on how to modify the current curriculum. Your previous assessment and focus remain in context.</p>
                  <div className="relative">
                    <textarea 
                      value={refineQuery}
                      onChange={(e) => setRefineQuery(e.target.value)}
                      placeholder="e.g., 'Focus more on React Native than Flutter', or 'Include advanced data structures'"
                      className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all resize-none font-medium"
                    />
                  </div>
                  <button 
                    onClick={() => handleDesign(undefined, true)}
                    className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-xl transition-all active:scale-[0.98]"
                  >
                    Regenerate with Refinements
                  </button>
                </div>
              )}

              {activeModal === 'standards' && (
                <div className="space-y-8 text-slate-600 dark:text-slate-400">
                  <p className="font-medium">Our curricula are generated by cross-referencing global standards across academia and industrial sectors.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">Academic Frameworks</h4>
                      <ul className="text-xs space-y-2 list-disc pl-4">
                        <li>ACM/IEEE CS2023 Curricula</li>
                        <li>ABET Accreditation Criteria</li>
                        <li>Quality Assurance Agency (UK)</li>
                        <li>Bologna Process Framework</li>
                      </ul>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3">Industry Benchmarks</h4>
                      <ul className="text-xs space-y-2 list-disc pl-4">
                        <li>FAANG Competency Matrices</li>
                        <li>CompTIA / AWS Certification Paths</li>
                        <li>Open Group Architecture (TOGAF)</li>
                        <li>ISO/IEC 27001 Training Stds</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'support' && (
                <div className="space-y-6 text-slate-600 dark:text-slate-400">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Need Assistance?</h3>
                    <p className="text-sm mb-6">Our research lab is available for custom roadmap inquiries or platform support.</p>
                    <a href="mailto:support@edupath-ai.edu" className="block w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all">
                      Email Support Lab
                    </a>
                  </div>
                </div>
              )}

              {activeModal === 'terms' && (
                <div className="space-y-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">1. Service Usage</h3>
                  <p>By using EduPath AI, you acknowledge that all generated curricula are synthesized by AI and should be verified by a professional educator or industry expert.</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">2. No Guarantee</h3>
                  <p>EduPath AI does not guarantee employment or academic credit. The platform provides guidance based on publicly available standards and trends.</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">3. Data Retention</h3>
                  <p>User data is stored primarily in local storage. EduPath AI does not sell or share individual architectural plans with third parties.</p>
                </div>
              )}

              {activeModal === 'privacy' && (
                <div className="space-y-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">1. Information Collection</h3>
                  <p>EduPath AI prioritizes user privacy. We primarily utilize LocalStorage to store your data locally on your device. We only collect the email address you provide for account synchronization.</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">2. Data Security</h3>
                  <p>All communication with the Gemini API is encrypted. Your architectural roadmaps are kept private unless you explicitly choose to share or export them.</p>
                </div>
              )}

              {activeModal === 'profile' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                      {userEmail ? userEmail.substring(0, 1).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white truncate max-w-[200px]">{userEmail}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Architect Member</p>
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
                      <p className="text-sm text-slate-400 italic">No skills tracked.</p>
                    )}
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Learning Momentum</h4>
                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase">Active Check-ins</span>
                    </div>
                    {savedPaths.length > 0 ? (
                      <div className="space-y-4">
                        {savedPaths.map((path, i) => {
                          const progress = calculateProgress(path);
                          return (
                            <div key={i} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl group hover:border-blue-200 transition-all shadow-sm">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-grow pr-4">
                                  <p className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{path.specialization}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                      Progress: {progress}%
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <select 
                                    value={path.reminderFrequency || 'None'} 
                                    onChange={(e) => updateReminder(i, e.target.value as ReminderFrequency)}
                                    className="text-[10px] font-black uppercase bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-lg outline-none text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600"
                                  >
                                    <option value="None">No Buzz</option>
                                    <option value="Weekly">Weekly Buzz</option>
                                    <option value="Monthly">Monthly Buzz</option>
                                    <option value="Yearly">Yearly Buzz</option>
                                  </select>
                                  {path.reminderFrequency !== 'None' && (
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Buzzer Active</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => loadSavedPath(path)}
                                  className="flex-grow py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 hover:text-white rounded-xl text-xs font-black transition-all"
                                >
                                  View Path
                                </button>
                                <button 
                                  onClick={() => {
                                    const next = [...savedPaths];
                                    next.splice(i, 1);
                                    setSavedPaths(next);
                                  }}
                                  className="px-4 py-2.5 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-10 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 font-medium">No saved roadmaps yet. Create one above to start your momentum.</p>
                    )}
                  </section>
                </div>
              )}

              {activeModal === 'signin' && (
                <div className="space-y-6">
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <input 
                      type="email" required value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-slate-900 dark:text-white outline-none" 
                      placeholder="your@email.com"
                    />
                    <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl active:scale-[0.98]">
                      {isLoggingIn ? 'Signing In...' : 'Continue'}
                    </button>
                  </form>
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
            {state.curriculum && (
              <div className="hidden lg:flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 animate-in fade-in zoom-in-95 duration-500">
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Mastery</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{currentProgress}%</span>
              </div>
            )}
            <div className="hidden md:flex gap-6 text-sm font-bold text-slate-500 dark:text-slate-400">
              <button onClick={() => setActiveModal('docs')} className="hover:text-blue-600 transition-colors">Docs</button>
              <button onClick={() => setActiveModal('standards')} className="hover:text-blue-600 transition-colors">Library</button>
            </div>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {isLoggedIn ? (
              <button onClick={() => setActiveModal('profile')} className="hidden md:flex w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 items-center justify-center text-blue-700 dark:text-blue-400 font-black hover:scale-105 transition-transform relative">
                {userEmail.charAt(0).toUpperCase()}
                {savedPaths.some(p => p.reminderFrequency !== 'None') && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
                )}
              </button>
            ) : (
              <button onClick={() => setActiveModal('signin')} className="hidden md:block bg-slate-900 dark:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all">Sign In</button>
            )}
            {/* Mobile menu toggle */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
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
        
        {/* Dynamic Progress Line */}
        {state.curriculum && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-100 dark:bg-slate-900 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(37,99,235,0.5)]"
              style={{ width: `${currentProgress}%` }}
            ></div>
          </div>
        )}
      </header>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[73px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-[45] animate-in slide-in-from-top duration-300 shadow-2xl p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Theme</span>
              <ThemeToggle />
            </div>
            <button onClick={() => { setActiveModal('docs'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300 py-2">Documentation</button>
            <button onClick={() => { setActiveModal('standards'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300 py-2">Standards Library</button>
            <button onClick={() => { setActiveModal('support'); setIsMobileMenuOpen(false); }} className="text-left font-bold text-slate-700 dark:text-slate-300 py-2">Contact Support</button>
          </div>
          <div className="h-px bg-slate-100 dark:bg-slate-800"></div>
          {isLoggedIn ? (
            <div className="flex items-center justify-between">
              <button onClick={() => { setActiveModal('profile'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-black">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Profile</span>
              </button>
              <button onClick={handleSignOut} className="text-red-500 font-bold text-sm">Sign Out</button>
            </div>
          ) : (
            <button onClick={() => { setActiveModal('signin'); setIsMobileMenuOpen(false); }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">Sign In</button>
          )}
        </div>
      )}

      <main className="flex-grow max-w-5xl mx-auto px-4 py-12 md:py-20 w-full">
        <section className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
            Architect Your <span className="text-blue-600">Expertise</span>
          </h2>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Synthesizing 2025 industry standards and global academic frameworks into a single cohesive path.
          </p>
        </section>

        {/* Search Engine Area */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-6 md:p-10 mb-16 border border-slate-100 dark:border-slate-800">
          <form onSubmit={handleDesign} className="space-y-8">
            <div className="relative">
              <input
                type="text" required value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Topic (e.g., Computer Vision)"
                className="w-full pl-6 pr-16 md:pr-60 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xl font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
              />
              {state.isLoading ? (
                <button type="button" onClick={handleStop} className="absolute right-3 top-3 bottom-3 bg-slate-800 text-white px-4 md:px-8 rounded-xl font-black hover:bg-red-600 transition-colors">
                   <span className="hidden md:inline">Stop</span><span className="md:hidden">×</span>
                </button>
              ) : (
                <button type="submit" className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white px-4 md:px-8 rounded-xl font-black hover:bg-blue-700 shadow-lg transition-all flex items-center gap-2">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                   <span className="hidden md:inline">Architect Path</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Learning Paradigm</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                  {(['Academic', 'Balanced', 'Industry'] as const).map((opt) => (
                    <button key={opt} type="button" onClick={() => setFocus(opt)} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${focus === opt ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Experience</label>
                <select value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-800 px-5 py-4 rounded-2xl text-sm font-bold text-slate-900 dark:text-white border-none focus:ring-4 focus:ring-blue-500/10 outline-none cursor-pointer">
                  <option>Beginner</option>
                  <option>Professional</option>
                  <option>Academic</option>
                </select>
              </div>
            </div>

            <div className="border-t dark:border-slate-800 pt-8">
              <button type="button" onClick={() => setShowAssessment(!showAssessment)} className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <svg className={`w-4 h-4 transition-transform ${showAssessment ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                {showAssessment ? 'Hide Skills Map' : 'Refine with Skill Assessment'}
              </button>
              {showAssessment && (
                <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex gap-2 mb-6">
                    <input type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="e.g. AWS, React" className="flex-grow px-4 py-3 rounded-xl border dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:border-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                    <button type="button" onClick={addSkill} className="bg-slate-900 dark:bg-blue-600 text-white px-6 rounded-xl font-bold active:scale-95 transition-transform">Add</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assessment.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm">
                        <div className="flex-grow">
                          <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.skill}</span>
                          <input type="range" min="1" max="5" value={item.level} onChange={(e) => updateSkillLevel(idx, parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none accent-blue-600" />
                        </div>
                        <button onClick={() => removeSkill(idx)} className="text-red-400 hover:text-red-600 transition-colors">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {state.error && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 p-6 rounded-3xl mb-12 flex items-start gap-4 animate-in shake duration-500">
            <svg className="w-6 h-6 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="font-bold">{state.error}</p>
          </div>
        )}

        {state.isLoading && (
          <div className="space-y-8 animate-pulse">
            <div className="h-64 bg-slate-200 dark:bg-slate-900 rounded-[2.5rem]"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 h-96 bg-slate-200 dark:bg-slate-900 rounded-3xl"></div>
              <div className="h-96 bg-slate-200 dark:bg-slate-900 rounded-3xl"></div>
            </div>
          </div>
        )}

        {state.curriculum && !state.isLoading && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Curriculum Master Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-white border border-white/10">
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex flex-wrap gap-3">
                    <span className="bg-blue-600/20 text-blue-400 border border-blue-600/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Validated Roadmap</span>
                    <span className="bg-white/5 text-white/60 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{state.curriculum.totalDuration}</span>
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Industry Score:</span>
                      <span className="text-xs font-black text-blue-400">{state.curriculum.industryRelevanceScore}/100</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setActiveModal('refine')} className="bg-white/10 hover:bg-white/20 px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       Refine Architecture
                    </button>
                    <button onClick={saveToProfile} className="bg-white/10 hover:bg-white/20 px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95">Save to Profile</button>
                    <button onClick={handleExportDossier} className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95">Export Dossier</button>
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">{state.curriculum.specialization}</h2>
                <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-4xl font-medium leading-relaxed">{state.curriculum.overview}</p>
                
                <div className="flex flex-wrap items-center gap-6 border-t border-white/10 pt-8 mt-8">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Primary Target</span>
                    <span className="text-lg font-black text-white">{state.curriculum.targetRole}</span>
                  </div>
                  {state.curriculum.adaptiveFocusReasoning && (
                    <div className="max-w-md">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Adaptive Reasoning</span>
                      <p className="text-xs italic text-slate-400">{state.curriculum.adaptiveFocusReasoning}</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Abstract decorative element */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-6">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-between">
                  Sequence Architecture
                  <span className="text-sm font-bold text-slate-400">{state.curriculum.modules.length} Modules</span>
                </h3>
                <div className="space-y-4">
                  {state.curriculum.modules.map((module, index) => (
                    <ModuleCard key={module.id} module={module} index={index} onToggleCompletion={toggleModuleCompletion} />
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-8 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Prerequisites</h4>
                  <ul className="space-y-4">
                    {state.curriculum.prerequisites.map((p, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-8 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Standard Benchmarks</h4>
                  <ul className="space-y-4">
                    {state.curriculum.suggestedCertifications.map((c, i) => (
                      <li key={i} className="flex items-center gap-4 text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138z" /></svg>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {state.curriculum.groundingSources && (
                  <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-8 shadow-xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Verified Grounding</h4>
                    <div className="space-y-2">
                      {state.curriculum.groundingSources.map((source, i) => (
                        <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="block p-3 text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 rounded-lg hover:brightness-95 transition-all truncate border border-blue-100 dark:border-blue-900/30">
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!state.curriculum && !state.isLoading && !state.error && (
          <div className="text-center py-32 opacity-20">
            <svg className="w-32 h-32 mx-auto text-slate-400 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <p className="text-2xl font-black text-slate-400 tracking-tight">Ready to architect your expertise.</p>
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
              <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                <li><button onClick={() => setActiveModal('docs')} className="hover:text-blue-600 transition-colors">Documentation</button></li>
                <li><button onClick={() => setActiveModal('standards')} className="hover:text-blue-600 transition-colors">Standards Library</button></li>
                <li><button onClick={() => setActiveModal('support')} className="hover:text-blue-600 transition-colors">Contact Support</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">Legal</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                <li><button onClick={() => setActiveModal('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button></li>
                <li><button onClick={() => setActiveModal('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              © 2024 EduPath AI Research Lab. Powered by Gemini.
            </p>
            <div className="flex gap-6">
              {['GitHub', 'LinkedIn'].map(p => (
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