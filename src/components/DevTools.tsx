import React, { useState } from 'react';
import { 
  Code, Copy, Check, FileJson, Hash, Eye, 
  Terminal, Play, Trash2, Download, Sparkles,
  Braces, Minimize2, FileCode, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type DevAction = 'json' | 'minify' | 'base64' | 'svg-viewer';

interface DevToolsProps {
  initialAction?: DevAction;
  singleView?: boolean;
}

export const DevTools = ({ initialAction, singleView }: DevToolsProps) => {
  const [action, setAction] = useState<DevAction>(initialAction || 'json');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (initialAction) {
      setAction(initialAction);
      setInput('');
      setOutput('');
      setError(null);
    }
  }, [initialAction]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const process = async () => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    // Simulate processing delay for effect
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      if (action === 'json') {
        const parsed = JSON.parse(input);
        setOutput(JSON.stringify(parsed, null, 2));
      } else if (action === 'minify') {
        setOutput(input.replace(/\s+/g, ' ').trim());
      } else if (action === 'base64') {
        setOutput(btoa(input));
      } else if (action === 'svg-viewer') {
        setOutput(input);
      }
    } catch (e) {
      setError('Invalid input format');
      setOutput('');
    } finally {
      setIsProcessing(false);
    }
  };

  const tools: { id: DevAction; name: string; icon: any; desc: string; color: string }[] = [
    { 
      id: 'json', 
      name: 'JSON Formatter & Validator', 
      icon: FileJson, 
      desc: 'Format and validate JSON',
      color: 'from-emerald-500 to-teal-600'
    },
    { 
      id: 'minify', 
      name: 'Code Minifier (HTML CSS JS)', 
      icon: Minimize2, 
      desc: 'Minify HTML, CSS, or JS',
      color: 'from-rose-500 to-red-600'
    },
    { 
      id: 'base64', 
      name: 'Base64 Encoder', 
      icon: Hash, 
      desc: 'Encode text to Base64',
      color: 'from-amber-500 to-orange-600'
    },
    { 
      id: 'svg-viewer', 
      name: 'SVG Viewer & Preview', 
      icon: Eye, 
      desc: 'Preview SVG markup',
      color: 'from-purple-500 to-pink-600'
    },
  ];

  const activeTool = tools.find(t => t.id === action);
  const isSingleView = singleView ?? Boolean(initialAction);

  return (
    <div className={`${isSingleView ? 'h-full bg-transparent' : 'h-full flex bg-[#0a0505]'} relative overflow-hidden`}>
      {!isSingleView && (
        <>
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-purple-900/10 pointer-events-none" />
          <div className="absolute top-20 left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </>
      )}

      {/* Sidebar */}
      {!isSingleView && (
        <div className="w-72 bg-[#151010]/90 backdrop-blur-xl border-r border-rose-500/20 p-6 space-y-3 relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg shadow-rose-500/30">
            <Terminal size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">DevTools</h3>
            <p className="text-xs text-rose-400/60">Developer Utilities</p>
          </div>
        </div>

        <div className="space-y-2">
          {tools.map((t, index) => {
            const Icon = t.icon;
            const isActive = action === t.id;
            
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => { 
                  setAction(t.id); 
                  setInput(''); 
                  setOutput(''); 
                  setError(null); 
                }}
                className={`w-full group relative flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 overflow-hidden ${
                  isActive 
                    ? 'bg-gradient-to-r from-rose-500/20 to-red-600/10 border border-rose-500/40 text-white shadow-lg shadow-rose-500/10' 
                    : 'text-rose-300/70 hover:bg-rose-500/10 hover:text-rose-200 border border-transparent'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div 
                    layoutId="activeTool"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-rose-400 to-red-600 rounded-r-full"
                  />
                )}
                
                <div className={`p-2 rounded-xl transition-all ${
                  isActive 
                    ? `bg-gradient-to-br ${t.color} text-white shadow-lg` 
                    : 'bg-rose-500/10 text-rose-400 group-hover:scale-110'
                }`}>
                  <Icon size={18} />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className={`text-xs ${isActive ? 'text-rose-300/80' : 'text-rose-400/40'}`}>
                    {t.desc}
                  </div>
                </div>

                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 bg-rose-400 rounded-full shadow-lg shadow-rose-500/50"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Stats in sidebar */}
        <div className="mt-auto pt-6 border-t border-rose-500/20">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#0f0a0a] rounded-xl border border-rose-500/10">
              <div className="text-rose-400/50 mb-1">Input</div>
              <div className="text-white font-bold">{input.length} chars</div>
            </div>
            <div className="p-3 bg-[#0f0a0a] rounded-xl border border-rose-500/10">
              <div className="text-rose-400/50 mb-1">Output</div>
              <div className="text-white font-bold">{output.length} chars</div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Main Area */}
      <div className={`${isSingleView ? 'p-0' : 'flex-1 p-8'} overflow-y-auto relative z-10`}>
        <div className={`${isSingleView ? 'max-w-5xl mx-auto' : 'max-w-6xl mx-auto'} space-y-6 h-full flex flex-col`}>
          {isSingleView && (
            <div className="bg-[#1a1414] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{activeTool?.name}</h3>
                  <p className="text-xs text-slate-400">Developer utility ready to use</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="flex items-center justify-between bg-[#151010]/80 backdrop-blur-md border border-rose-500/20 rounded-2xl p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-gradient-to-br ${activeTool?.color} rounded-2xl text-white shadow-lg`}>
                {activeTool && <activeTool.icon size={24} />}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">{activeTool?.name}</h2>
                <p className="text-sm text-rose-400/60">{activeTool?.desc}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {input && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleClear}
                  className="px-4 py-2.5 bg-[#0f0a0a] border border-rose-500/30 rounded-xl font-bold text-rose-400 hover:border-rose-500/60 hover:bg-rose-500/10 transition-all flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Clear
                </motion.button>
              )}
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={process}
                disabled={!input.trim() || isProcessing}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-rose-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {isProcessing ? (
                  <Sparkles size={18} className="animate-spin" />
                ) : (
                  <Play size={18} className="group-hover:animate-pulse" />
                )}
                {isProcessing ? 'Processing...' : 'Process'}
              </motion.button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            {/* Input Panel */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <Code size={14} />
                  Input
                </label>
                <span className="text-xs text-rose-400/50 font-medium">
                  {input.split('\n').length} lines
                </span>
              </div>
              
              <div className="flex-1 relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent rounded-3xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <textarea
                  className="w-full h-full p-6 bg-[#0f0a0a] border-2 border-rose-500/20 rounded-3xl font-mono text-sm text-rose-100 placeholder-rose-400/30 resize-none focus:border-rose-500 focus:shadow-lg focus:shadow-rose-500/10 outline-none transition-all leading-relaxed"
                  placeholder={`Paste your ${action.toUpperCase()} code here...`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  spellCheck={false}
                  onKeyDown={e => {
                    if (e.ctrlKey && e.key === 'Enter') {
                      e.preventDefault();
                      process();
                    }
                  }}
                />
                {/* Line numbers effect */}
                <div className="absolute left-0 top-6 bottom-6 w-12 border-r border-rose-500/10 pointer-events-none hidden md:block">
                  <div className="text-right pr-3 text-rose-500/20 text-xs font-mono select-none">
                    {Array.from({ length: Math.min(input.split('\n').length, 20) }, (_, i) => i + 1).join('\n')}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Output Panel */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal size={14} />
                  Output
                </label>
                <div className="flex items-center gap-2">
                  {output && !error && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleCopy}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                        copied 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                      }`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </motion.button>
                  )}
                  {output && (
                    <span className="text-xs text-rose-400/50 font-medium">
                      {output.length} chars
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 relative">
                {action === 'svg-viewer' ? (
                  <div className="h-full bg-[#0f0a0a] border-2 border-rose-500/20 rounded-3xl p-8 flex items-center justify-center overflow-auto">
                    {output ? (
                      <iframe
                        srcDoc={output}
                        sandbox=""
                        title="SVG Preview"
                        className="w-full h-full"
                        style={{ border: 'none', background: 'white' }}
                      />
                    ) : (
                      <div className="text-center text-rose-400/30">
                        <Eye size={48} className="mx-auto mb-4 opacity-50" />
                        <p>SVG preview will appear here</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full relative group">
                    <textarea
                      className="w-full h-full p-6 bg-[#0a0505] border-2 border-rose-500/20 rounded-3xl font-mono text-sm text-emerald-400 resize-none outline-none transition-all leading-relaxed"
                      value={output}
                      readOnly
                      placeholder="Output will appear here..."
                    />
                    <div className={`absolute inset-0 rounded-3xl bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none transition-opacity ${output ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                )}

                {/* Error Toast */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      className="absolute top-4 right-4 px-4 py-3 bg-red-500/90 backdrop-blur-sm text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/30 border border-red-400/30 flex items-center gap-2"
                    >
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success indicator */}
                <AnimatePresence>
                  {output && !error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-4 right-4 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1.5"
                    >
                      <Check size={12} />
                      Success
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Tips Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#151010]/60 border border-rose-500/20 rounded-2xl text-xs text-rose-400/50">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-rose-400" />
                Pro tip: Paste large JSON for instant formatting
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Shortcut: Ctrl + Enter to process</span>
              <span className="w-1 h-1 bg-rose-500/30 rounded-full" />
              <span>Auto-detect format</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
