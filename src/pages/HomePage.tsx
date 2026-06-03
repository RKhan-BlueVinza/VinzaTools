import React, { useState } from 'react';
import {
  ArrowUpRight,
  Wand2,
  Globe,
  Layers,
  Clock,
  Eraser,
} from 'lucide-react';

import type { Tool, ToolCategory } from '../types/app';

interface HomePageProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeCategory: ToolCategory | 'all';
  setActiveCategory: (value: ToolCategory | 'all') => void;
  filteredTools: Tool[];
  featuredTools: Tool[];
  handleToolClick: (tool: Tool) => void;
  openSubTool: (toolId: string, subAction: string) => void;
  goTools: () => void;
  showAllTools?: boolean;
  enableShowAllTools?: () => void;
  onSecondaryVisible?: () => void;
}

export const HomePage = ({
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  filteredTools,
  featuredTools,
  handleToolClick,
  openSubTool,
  goTools,
  showAllTools,
  enableShowAllTools,
  onSecondaryVisible,
}: HomePageProps) => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });
  const [showSecondary, setShowSecondary] = useState(false);
  const [SecondarySections, setSecondarySections] = useState<
    React.ComponentType<any> | null
  >(null);
  const [secondaryLoadError, setSecondaryLoadError] = useState<string | null>(null);
  const backgroundRemoverTool = [...featuredTools, ...filteredTools].find(
    (tool) => tool.id === 'bg-remover'
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // Load the secondary sections automatically (no "scroll-to-load" requirement).
  // We still lazy-import to keep the first paint fast.
  React.useEffect(() => {
    if (showSecondary) return;
    if (typeof window === 'undefined') return;

    const warm = () => setShowSecondary(true);
    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(warm, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback?.(handle);
    }

    const timer = setTimeout(warm, 650);
    return () => clearTimeout(timer);
  }, [showSecondary]);

  React.useEffect(() => {
    if (!showSecondary || SecondarySections) return;
    let mounted = true;
    onSecondaryVisible?.();
    import('../sections/home/HomeSecondarySections')
      .then((mod) => {
        if (mounted) {
          setSecondaryLoadError(null);
          setSecondarySections(() => mod.HomeSecondarySections);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        const message =
          error instanceof Error ? error.message : 'Secondary sections failed to load.';
        setSecondaryLoadError(message);
      });
    return () => {
      mounted = false;
    };
  }, [showSecondary, SecondarySections, onSecondaryVisible]);


  const stats = [
    {
      label: 'Tool Library',
      value: '94',
      icon: Globe,
      color: 'from-rose-400 to-orange-500',
    },
    {
      label: 'Theme Packs',
      value: '4',
      icon: Layers,
      color: 'from-coral-400 to-rose-500',
    },
    {
      label: 'Core Categories',
      value: '6',
      icon: Clock,
      color: 'from-orange-400 to-amber-500',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f0a0a] text-white overflow-x-hidden selection:bg-rose-500/30">
      {/* Lightweight Background (avoid expensive blur layers on desktop audits) */}
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(244,63,94,0.10),transparent_55%),radial-gradient(circle_at_85%_95%,rgba(249,115,22,0.08),transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:100px_100px]" />
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 md:pt-32 pb-20">
        {/* Hero Section */}
        <section className="mb-32 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <h1 className="text-5xl lg:text-7xl font-black leading-[0.95] tracking-tighter">
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">
                  Free Online
                </span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-coral-500 to-orange-500 mt-2">
                  Tools
                </span>
              </h1>

              <p className="text-xl text-gray-400 max-w-md leading-relaxed">
                Open practical tools for{' '}
                <span className="text-rose-400 font-semibold">background removal</span>,{' '}
                <span className="text-rose-400 font-semibold">PDF work</span>, and{' '}
                <span className="text-rose-400 font-semibold">YouTube, TikTok, Instagram, and Facebook downloads</span>{' '}
                from one clean workspace.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={goTools}
                  className="vinza-button group relative px-8 py-5 bg-white text-[#0f0a0a] rounded-2xl font-bold text-lg overflow-hidden hover:scale-105 transition-transform duration-300 shadow-[0_18px_40px_rgba(255,255,255,0.08)] hover:shadow-[0_24px_55px_rgba(244,63,94,0.18)]"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Start Creating
                    <ArrowUpRight
                      size={20}
                      className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                    />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-200 to-orange-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (backgroundRemoverTool) {
                      handleToolClick(backgroundRemoverTool);
                      return;
                    }
                    goTools();
                  }}
                  className="vinza-button cursor-pointer group px-8 py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-semibold hover:bg-white/10 hover:border-rose-400/30 hover:shadow-[0_20px_50px_rgba(244,63,94,0.12)] transition-all flex items-center gap-3"
                >
                  <Eraser size={18} className="transition-transform duration-300 group-hover:scale-110" />
                  Try Background Remover
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  'Background Remover',
                  'PDF to Word',
                  'YouTube Downloader',
                  'Instagram Downloader',
                  'TikTok Downloader',
                  'Facebook Downloader',
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300"
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-8 border-t border-white/10">
                {stats.map((stat, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div
                      className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent group-hover:scale-110 transition-transform inline-block`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - 3D Card Stack */}
            <div className="relative h-[600px] hidden lg:block">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`absolute w-80 h-96 rounded-3xl p-6 cursor-pointer transition-all duration-500
                    ${i === 0 ? 'top-20 right-20 bg-[#1a1414] rotate-12 opacity-60 scale-90' : ''}
                    ${i === 1 ? 'top-10 right-10 bg-[#1f1919] rotate-6 opacity-80 scale-95' : ''}
                    ${i === 2 ? 'top-0 right-0 bg-gradient-to-br from-rose-100 to-white rotate-0 hover:scale-105' : ''}
                  `}
                  onClick={() => {
                    if (i === 2) {
                      openSubTool('pdf-tools', 'merge');
                    }
                  }}
                >
                  {i === 2 ? (
                    <div className="h-full flex flex-col justify-between text-[#0f0a0a]">
                      <div className="flex justify-between items-start">
                        <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <Wand2 className="text-white" size={28} />
                        </div>
                        <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2">
                          PDF Alchemist
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Transform, merge, split, compress
                        </p>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openSubTool('pdf-tools', 'merge');
                          }}
                          className="vinza-button group cursor-pointer inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-rose-600 font-semibold shadow-sm transition-all hover:border-rose-300 hover:bg-rose-100 hover:shadow-md"
                        >
                          <span>Try Now</span>
                          <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-between opacity-40">
                      <div
                        className={`w-12 h-12 rounded-xl ${i === 0 ? 'bg-rose-500/20' : 'bg-orange-500/20'}`}
                      />
                      <div className="space-y-3">
                        <div className="h-3 bg-white/20 rounded-full w-3/4" />
                        <div className="h-3 bg-white/10 rounded-full w-1/2" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {showSecondary && SecondarySections ? (
          <SecondarySections
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            filteredTools={filteredTools}
            featuredTools={featuredTools}
            handleToolClick={handleToolClick}
            openSubTool={openSubTool}
            goTools={goTools}
            isMobile={isMobile}
            showAllTools={showAllTools}
            enableShowAllTools={enableShowAllTools}
          />
        ) : (
          <div className="mt-12 min-h-[900px] rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-slate-300/80 md:min-h-[1200px]">
            {secondaryLoadError ? (
              <div className="mx-auto max-w-xl space-y-3">
                <div className="text-base font-black text-white">Section failed to load</div>
                <div className="text-sm leading-7 text-rose-100/70">{secondaryLoadError}</div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="vinza-button cursor-pointer mt-2 inline-flex items-center justify-center rounded-xl bg-rose-500 px-5 py-2.5 font-bold text-white transition hover:bg-rose-600"
                >
                  Refresh Page
                </button>
              </div>
            ) : showSecondary ? (
              'Loading the full tool library...'
            ) : (
              'Loading the full tool library...'
            )}
          </div>
        )}
      </div>
    </div>
  );
};
