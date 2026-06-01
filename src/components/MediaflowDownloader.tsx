import React, { useEffect, useMemo, useState } from 'react';
import {
  Youtube,
  Music,
  Video,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Instagram,
  Smartphone,
  Facebook,
  History,
  Trash2,
  ExternalLink,
  Sparkles,
  Play,
  Shield,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, apiHref } from '../api';

export type ToolType = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | null;

interface DownloadFormat {
  quality: string;
  container: string;
  url: string;
  itag: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

interface MediaInfo {
  title: string;
  thumbnail: string;
  author?: string;
  duration?: string;
  formats?: DownloadFormat[];
  audioFormats?: DownloadFormat[];
  downloadUrl?: string;
}

interface HistoryItem {
  id: number;
  title: string;
  thumbnail: string;
  url: string;
  tool: string;
  timestamp: string;
}

interface MediaflowDownloaderProps {
  initialTool?: ToolType;
  singleView?: boolean;
}

interface DownloadFeedback {
  formatKey: string;
  label: string;
  status: 'starting' | 'downloading' | 'done';
  progress: number | null;
}

const toolConfig = {
  youtube: {
    name: 'YouTube Video Downloader',
    description: 'Download high-quality YouTube videos and audio.',
    icon: Youtube,
    color: 'from-red-500 to-rose-600',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
  },
  tiktok: {
    name: 'TikTok Video Downloader',
    description: 'Save TikTok videos without watermark in HD.',
    icon: Smartphone,
    color: 'from-zinc-400 to-zinc-600',
    border: 'border-zinc-500/30',
    bg: 'bg-zinc-500/10',
  },
  instagram: {
    name: 'Instagram Reels Downloader',
    description: 'Download reels, videos, and photos from Instagram.',
    icon: Instagram,
    color: 'from-pink-500 to-rose-500',
    border: 'border-pink-500/30',
    bg: 'bg-pink-500/10',
  },
  facebook: {
    name: 'Facebook Video Downloader',
    description: 'Download Facebook videos in high resolution.',
    icon: Facebook,
    color: 'from-blue-500 to-blue-700',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
  },
} as const;

const fallbackThumb = '/assets/placeholders/media-thumbnail.svg';

const sanitizeDownloadName = (value: string, fallback: string) => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
};

const getFormatKey = (format: DownloadFormat, scope: 'video' | 'audio') =>
  `${scope}-${format.itag}-${format.container}-${format.quality}`;

