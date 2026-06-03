import React from 'react';
import { Search, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react';
import type { Tool, ToolCategory } from '../types/app';

const SCREENSHOT_NEW_TOOL_IDS = [
  'resize-image',
  'crop-image',
  'color-picker',
  'rotate-image',
  'flip-image',
  'image-enlarger',
  'gif-maker',
  'webp-to-png',
  'jfif-to-png',
  'heic-to-jpg',
  'heic-to-png',
  'webp-to-jpg',
  'organize-pdf',
  'flatten-pdf',
  'resize-pdf',
  'extract-image-from-pdf',
  'pdf-page-remover',
  'extract-pages-from-pdf',
  'crop-video',
  'trim-video',
  'video-converter',
  'audio-converter',
  'mp3-converter',
  'mp4-to-mp3',
  'video-to-mp3',
  'mp4-converter',
  'mov-to-mp4',
  'mp3-to-ogg',
  'video-to-gif',
  'mp4-to-gif',
  'webm-to-gif',
  'gif-to-mp4',
  'gif-to-apng',
  'apng-to-gif',
  'image-to-gif',
  'mov-to-gif',
  'avi-to-gif',
  'unit-converter',
  'time-converter',
  'archive-converter',
] as const;

class ToolErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'Tool failed to load.',
    };
  }

  componentDidUpdate(prevProps: { children: React.ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-left">
          <div className="text-lg font-bold text-white">Tool failed to open</div>
          <p className="mt-2 text-sm text-rose-200/80">
            {this.state.message || 'This tool hit a runtime issue. We can now see the real error instead of an endless loading state.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ToolsPageProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  activeCategory: ToolCategory | 'all';
  setActiveCategory: (value: ToolCategory | 'all') => void;
  filteredTools: Tool[];
  allTools: Tool[];
  handleToolClick: (tool: Tool) => void;
  activeToolId: string | null;
  setActiveToolId: (id: string | null) => void;
  renderTool: () => React.ReactNode;
  activeToolName?: string;
}

export const ToolsPage = ({
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  filteredTools,
  allTools,
  handleToolClick,
  activeToolId,
  setActiveToolId,
  renderTool,
  activeToolName,
}: ToolsPageProps) => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [showAllTools, setShowAllTools] = React.useState(false);
  const [shareCopied, setShareCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeToolId]);

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

  React.useEffect(() => {
    setShowAllTools(false);
  }, [activeCategory, searchQuery]);

  const newToolIds = new Set([
    ...SCREENSHOT_NEW_TOOL_IDS,
    'shopify-helper',
    'qr-code-generator',
    'image-compressor',
    'db-viewer',
    'csv-viewer',
    'keyword-density-checker',
    'color-palette-generator',
  ]);
  const visibleNewTools = filteredTools.filter((tool) => newToolIds.has(tool.id));
  const mobileLimit = 12;
  const toolsToShow =
    isMobile && !showAllTools ? filteredTools.slice(0, mobileLimit) : filteredTools;
  const hiddenCount = Math.max(filteredTools.length - toolsToShow.length, 0);

  const activeTool = React.useMemo(() => {
    if (!activeToolId) return undefined;
    return allTools.find((tool) => tool.id === activeToolId);
  }, [activeToolId, allTools]);

  const getHelperSteps = (tool?: Tool) => {
    const name = tool?.name || activeToolName || 'this tool';
    const base = [
      `Add your file or link in ${name}.`,
      'Adjust the options (recommended settings are already selected).',
      'Click the main action button and download/save the result.',
    ];

    if (!tool) return base;
    if (tool.category === 'media') {
      return [
        'Paste the video URL (YouTube / TikTok / Instagram / Facebook).',
        'Click “Fetch” to load formats, then pick Video/Audio quality.',
        'Download and save the file. If a provider blocks the link, try a different format.',
      ];
    }
    if (tool.category === 'pdf') {
      return [
        'Upload your PDF (or multiple PDFs if the tool supports it).',
        'Pick pages/options, then click the action (merge/split/compress).',
        'Download the processed PDF.',
      ];
    }
    if (tool.category === 'image') {
      return [
        'Upload an image (PNG/JPG/WebP).',
        'Enable “maintain aspect ratio” where available, then choose size/format.',
        'Export the result and download.',
      ];
    }
    return base;
  };

  const shareToolLink = async () => {
    if (typeof window === 'undefined') return;
    const toolId = activeToolId || '';
    const url = toolId
      ? `${window.location.origin}/tools/${toolId}`
      : window.location.origin + '/tools';
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <div className="space-y-8">
      {activeToolId && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                Quick Help
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                {activeTool?.name || activeToolName || 'Tool'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                {activeTool?.description ||
                  'Finish your task in seconds. If something looks stuck, refresh once and try again.'}
              </p>
              <ol className="mt-4 list-decimal pl-5 text-sm leading-7 text-slate-300">
                {getHelperSteps(activeTool).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-400">
                Privacy note: uploaded files are used only for processing and download delivery.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={shareToolLink}
                className="vinza-button inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:border-rose-400/30 hover:bg-white/10"
              >
                {shareCopied ? 'Link Copied' : 'Share Tool Link'}
                <ChevronRight size={16} className="opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveToolId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="vinza-button inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:border-rose-400/30 hover:bg-white/10"
              >
                <ArrowLeft size={16} />
                Back to Tools
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      {!activeToolId && (
        <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 rounded-3xl p-10 border border-rose-500/20">
          <div className="flex items-center gap-2 text-rose-400 text-sm mb-4">
            <Sparkles size={14} />
            <span>Tools Hub</span>
          </div>
          <h2 className="text-4xl font-black text-white mb-3">All Tools</h2>
          <p className="text-slate-400 max-w-lg">
            Search, filter, and open any tool instantly. Pick a tool and start
            working in seconds.
          </p>
        </div>
      )}

      {!activeToolId && visibleNewTools.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                <Sparkles size={14} />
                New Tools Added
              </div>
              <h3 className="text-2xl font-black text-white">
                {visibleNewTools.length} new tools just added to VinzaTools
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                From QR Code Generator and Image Compressor to DB Viewer and Shopify Helper — explore
                the latest additions. Look for the <span className="font-bold text-emerald-300">New</span> badge
                on each card, or filter by category to find them quickly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleNewTools.slice(0, isMobile ? 4 : 8).map((tool) => (
                <span
                  key={tool.id}
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200"
                >
                  {tool.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      {!activeToolId && (
        <div className="bg-[#1a1414] rounded-2xl p-6 border border-white/10">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                Find Your Tool
              </h3>
              <p className="text-slate-500 text-sm">
                Quick access to all utilities
              </p>
            </div>
            <div className="w-full lg:max-w-md relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-rose-500/50 text-white placeholder-slate-500 transition-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {!activeToolId && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            'all',
            'creative',
            'image',
            'pdf',
            'media',
            'developer',
            'text',
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              {cat === 'all'
                ? 'All Tools'
                : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Tools Grid or Active Tool */}
      {!activeToolId ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {toolsToShow.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className="group relative rounded-2xl border border-white/10 bg-[#1a1414] p-5 text-left transition-all hover:border-rose-500/30 hover:bg-[#1f1919] sm:p-6"
            >
              {newToolIds.has(tool.id) && (
                <span className="absolute right-4 top-4 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">
                  New
                </span>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
                  <tool.icon className="text-rose-400" size={22} />
                </div>
                <ChevronRight
                  size={18}
                  className="text-slate-600 group-hover:text-rose-400 group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-rose-300 transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {tool.description}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-[#1a1414] rounded-3xl border border-white/10 overflow-hidden">
          {/* Tool Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <button
              onClick={() => {
                setActiveToolId(null);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="flex items-center gap-2 text-slate-400 hover:text-rose-400 transition-colors font-medium"
            >
              <ArrowLeft size={18} />
              Back to Tools
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 rounded-lg flex items-center justify-center border border-rose-500/20">
                <Sparkles className="text-rose-400" size={18} />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {activeToolName || 'Tool'}
              </h2>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-3 border-b border-white/5 px-6 py-3">
            {[
              '100% Free',
              'No Signup Required',
              'No Watermark',
              'Works in Browser',
            ].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
              >
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3 shrink-0">
                  <path d="M10.28 2.28a.75.75 0 0 0-1.06 0L4.5 7 2.78 5.28a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l5.25-5.25a.75.75 0 0 0 0-1.06Z" />
                </svg>
                {badge}
              </span>
            ))}
          </div>

          {/* Tool Content */}
          <div className="p-6 tool-surface">
            <ToolErrorBoundary>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center min-h-[320px] text-slate-400 text-sm">
                    Loading tool...
                  </div>
                }
              >
                {renderTool()}
              </React.Suspense>
            </ToolErrorBoundary>
          </div>
        </div>
      )}

      {!activeToolId && isMobile && filteredTools.length > mobileLimit && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowAllTools((prev) => !prev)}
            className="vinza-button rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-rose-400/30 hover:bg-white/10"
          >
            {showAllTools ? 'Show fewer tools' : `Show ${hiddenCount} more tools`}
          </button>
        </div>
      )}
    </div>
  );
};