export const MediaflowDownloader = ({
  initialTool,
  singleView,
}: MediaflowDownloaderProps) => {
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool || null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null);

  const isSingleView = singleView ?? Boolean(initialTool);

  const normalizeYoutubeUrl = (input: string) => {
    const match = input.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?/\s]{11})/
    );
    if (!match) return null;
    return `https://www.youtube.com/watch?v=${match[1]}`;
  };

  const videoFormats = useMemo(() => mediaInfo?.formats || [], [mediaInfo]);
  const audioFormats = useMemo(() => mediaInfo?.audioFormats || [], [mediaInfo]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await apiFetch('/api/history');
        const data = await response.json().catch(() => []);
        if (response.ok && Array.isArray(data)) {
          setHistory(data);
        }
      } catch {
        setHistory([]);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
      setUrl('');
      setMediaInfo(null);
      setError(null);
      setSummary(null);
    }
  }, [initialTool]);

  const reset = () => {
    setActiveTool(isSingleView ? initialTool || null : null);
    setUrl('');
    setMediaInfo(null);
    setError(null);
    setSummary(null);
    setDownloadNote(null);
    setDownloadFeedback(null);
  };

  const saveHistory = async (entry: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    setHistory((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...entry,
      },
      ...prev.filter((item) => item.url !== entry.url).slice(0, 9),
    ]);

    await apiFetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => undefined);
  };

  const buildFallbackInfo = (cleanedUrl: string, nextTitle?: string): MediaInfo => {
    const title = nextTitle?.trim() || 'Media file';
    const encodedUrl = encodeURIComponent(cleanedUrl);
    const encodedTitle = encodeURIComponent(title);

    return {
      title,
      thumbnail: fallbackThumb,
      author: '',
      duration: undefined,
      formats: [
        {
          quality: 'Best available',
          container: 'mp4',
          url: `/api/media/download?url=${encodedUrl}&mode=video&title=${encodedTitle}`,
          itag: 'server-fallback',
          hasAudio: true,
          hasVideo: true,
        },
      ],
      audioFormats: [
        {
          quality: 'Best available',
          container: 'mp3',
          url: `/api/media/download?url=${encodedUrl}&mode=audio&title=${encodedTitle}`,
          itag: 'server-fallback',
        },
      ],
      downloadUrl: undefined,
    };
  };

  const handleFetch = async () => {
    if (!url || !activeTool) return;

    setLoading(true);
    setError(null);
    setMediaInfo(null);
    setSummary(null);
    setDownloadNote(null);

    const cleanedUrl =
      activeTool === 'youtube' ? normalizeYoutubeUrl(url) || url.trim() : url.trim();

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

      const response = await apiFetch(`/api/${activeTool}/info?url=${encodeURIComponent(cleanedUrl)}`, {
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch media information.');
      }

      const nextInfo: MediaInfo = {
        title: payload?.title || 'Media file',
        thumbnail: payload?.thumbnail || fallbackThumb,
        author: payload?.author || '',
        duration: payload?.duration ? String(payload.duration) : undefined,
        formats: Array.isArray(payload?.formats) ? payload.formats : [],
        audioFormats: Array.isArray(payload?.audioFormats) ? payload.audioFormats : [],
        downloadUrl: payload?.downloadUrl,
      };

      if ((!nextInfo.formats || nextInfo.formats.length === 0) && nextInfo.downloadUrl) {
        nextInfo.formats = [
          {
            quality: 'Best',
            container: 'mp4',
            url: nextInfo.downloadUrl,
            itag: 'best',
            hasAudio: true,
            hasVideo: true,
          },
        ];
      }

      setUrl(cleanedUrl);
      setMediaInfo(nextInfo);
      await saveHistory({
        title: nextInfo.title,
        thumbnail: nextInfo.thumbnail,
        url: cleanedUrl,
        tool: activeTool,
      });
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Failed to fetch media information.';
      if (err instanceof Error && err.name === 'AbortError') {
        message = 'Format detection is taking longer than expected. Using the fast download fallback.';
      }
      // If providers are blocked or the request takes too long, still offer a reliable server-side download.
      setUrl(cleanedUrl);
      setMediaInfo(buildFallbackInfo(cleanedUrl, 'Media download'));
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!mediaInfo || !activeTool) return;
    setSummarizing(true);
    try {
      const response = await apiFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mediaInfo.title,
          author: mediaInfo.author,
          tool: activeTool,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Summary unavailable');
      }
      setSummary(payload?.summary || 'Quick summary is not available right now.');
    } catch {
      setSummary('Quick summary is not available right now, but your download links are ready.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleDownloadClick = async (
    format: DownloadFormat,
    label: string,
    formatKey: string
  ) => {
    try {
      setError(null);
      setDownloadNote(null);
      setDownloadFeedback({
        formatKey,
        label,
        status: 'starting',
        progress: null,
      });

      const href = /^https?:\/\//i.test(format.url) ? format.url : await apiHref(format.url);
      const extension = format.container || 'bin';
      const downloadName = `${sanitizeDownloadName(
        mediaInfo?.title || 'vinzatools-media',
        'vinzatools-media'
      )}.${extension}`;

      // Important: do NOT buffer large media in the browser (can crash mobile + blank the page).
      // Let the server stream the file with Content-Disposition so the download starts normally.
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setDownloadFeedback({
        formatKey,
        label,
        status: 'done',
        progress: 100,
      });
      setDownloadNote(`Download started: ${label}. Check your browser downloads.`);
      window.setTimeout(() => {
        setDownloadNote(null);
        setDownloadFeedback((current) =>
          current?.formatKey === formatKey ? null : current
        );
      }, 5000);
    } catch {
      setDownloadFeedback(null);
      setError('Download could not be started. Please try again.');
    }
  };

  const clearHistory = async () => {
    setHistory([]);
    await apiFetch('/api/history', { method: 'DELETE' }).catch(() => undefined);
  };

  return (
    <div
      className={`${isSingleView ? 'h-full bg-transparent' : 'min-h-screen bg-[#0a0505]'} flex flex-col relative overflow-hidden`}
    >
      {!isSingleView && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/20 via-[#0a0505] to-[#0a0505]" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </>
      )}

      {!isSingleView && (
        <nav className="h-20 border-b border-rose-500/10 bg-[#0a0505]/80 backdrop-blur-xl sticky top-0 z-50 relative">
          <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={reset}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/30 blur-lg rounded-full group-hover:bg-rose-500/50 transition-all" />
                <div className="relative w-10 h-10 bg-gradient-to-br from-rose-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <Download className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="font-black text-xl tracking-tight text-white group-hover:text-rose-400 transition-colors">
                Media<span className="text-rose-500">Flow</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {Object.entries(toolConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTool(key as ToolType)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTool === key
                        ? `${config.bg} ${config.border} border text-white`
                        : 'text-rose-400/60 hover:text-rose-300 hover:bg-rose-500/10'
                    }`}
                  >
                    <Icon size={16} />
                    {config.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full">
              <Shield size={14} className="text-rose-400" />
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Secure
              </span>
            </div>
          </div>
        </nav>
      )}

      <main
        className={`flex-1 ${isSingleView ? '' : 'max-w-7xl'} mx-auto px-6 py-12 w-full relative z-10`}
      >
        <AnimatePresence mode="wait">
          {!activeTool && !isSingleView ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-6 max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-sm font-bold uppercase tracking-wider"
                >
                  <Sparkles size={14} />
                  Free Media Downloader
                </motion.div>

                <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
                  Download Your Favorite <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-purple-600">
                    Media Content
                  </span>
                </h1>

                <p className="text-lg text-rose-400/60 max-w-2xl mx-auto leading-relaxed">
                  Download high-quality videos from YouTube, TikTok, Instagram, and Facebook.
                  Fast, free, and simple to use.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(toolConfig).map(([key, config], index) => {
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      className={`group relative p-8 bg-[#151010] rounded-3xl border ${config.border} transition-all cursor-pointer overflow-hidden`}
                      onClick={() => setActiveTool(key as ToolType)}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                      />

                      <div className="relative z-10">
                        <div
                          className={`mb-6 p-4 ${config.bg} rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300 border ${config.border}`}
                        >
                          <Icon className="w-8 h-8 text-white" />
                        </div>

                        <h3 className="text-xl font-black text-white mb-3">{config.name}</h3>
                        <p className="text-rose-400/50 text-sm mb-6 leading-relaxed">
                          {config.description}
                        </p>

                        <button
                          className={`w-full py-3 rounded-xl bg-gradient-to-r ${config.color} text-white font-bold shadow-lg opacity-90 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 cursor-pointer`}
                        >
                          <Play size={18} />
                          Open Tool
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                <div className="p-6 bg-[#151010] border border-rose-500/20 rounded-2xl">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/30">
                    <Zap size={24} className="text-emerald-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Fast Delivery</h4>
                  <p className="text-sm text-rose-400/50">
                    Fetch media details quickly and start your download with one click.
                  </p>
                </div>
                <div className="p-6 bg-[#151010] border border-rose-500/20 rounded-2xl">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 border border-purple-500/30">
                    <Shield size={24} className="text-purple-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Safer Downloads</h4>
                  <p className="text-sm text-rose-400/50">
                    Downloads run through your own VinzaTools backend for a more stable experience.
                  </p>
                </div>
                <div className="p-6 bg-[#151010] border border-rose-500/20 rounded-2xl">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 border border-amber-500/30">
                    <Download size={24} className="text-amber-400" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Best Quality</h4>
                  <p className="text-sm text-rose-400/50">
                    Use the highest quality available for video and MP3 audio exports.
                  </p>
                </div>
              </div>

              {history.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                      <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                        <History size={24} className="text-rose-400" />
                      </div>
                      Recent Downloads
                    </h2>
                    <button
                      onClick={clearHistory}
                      className="text-sm text-rose-400/60 hover:text-red-400 flex items-center gap-2 transition-colors px-4 py-2 bg-[#151010] border border-rose-500/20 rounded-xl hover:border-red-500/30 cursor-pointer"
                    >
                      <Trash2 size={16} />
                      Clear History
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#151010] p-4 rounded-2xl border border-rose-500/20 flex gap-4 items-center group hover:border-rose-500/40 transition-all cursor-pointer"
                        onClick={() => {
                          setActiveTool(item.tool as ToolType);
                          setUrl(item.url);
                        }}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-24 aspect-video object-cover rounded-xl shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] px-2 py-1 bg-rose-500/20 rounded text-rose-300 uppercase font-bold tracking-wider border border-rose-500/30">
                              {item.tool}
                            </span>
                          </div>
                        </div>
                        <div className="p-2 bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={16} className="text-rose-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tool"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              {!isSingleView && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-rose-400/60 hover:text-rose-400 transition-colors font-bold group cursor-pointer"
                >
                  <div className="p-2 bg-rose-500/10 rounded-xl group-hover:bg-rose-500/20 transition-colors border border-rose-500/20">
                    <ArrowLeft size={18} />
                  </div>
                  Back to Tools
                </button>
              )}

              <div className="bg-[#151010] border border-rose-500/20 rounded-3xl p-8 shadow-2xl space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-rose-500/10">
                  {(() => {
                    const config = toolConfig[activeTool];
                    const Icon = config.icon;
                    return (
                      <>
                        <div className={`p-3 ${config.bg} rounded-2xl border ${config.border}`}>
                          <Icon size={28} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white">{config.name}</h2>
                          <p className="text-rose-400/60 text-sm">
                            Paste the media link below to start downloading
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="https://..."
                      className="w-full px-5 py-4 bg-[#0f0a0a] border-2 border-rose-500/20 rounded-2xl text-white placeholder-rose-400/30 focus:border-rose-500 focus:shadow-lg focus:shadow-rose-500/10 outline-none transition-all"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-400/30">
                      {(() => {
                        const Icon = toolConfig[activeTool].icon;
                        return <Icon size={20} />;
                      })()}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFetch}
                    disabled={loading || !url}
                    className="px-8 py-4 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-2xl font-black shadow-xl shadow-rose-500/25 hover:shadow-rose-500/40 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <Download size={24} />
                    )}
                    {loading ? 'Fetching...' : 'Fetch Media'}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {downloadFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-sky-200 text-sm font-bold space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/20 rounded-lg">
                          {downloadFeedback.status === 'done' ? (
                            <CheckCircle2 size={18} className="text-emerald-400" />
                          ) : (
                            <Loader2 size={18} className="text-sky-300 animate-spin" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p>
                            {downloadFeedback.status === 'starting' &&
                              `Preparing ${downloadFeedback.label} download...`}
                            {downloadFeedback.status === 'downloading' &&
                              `Downloading ${downloadFeedback.label}...`}
                            {downloadFeedback.status === 'done' &&
                              `${downloadFeedback.label} download started successfully.`}
                          </p>
                          <p className="text-xs text-sky-300/70 font-medium">
                            {downloadFeedback.progress !== null
                              ? `Progress: ${downloadFeedback.progress}%`
                              : 'Please wait, your file is being prepared.'}
                          </p>
                        </div>
                      </div>
                      {downloadFeedback.progress !== null && (
                        <div className="h-2 rounded-full bg-sky-950/60 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-300"
                            style={{ width: `${downloadFeedback.progress}%` }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {downloadNote && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-bold flex items-center gap-3"
                    >
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      </div>
                      {downloadNote}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3"
                    >
                      <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                        <AlertCircle size={18} className="text-red-400" />
                      </div>
                      <p className="text-red-300 text-sm font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {mediaInfo && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-6 border-t border-rose-500/10 space-y-6"
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative group shrink-0">
                          <div className="absolute -inset-2 bg-gradient-to-r from-rose-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                          <img
                            src={mediaInfo.thumbnail || fallbackThumb}
                            alt={mediaInfo.title}
                            className="relative w-full md:w-56 aspect-video object-cover rounded-2xl shadow-2xl border border-rose-500/20"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                              <Play size={24} className="text-white" />
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 space-y-3">
                          <h3 className="text-xl font-black text-white leading-tight">
                            {mediaInfo.title}
                          </h3>
                          {mediaInfo.author && (
                            <p className="text-rose-400/60 flex items-center gap-2">
                              <span className="w-1 h-1 bg-rose-500 rounded-full" />
                              By {mediaInfo.author}
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-emerald-400">
                            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                              <CheckCircle2 size={16} />
                            </div>
                            <span className="text-sm font-bold">Ready to download</span>
                          </div>

                          {!summary && !summarizing && (
                            <button
                              onClick={handleSummarize}
                              className="text-xs text-rose-400 font-bold hover:text-rose-300 flex items-center gap-2 px-3 py-2 bg-rose-500/10 rounded-xl border border-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer"
                            >
                              <Sparkles size={14} />
                              Quick Summary
                            </button>
                          )}

                          {summarizing && (
                            <div className="flex items-center gap-2 text-xs text-rose-400/60 px-3 py-2">
                              <Loader2 size={14} className="animate-spin" />
                              Preparing summary...
                            </div>
                          )}

                          {summary && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="p-4 bg-gradient-to-r from-rose-500/10 to-purple-500/10 rounded-xl border border-rose-500/20"
                            >
                              <p className="text-sm text-rose-200 italic leading-relaxed">
                                "{summary}"
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                            <Video size={14} /> Video Quality
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {videoFormats.map((format, i) => {
                              const formatKey = getFormatKey(format, 'video');
                              const isDownloading = downloadFeedback?.formatKey === formatKey;
                              return (
                              <motion.button
                                key={`${format.itag}-${i}`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  handleDownloadClick(
                                    format,
                                    `${format.quality} ${format.container.toUpperCase()}`,
                                    formatKey
                                  )
                                }
                                disabled={Boolean(isDownloading)}
                                className="px-4 py-2 bg-[#0f0a0a] border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
                              >
                                {isDownloading ? (
                                  <Loader2 size={14} className="text-rose-400 animate-spin" />
                                ) : (
                                  <Download size={14} className="text-rose-400" />
                                )}
                                {isDownloading ? 'Starting...' : format.quality}
                                <span className="text-xs text-rose-400/60 uppercase">
                                  {format.container}
                                </span>
                              </motion.button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                            <Music size={14} /> Audio Only
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {audioFormats.map((format, i) => {
                              const formatKey = getFormatKey(format, 'audio');
                              const isDownloading = downloadFeedback?.formatKey === formatKey;
                              return (
                              <motion.button
                                key={`${format.itag}-${i}`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  handleDownloadClick(
                                    format,
                                    `${format.container.toUpperCase()} ${format.quality}`,
                                    formatKey
                                  )
                                }
                                disabled={Boolean(isDownloading)}
                                className="px-4 py-2 bg-[#0f0a0a] border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
                              >
                                {isDownloading ? (
                                  <Loader2 size={14} className="text-purple-400 animate-spin" />
                                ) : (
                                  <Music size={14} className="text-purple-400" />
                                )}
                                {isDownloading
                                  ? 'Starting...'
                                  : format.container.toUpperCase()}
                                <span className="text-xs text-purple-400/60">
                                  {format.quality}
                                </span>
                              </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#151010] border border-rose-500/20 rounded-2xl">
                  <h4 className="font-bold text-rose-300 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/20 rounded-lg">
                      <Sparkles size={14} className="text-rose-400" />
                    </div>
                    How to download?
                  </h4>
                  <p className="text-sm text-rose-400/50 leading-relaxed">
                    Copy the media link from your browser or app, paste it above, and click
                    &quot;Fetch Media&quot;. Then choose the quality you want.
                  </p>
                </div>
                <div className="p-6 bg-[#151010] border border-emerald-500/20 rounded-2xl">
                  <h4 className="font-bold text-emerald-300 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    </div>
                    Download Tip
                  </h4>
                  <p className="text-sm text-emerald-400/50 leading-relaxed">
                    If one link is slow, click another quality option. VinzaTools will use the best
                    available format for your request.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-rose-500/10 bg-[#0a0505] relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500/30 blur-lg rounded-full" />
              <div className="relative w-8 h-8 bg-gradient-to-br from-rose-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="font-black text-xl tracking-tight text-white">
              VinzaTools <span className="text-rose-500">Media</span>
            </span>
          </div>

          <p className="text-rose-400/40 text-sm">
            © 2026 VinzaTools Media Downloader. All rights reserved.
          </p>

          <div className="flex items-center justify-center gap-8 text-xs font-bold text-rose-400/40">
            <a href="#/policy" className="hover:text-rose-400 transition-colors">
              Terms of Service
            </a>
            <span className="w-1 h-1 bg-rose-500/30 rounded-full" />
            <a href="#/policy" className="hover:text-rose-400 transition-colors">
              Privacy Policy
            </a>
            <span className="w-1 h-1 bg-rose-500/30 rounded-full" />
            <a href="#/contact" className="hover:text-rose-400 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

