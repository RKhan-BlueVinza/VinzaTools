import React, { Suspense, useMemo, useState } from 'react';
import {
  FileText,
  FileArchive,
  Eraser,
  Image as ImageIcon,
  QrCode,
} from 'lucide-react';
import type { PdfAction } from './components/PdfTools';
import type { DevAction } from './components/DevTools';
import type { ToolType as MediaToolType } from './components/MediaflowDownloader';
import type { ImageToolkitMode } from './components/ImageToolkit';
import type { MediaTranscoderMode } from './components/MediaTranscoder';
import type { PdfAdvancedMode } from './components/PdfAdvancedTools';
import type { UtilityMode } from './components/UtilityConverters';
import rizwanImage from './assets/images/team-images/rizwan.webp';
import type { ToolCategory, PageKey, ContactTab, ToolContext, Tool } from './types/app';
import { SiteLayout } from './layouts/SiteLayout';
import { BrandMark } from './components/BrandMark';
import { apiFetch } from './api';
import { trackGaEvent } from './lib/analytics';

const ResumeBuilder = React.lazy(() => import('./components/ResumeBuilder').then((m) => ({ default: m.ResumeBuilder })));
const PosterMaker = React.lazy(() => import('./components/PosterMaker').then((m) => ({ default: m.PosterMaker })));
const ImageCompare = React.lazy(() => import('./components/ImageCompare').then((m) => ({ default: m.ImageCompare })));
const PdfTools = React.lazy(() => import('./components/PdfTools').then((m) => ({ default: m.PdfTools })));
const BackgroundRemover = React.lazy(() => import('./components/BackgroundRemover').then((m) => ({ default: m.BackgroundRemover })));
const DevTools = React.lazy(() => import('./components/DevTools').then((m) => ({ default: m.DevTools })));
const ImageConverter = React.lazy(() => import('./components/ImageConverter').then((m) => ({ default: m.ImageConverter })));
const MediaflowDownloader = React.lazy(() => import('./components/MediaflowDownloader').then((m) => ({ default: m.MediaflowDownloader })));
const YoutubeThumbnailDownloader = React.lazy(() => import('./components/YoutubeThumbnailDownloader').then((m) => ({ default: m.YoutubeThumbnailDownloader })));
const CorporatePosterStudio = React.lazy(() => import('./components/CorporatePosterStudio').then((m) => ({ default: m.CorporatePosterStudio })));
const PasswordGenerator = React.lazy(() => import('./components/PasswordGenerator').then((m) => ({ default: m.PasswordGenerator })));
const UrlEncoderDecoder = React.lazy(() => import('./components/UrlEncoderDecoder').then((m) => ({ default: m.UrlEncoderDecoder })));
const CaseConverter = React.lazy(() => import('./components/CaseConverter').then((m) => ({ default: m.CaseConverter })));
const SlugGenerator = React.lazy(() => import('./components/SlugGenerator').then((m) => ({ default: m.SlugGenerator })));
const ImageCompressor = React.lazy(() => import('./components/ImageCompressor').then((m) => ({ default: m.ImageCompressor })));
const QRCodeGenerator = React.lazy(() => import('./components/QRCodeGenerator').then((m) => ({ default: m.QRCodeGenerator })));
const ColorPaletteGenerator = React.lazy(() => import('./components/ColorPaletteGenerator').then((m) => ({ default: m.ColorPaletteGenerator })));
const DatabaseViewer = React.lazy(() => import('./components/DatabaseViewer').then((m) => ({ default: m.DatabaseViewer })));
const CsvViewer = React.lazy(() => import('./components/CsvViewer').then((m) => ({ default: m.CsvViewer })));
const KeywordDensityChecker = React.lazy(() => import('./components/KeywordDensityChecker').then((m) => ({ default: m.KeywordDensityChecker })));
const ShopifyHelper = React.lazy(() => import('./components/ShopifyHelper').then((m) => ({ default: m.ShopifyHelper })));
const TextCounter = React.lazy(() => import('./components/TextCounter').then((m) => ({ default: m.TextCounter })));
const ParagraphGenerator = React.lazy(() => import('./components/ParagraphGenerator').then((m) => ({ default: m.ParagraphGenerator })));
const GoogleAuthenticator = React.lazy(() => import('./components/GoogleAuthenticator').then((m) => ({ default: m.GoogleAuthenticator })));
const ImageToolkit = React.lazy(() => import('./components/ImageToolkit').then((m) => ({ default: m.ImageToolkit })));
const MediaTranscoder = React.lazy(() => import('./components/MediaTranscoder').then((m) => ({ default: m.MediaTranscoder })));
const PdfAdvancedTools = React.lazy(() => import('./components/PdfAdvancedTools').then((m) => ({ default: m.PdfAdvancedTools })));
const UtilityConverters = React.lazy(() => import('./components/UtilityConverters').then((m) => ({ default: m.UtilityConverters })));
const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ToolsPage = React.lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const TeamPage = React.lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const BlogPage = React.lazy(() => import('./pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const AboutPage = React.lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const ContactPage = React.lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const ThemesPage = React.lazy(() => import('./pages/ThemesPage').then((m) => ({ default: m.ThemesPage })));
const PolicyPage = React.lazy(() => import('./pages/PolicyPage').then((m) => ({ default: m.PolicyPage })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const CookiePolicyPage = React.lazy(() => import('./pages/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage })));

const PageFallback = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="relative flex min-h-[460px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.16),_transparent_35%),linear-gradient(180deg,#181011_0%,#0f090a_100%)] px-6 py-14 text-center shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.04)_35%,transparent_65%)] animate-[pulse_2.8s_ease-in-out_infinite]" />
    <div className="relative z-10 flex max-w-md flex-col items-center gap-6">
      <BrandMark subtitle="Tools Loading Securely" className="bg-white/8 px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]" />
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-rose-200/80">
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-rose-300 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-rose-400 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-rose-500" />
          </span>
          Preparing Workspace
        </div>
        <div className="text-2xl font-black tracking-tight text-white">{label}</div>
        <div className="text-sm leading-7 text-slate-300/80">
          VinzaTools is setting up your files, tools, and preview area so everything opens cleanly.
        </div>
      </div>
    </div>
  </div>
);

const HOME_PREVIEW_TOOLS: Tool[] = [
  {
    id: 'resume-builder',
    name: 'Professional Resume Builder',
    description: 'Build ATS-ready resumes with modern templates and exports.',
    category: 'creative',
    icon: FileText,
  },
  {
    id: 'poster-maker',
    name: 'Poster Maker & Flyer Designer',
    description: 'Design posters, flyers, and banners with clean layouts.',
    category: 'creative',
    icon: FileText,
  },
  {
    id: 'pdf-merge',
    name: 'Merge PDF Files',
    description: 'Combine multiple PDFs into one file in order.',
    category: 'pdf',
    icon: FileArchive,
  },
  {
    id: 'pdf-compress',
    name: 'Compress PDF File',
    description: 'Reduce PDF size while keeping quality.',
    category: 'pdf',
    icon: FileArchive,
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word Converter',
    description: 'Convert PDF into editable Word.',
    category: 'pdf',
    icon: FileText,
  },
  {
    id: 'bg-remover',
    name: 'AI Background Remover',
    description: 'Remove image backgrounds with smart cleanup.',
    category: 'image',
    icon: Eraser,
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    description: 'Compress images for faster websites and quick sharing.',
    category: 'image',
    icon: ImageIcon,
  },
  {
    id: 'qr-code-generator',
    name: 'QR Code Generator',
    description: 'Create branded QR codes for links, cards, and campaigns.',
    category: 'image',
    icon: QrCode,
  },
  {
    id: 'media-youtube',
    name: 'YouTube Video Downloader',
    description: 'Download YouTube video or audio.',
    category: 'media',
    icon: FileArchive,
  },
  {
    id: 'db-viewer',
    name: 'DB Viewer',
    description: 'Browse MySQL tables and records in a safe read-only viewer.',
    category: 'developer',
    icon: FileArchive,
  },
  {
    id: 'csv-viewer',
    name: 'CSV / XLSX Viewer',
    description: 'Open spreadsheet files and review rows directly in the browser.',
    category: 'developer',
    icon: FileArchive,
  },
  {
    id: 'keyword-density-checker',
    name: 'Keyword Density Checker',
    description: 'Check repeated keywords and SEO focus inside content drafts.',
    category: 'text',
    icon: FileText,
  },
  {
    id: 'color-palette-generator',
    name: 'Color Palette Generator',
    description: 'Generate brand color palettes for posters, apps, and websites.',
    category: 'creative',
    icon: ImageIcon,
  },
  {
    id: 'resize-image',
    name: 'Resize Image',
    description: 'Resize images with width and height controls.',
    category: 'image',
    icon: ImageIcon,
  },
  {
    id: 'crop-image',
    name: 'Crop Image',
    description: 'Crop a selected image area and export fast.',
    category: 'image',
    icon: ImageIcon,
  },
  {
    id: 'text-counter',
    name: 'Word & Character Counter',
    description: 'Count words, characters, and sentences instantly.',
    category: 'text',
    icon: FileText,
  },
];

const HOME_SPOTLIGHT_TOOL_IDS = [
  'shopify-helper',
  'qr-code-generator',
  'image-compressor',
  'db-viewer',
  'csv-viewer',
  'keyword-density-checker',
  'color-palette-generator',
  'resize-image',
  'crop-image',
  'color-picker',
  'rotate-image',
  'flip-image',
  'image-enlarger',
  'gif-maker',
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
  'mp4-to-mp3',
  'video-to-gif',
  'gif-to-mp4',
  'unit-converter',
  'time-converter',
  'archive-converter',
] as const;

const HOME_FEATURED_PREVIEW_IDS = [
  'bg-remover',
  'pdf-merge',
  'pdf-compress',
  'image-compressor',
  'qr-code-generator',
  'media-youtube',
] as const;

const PAGE_LABELS: { key: PageKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'tools', label: 'Tools' },
  { key: 'themes', label: 'Themes' },
  { key: 'team', label: 'Team' },
  { key: 'blog', label: 'Blog' },
  { key: 'about', label: 'About' },
  { key: 'contact', label: 'Contact' }
];

const PDF_ACTION_TO_ID: Record<PdfAction, string> = {
  merge: 'pdf-merge',
  split: 'pdf-split',
  compress: 'pdf-compress',
  rotate: 'pdf-rotate',
  'pdf-to-jpg': 'pdf-to-jpg',
  'jpg-to-pdf': 'jpg-to-pdf',
  'pdf-to-word': 'pdf-to-word',
  'pdf-to-ppt': 'pdf-to-ppt',
  'pdf-to-excel': 'pdf-to-excel',
  'edit-pdf': 'edit-pdf',
  'watermark-pdf': 'watermark-pdf',
  'sign-pdf': 'sign-pdf',
  'protect-pdf': 'protect-pdf',
  'unlock-pdf': 'unlock-pdf',
  'ocr-pdf': 'ocr-pdf',
  'scan-to-pdf': 'scan-to-pdf',
  'word-to-pdf': 'word-to-pdf',
  'ppt-to-pdf': 'ppt-to-pdf',
  'excel-to-pdf': 'excel-to-pdf',
  'html-to-pdf': 'html-to-pdf',
  'pdf-to-pdfa': 'pdf-to-pdfa',
  'page-numbers': 'page-numbers',
  'crop-pdf': 'crop-pdf',
  'compare-pdf': 'compare-pdf',
  'redact-pdf': 'redact-pdf',
  'translate-pdf': 'translate-pdf'
};

const PDF_ID_TO_ACTION: Record<string, PdfAction> = Object.entries(PDF_ACTION_TO_ID).reduce(
  (acc, [action, id]) => {
    acc[id] = action as PdfAction;
    return acc;
  },
  {} as Record<string, PdfAction>
);

const DEV_ACTION_TO_ID: Record<DevAction, string> = {
  json: 'dev-json',
  minify: 'dev-minify',
  base64: 'dev-base64',
  'svg-viewer': 'dev-svg'
};

const DEV_ID_TO_ACTION: Record<string, DevAction> = Object.entries(DEV_ACTION_TO_ID).reduce(
  (acc, [action, id]) => {
    acc[id] = action as DevAction;
    return acc;
  },
  {} as Record<string, DevAction>
);

const MEDIA_ACTION_TO_ID: Record<MediaToolType, string> = {
  youtube: 'media-youtube',
  tiktok: 'media-tiktok',
  instagram: 'media-instagram',
  facebook: 'media-facebook'
};

const MEDIA_ID_TO_ACTION: Record<string, MediaToolType> = Object.entries(MEDIA_ACTION_TO_ID).reduce(
  (acc, [action, id]) => {
    acc[id] = action as MediaToolType;
    return acc;
  },
  {} as Record<string, MediaToolType>
);

const IMAGE_TOOLKIT_CONFIG: Record<
  string,
  { mode: ImageToolkitMode; title: string; description: string }
> = {
  'resize-image': {
    mode: 'resize',
    title: 'Resize Image',
    description: 'Resize images with width and height controls.',
  },
  'crop-image': {
    mode: 'crop',
    title: 'Crop Image',
    description: 'Crop your image with percentage-based controls.',
  },
  'color-picker': {
    mode: 'color-picker',
    title: 'Color Picker',
    description: 'Sample exact colors from any uploaded image.',
  },
  'rotate-image': {
    mode: 'rotate',
    title: 'Rotate Image',
    description: 'Rotate an image and export it instantly.',
  },
  'flip-image': {
    mode: 'flip',
    title: 'Flip Image',
    description: 'Flip images horizontally or vertically with one click.',
  },
  'image-enlarger': {
    mode: 'enlarge',
    title: 'Image Enlarger',
    description: 'Enlarge images smoothly for previews and quick exports.',
  },
};

const PDF_ADVANCED_CONFIG: Record<
  string,
  { mode: PdfAdvancedMode; title: string; description: string }
> = {
  'organize-pdf': {
    mode: 'organize',
    title: 'Organize PDF Pages',
    description: 'Reorder PDF pages with a custom sequence like 3,1,2.',
  },
  'flatten-pdf': {
    mode: 'flatten',
    title: 'Flatten PDF',
    description: 'Flatten PDF pages into a safer shared file.',
  },
  'resize-pdf': {
    mode: 'resize',
    title: 'Resize PDF Pages',
    description: 'Resize PDF pages for A4 or Letter output.',
  },
  'extract-image-from-pdf': {
    mode: 'extract-images',
    title: 'Extract Image from PDF',
    description: 'Export PDF pages as image files in one zip.',
  },
  'pdf-page-remover': {
    mode: 'page-remover',
    title: 'PDF Page Remover',
    description: 'Remove selected pages from a PDF and download the result.',
  },
  'extract-pages-from-pdf': {
    mode: 'extract-pages',
    title: 'Extract Pages from PDF',
    description: 'Extract selected pages into a fresh PDF document.',
  },
};

const MEDIA_TRANSCODER_CONFIG: Record<
  string,
  { mode: MediaTranscoderMode; title: string; description: string }
> = {
  'crop-video': {
    mode: 'crop-video',
    title: 'Crop Video',
    description: 'Crop the visible area of your video and export a clean file.',
  },
  'trim-video': {
    mode: 'trim-video',
    title: 'Trim Video',
    description: 'Trim a video by setting the start and end time.',
  },
  'video-converter': {
    mode: 'video-converter',
    title: 'Video Converter',
    description: 'Convert videos to MP4, MOV, WEBM, or GIF.',
  },
  'audio-converter': {
    mode: 'audio-converter',
    title: 'Audio Converter',
    description: 'Convert audio files into MP3, WAV, AAC, or OGG.',
  },
  'mp3-converter': {
    mode: 'mp3-converter',
    title: 'MP3 Converter',
    description: 'Convert supported media into MP3.',
  },
  'mp4-to-mp3': {
    mode: 'mp4-to-mp3',
    title: 'MP4 to MP3 Converter',
    description: 'Extract MP3 audio from MP4 video.',
  },
  'video-to-mp3': {
    mode: 'video-to-mp3',
    title: 'Video to MP3 Converter',
    description: 'Turn video clips into MP3 audio.',
  },
  'mp4-converter': {
    mode: 'mp4-converter',
    title: 'MP4 Converter',
    description: 'Convert supported video files into MP4.',
  },
  'mov-to-mp4': {
    mode: 'mov-to-mp4',
    title: 'MOV to MP4 Converter',
    description: 'Convert MOV clips into MP4 format.',
  },
  'mp3-to-ogg': {
    mode: 'mp3-to-ogg',
    title: 'MP3 to OGG Converter',
    description: 'Convert MP3 audio into OGG format.',
  },
  'video-to-gif': {
    mode: 'video-to-gif',
    title: 'Video to GIF Converter',
    description: 'Convert a video clip into an animated GIF.',
  },
  'mp4-to-gif': {
    mode: 'mp4-to-gif',
    title: 'MP4 to GIF Converter',
    description: 'Convert MP4 files into GIF animations.',
  },
  'webm-to-gif': {
    mode: 'webm-to-gif',
    title: 'WEBM to GIF Converter',
    description: 'Convert WEBM videos into GIF animations.',
  },
  'gif-to-mp4': {
    mode: 'gif-to-mp4',
    title: 'GIF to MP4 Converter',
    description: 'Convert GIF animations into MP4 video.',
  },
  'gif-to-apng': {
    mode: 'gif-to-apng',
    title: 'GIF to APNG Converter',
    description: 'Convert GIF animations into APNG.',
  },
  'apng-to-gif': {
    mode: 'apng-to-gif',
    title: 'APNG to GIF Converter',
    description: 'Convert APNG animations into GIF format.',
  },
  'gif-maker': {
    mode: 'gif-maker',
    title: 'GIF Maker',
    description: 'Create an animated GIF from uploaded images.',
  },
  'image-to-gif': {
    mode: 'image-to-gif',
    title: 'Image to GIF Converter',
    description: 'Turn multiple still images into a GIF.',
  },
  'mov-to-gif': {
    mode: 'mov-to-gif',
    title: 'MOV to GIF Converter',
    description: 'Convert MOV clips into GIF animations.',
  },
  'avi-to-gif': {
    mode: 'avi-to-gif',
    title: 'AVI to GIF Converter',
    description: 'Convert AVI video files into GIF animations.',
  },
};

const UTILITY_TOOL_CONFIG: Record<string, UtilityMode> = {
  'unit-converter': 'unit-converter',
  'time-converter': 'time-converter',
  'archive-converter': 'archive-converter',
};

export default function App() {
  const adminRoute =
    (import.meta?.env?.VITE_ADMIN_ROUTE as string | undefined)?.trim().toLowerCase() || 'admin';
  const envGaId = (import.meta?.env?.VITE_GA_ID as string | undefined)?.trim() || '';
  const fallbackGaId =
    typeof window !== 'undefined' && window.location.hostname.endsWith('vinzatools.com')
      ? 'G-L07YYMBBL7'
      : '';
  const gaId = envGaId || fallbackGaId;
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const [page, setPage] = useState<PageKey>('home');
  const [contactTab, setContactTab] = useState<ContactTab>('general');
  const [toolContext, setToolContext] = useState<ToolContext | null>(null);
  const [allTools, setAllTools] = useState<Tool[]>(HOME_PREVIEW_TOOLS);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const validPages = new Set<PageKey>([
      'home',
      'tools',
      'themes',
      'team',
      'blog',
      'about',
      'contact',
      'policy',
      'terms',
      'cookies',
      'admin',
    ]);
    const handleHash = () => {
      const raw = window.location.hash.replace('#', '').toLowerCase();
      const slug = raw.startsWith('/') ? raw.slice(1) : raw;
      const path = window.location.pathname.toLowerCase();
      if (slug === adminRoute || path.endsWith(`/${adminRoute}`)) {
        setPage('admin');
      } else if (validPages.has(slug as PageKey)) {
        setPage(slug as PageKey);
      } else if (!slug) {
        setPage('home');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [adminRoute]);

  const ensureCatalogLoaded = () => {
    if (catalogReady || catalogLoading) return;
    setCatalogLoading(true);
    import('./data/toolCatalog')
      .then(({ INTERNAL_TOOLS }) => {
        setAllTools(INTERNAL_TOOLS);
        setCatalogReady(true);
      })
      .catch(() => null)
      .finally(() => setCatalogLoading(false));
  };

  React.useEffect(() => {
    if (page === 'home' || page === 'admin') return;
    ensureCatalogLoaded();
  }, [page]);

  React.useEffect(() => {
    if (!gaId || typeof document === 'undefined') return;
    const existing = document.querySelector(`script[data-ga-id="${gaId}"]`);
    if (existing) return;

    const loadGa = () => {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      script.setAttribute('data-ga-id', gaId);
      document.head.appendChild(script);

      const inline = document.createElement('script');
      inline.setAttribute('data-ga-inline', gaId);
      inline.innerHTML =
        "window.dataLayer = window.dataLayer || [];" +
        "function gtag(){dataLayer.push(arguments);} window.gtag=gtag;" +
        `gtag('js', new Date()); gtag('config', '${gaId}', { send_page_view: false });`;
      document.head.appendChild(inline);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(loadGa, { timeout: 4000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(loadGa, 2500);
    return () => window.clearTimeout(timer);
  }, [gaId]);

  React.useEffect(() => {
    if (!gaId || typeof window === 'undefined') return;
    if (typeof window.gtag !== 'function') return;
    const path = page === 'home' ? '/' : `/${page}`;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: document.title,
    });
  }, [gaId, page]);

  const homePreviewTools = useMemo(() => {
    const map = new Map(allTools.map((tool) => [tool.id, tool]));
    return HOME_PREVIEW_TOOLS.map((tool) => map.get(tool.id) || tool);
  }, [allTools]);

  const filteredTools = useMemo(() => {
    const source = page === 'home' ? homePreviewTools : allTools;
    return source.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allTools, homePreviewTools, searchQuery, activeCategory, page]);

  const featuredTools = useMemo(() => {
    if (catalogReady) {
      const order = new Map(HOME_SPOTLIGHT_TOOL_IDS.map((id, index) => [id, index]));
      return allTools
        .filter((tool) => order.has(tool.id as (typeof HOME_SPOTLIGHT_TOOL_IDS)[number]))
        .sort(
          (a, b) =>
            (order.get(a.id as (typeof HOME_SPOTLIGHT_TOOL_IDS)[number]) ?? 0) -
            (order.get(b.id as (typeof HOME_SPOTLIGHT_TOOL_IDS)[number]) ?? 0)
        )
        .slice(0, 6);
    }

    const order = new Map(HOME_FEATURED_PREVIEW_IDS.map((id, index) => [id, index]));
    return homePreviewTools
      .filter((tool) => order.has(tool.id as (typeof HOME_FEATURED_PREVIEW_IDS)[number]))
      .sort(
        (a, b) =>
          (order.get(a.id as (typeof HOME_FEATURED_PREVIEW_IDS)[number]) ?? 0) -
          (order.get(b.id as (typeof HOME_FEATURED_PREVIEW_IDS)[number]) ?? 0)
      )
      .slice(0, 6);
  }, [allTools, catalogReady, homePreviewTools]);

  const renderTool = () => {
    const pdfAction = activeToolId ? PDF_ID_TO_ACTION[activeToolId] : undefined;
    if (pdfAction) {
      return <PdfTools initialAction={pdfAction} startInTool />;
    }

    const devAction = activeToolId ? DEV_ID_TO_ACTION[activeToolId] : undefined;
    if (devAction) {
      return <DevTools initialAction={devAction} singleView />;
    }

    const mediaAction = activeToolId ? MEDIA_ID_TO_ACTION[activeToolId] : undefined;
    if (mediaAction) {
      return <MediaflowDownloader initialTool={mediaAction} singleView />;
    }

    const imageToolkitConfig = activeToolId ? IMAGE_TOOLKIT_CONFIG[activeToolId] : undefined;
    if (imageToolkitConfig) {
      return (
        <ImageToolkit
          mode={imageToolkitConfig.mode}
          title={imageToolkitConfig.title}
          description={imageToolkitConfig.description}
        />
      );
    }

    const pdfAdvancedConfig = activeToolId ? PDF_ADVANCED_CONFIG[activeToolId] : undefined;
    if (pdfAdvancedConfig) {
      return (
        <PdfAdvancedTools
          mode={pdfAdvancedConfig.mode}
          title={pdfAdvancedConfig.title}
          description={pdfAdvancedConfig.description}
        />
      );
    }

    const mediaTranscoderConfig = activeToolId ? MEDIA_TRANSCODER_CONFIG[activeToolId] : undefined;
    if (mediaTranscoderConfig) {
      return (
        <MediaTranscoder
          mode={mediaTranscoderConfig.mode}
          title={mediaTranscoderConfig.title}
          description={mediaTranscoderConfig.description}
        />
      );
    }

    const utilityMode = activeToolId ? UTILITY_TOOL_CONFIG[activeToolId] : undefined;
    if (utilityMode) {
      return <UtilityConverters mode={utilityMode} />;
    }

    switch (activeToolId) {
      case 'resume-builder': return <ResumeBuilder />;
      case 'poster-maker': return <PosterMaker />;
      case 'corporate-poster-studio': return <CorporatePosterStudio />;
      case 'image-compare': return <ImageCompare />;
      case 'pdf-tools': return (
        <PdfTools
          initialAction={toolContext?.toolId === 'pdf-tools' ? (toolContext.subAction as PdfAction) : undefined}
          startInTool={toolContext?.toolId === 'pdf-tools'}
        />
      );
      case 'bg-remover': return <BackgroundRemover />;
      case 'image-converter': return <ImageConverter />;
      case 'webp-to-png':
      case 'jfif-to-png':
      case 'heic-to-jpg':
      case 'heic-to-png':
      case 'webp-to-jpg':
        return <ImageConverter />;
      case 'youtube-thumbnail-downloader': return <YoutubeThumbnailDownloader />;
      case 'image-compressor': return <ImageCompressor />;
      case 'qr-code-generator': return <QRCodeGenerator />;
      case 'color-palette-generator': return <ColorPaletteGenerator />;
      case 'text-counter': return <TextCounter />;
      case 'paragraph-generator': return <ParagraphGenerator />;
      case 'case-converter': return <CaseConverter />;
      case 'slug-generator': return <SlugGenerator />;
      case 'keyword-density-checker': return <KeywordDensityChecker />;
      case 'google-authenticator': return <GoogleAuthenticator />;
      case 'password-generator': return <PasswordGenerator />;
      case 'url-encoder': return <UrlEncoderDecoder />;
      case 'db-viewer': return <DatabaseViewer />;
      case 'csv-viewer': return <CsvViewer />;
      case 'shopify-helper': return <ShopifyHelper />;
      case 'mediaflow-downloader': return (
        <MediaflowDownloader
          initialTool={toolContext?.toolId === 'mediaflow-downloader' ? (toolContext.subAction as MediaToolType) : undefined}
        />
      );
      case 'dev-tools': return (
        <DevTools initialAction={toolContext?.toolId === 'dev-tools' ? (toolContext.subAction as DevAction) : undefined} />
      );
      default: return null;
    }
  };

  const setPageWithRoute = (next: PageKey) => {
    setPage(next);
    if (typeof window === 'undefined') return;
    const scrollHome = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    if (next === 'admin') {
      history.pushState(null, '', `/${adminRoute}`);
      window.location.hash = `#/${adminRoute}`;
      scrollHome();
      return;
    }
    const hasAdminHash = window.location.hash.toLowerCase().includes(adminRoute);
    const isAdminPath = window.location.pathname.toLowerCase().endsWith(`/${adminRoute}`);
    if (hasAdminHash || isAdminPath) {
      const cleanPath = window.location.pathname.replace(new RegExp(`/${adminRoute}$`, 'i'), '');
      history.replaceState(null, '', cleanPath || '/');
    }
    window.location.hash = next === 'home' ? '' : `#/${next}`;
    scrollHome();
  };

  const goTools = () => {
    setPageWithRoute('tools');
    setActiveToolId(null);
  };

  const getClientId = () => {
    const key = 'vinzatools_client_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  };

  const trackToolUsage = async (toolId: string, subAction?: string) => {
    try {
      const clientId = getClientId();
      await apiFetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, subAction, clientId })
      });
    } catch {
      // silent
    }
  };

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getToolName = (toolId?: string | null) => {
    if (!toolId) return undefined;
    if (toolId === 'pdf-tools') return 'PDF Tools';
    if (toolId === 'dev-tools') return 'Developer Tools';
    if (toolId === 'mediaflow-downloader') return 'Media Downloader';
    const tool = allTools.find((item) => item.id === toolId);
    return tool?.name;
  };

  const handleToolClick = (tool: Tool) => {
    trackToolUsage(tool.id, tool.subAction);
    trackGaEvent('tool_used', {
      tool_id: tool.id,
      tool_name: tool.name,
      sub_action: tool.subAction || '',
    });
    setToolContext(null);
    setActiveToolId(tool.id);
    setPageWithRoute('tools');
    scrollToTop();
  };

  const openSubTool = (toolId: string, subAction: string) => {
    if (toolId === 'pdf-tools') {
      const mappedId = PDF_ACTION_TO_ID[subAction as PdfAction];
      if (mappedId) {
        trackToolUsage(mappedId, subAction);
        const mappedToolName = getToolName(mappedId);
        if (!mappedToolName && !catalogReady) {
          ensureCatalogLoaded();
        }
        trackGaEvent('tool_used', {
          tool_id: mappedId,
          tool_name: mappedToolName || mappedId,
          sub_action: subAction,
        });
        setToolContext(null);
        setActiveToolId(mappedId);
        setPageWithRoute('tools');
        scrollToTop();
        return;
      }
    }

    if (toolId === 'dev-tools') {
      const mappedId = DEV_ACTION_TO_ID[subAction as DevAction];
      if (mappedId) {
        trackToolUsage(mappedId, subAction);
        const mappedToolName = getToolName(mappedId);
        if (!mappedToolName && !catalogReady) {
          ensureCatalogLoaded();
        }
        trackGaEvent('tool_used', {
          tool_id: mappedId,
          tool_name: mappedToolName || mappedId,
          sub_action: subAction,
        });
        setToolContext(null);
        setActiveToolId(mappedId);
        setPageWithRoute('tools');
        scrollToTop();
        return;
      }
    }

    if (toolId === 'mediaflow-downloader') {
      const mappedId = MEDIA_ACTION_TO_ID[subAction as MediaToolType];
      if (mappedId) {
        trackToolUsage(mappedId, subAction);
        const mappedToolName = getToolName(mappedId);
        if (!mappedToolName && !catalogReady) {
          ensureCatalogLoaded();
        }
        trackGaEvent('tool_used', {
          tool_id: mappedId,
          tool_name: mappedToolName || mappedId,
          sub_action: subAction,
        });
        setToolContext(null);
        setActiveToolId(mappedId);
        setPageWithRoute('tools');
        scrollToTop();
        return;
      }
    }

    trackToolUsage(toolId, subAction);
    const mappedToolName = getToolName(toolId);
    if (!mappedToolName && !catalogReady) {
      ensureCatalogLoaded();
    }
    trackGaEvent('tool_used', {
      tool_id: toolId,
      tool_name: mappedToolName || toolId,
      sub_action: subAction,
    });
    setToolContext({ toolId, subAction });
    setActiveToolId(toolId);
    setPageWithRoute('tools');
    scrollToTop();
  };

  const activeToolName =
    getToolName(activeToolId) || (!catalogReady && activeToolId ? 'Loading tool...' : undefined);
  const showToolsFallback =
    page === 'tools' &&
    !catalogReady &&
    (!activeToolId || !allTools.find((tool) => tool.id === activeToolId));

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'VinzaTools';
    const baseDesc =
      'VinzaTools is an all-in-one toolkit for PDFs, images, media, Shopify themes, resumes, and developer utilities with a fast, friendly workflow.';
    const baseKeywords =
      'vinzatools, pdf tools, media downloader, image tools, shopify themes, resume builder, poster maker, background remover, image converter, word counter, paragraph generator, developer tools';

    let title = baseTitle;
    let description = baseDesc;
    let keywords = baseKeywords;
    let robots = 'index,follow';

    const toolKeywordsByGroup: Record<string, string> = {
      pdf: 'pdf tools, pdf converter, merge pdf, split pdf, compress pdf, pdf to word, pdf to powerpoint, pdf to excel, word to pdf, ppt to pdf, excel to pdf, jpg to pdf',
      image: 'image tools, image converter, background remover, compare images, youtube thumbnail downloader',
      media: 'youtube downloader, tiktok downloader, instagram downloader, facebook downloader, video downloader',
      developer: 'json formatter, code minifier, base64 encoder, svg viewer, google authenticator, totp generator, 2fa codes',
      creative: 'resume builder, poster maker, corporate poster studio',
      text: 'word counter, character counter, paragraph generator, word count'
    };

    if (page === 'home') {
      title = 'VinzaTools | Background Remover, PDF Tools, and Video Downloaders';
      description = 'Use VinzaTools for background remover, PDF tools, PDF to Word, YouTube video downloads, and Instagram, TikTok, and Facebook media workflows.';
      keywords = `${baseKeywords}, background remover, youtube downloader, instagram downloader, tiktok downloader, facebook downloader, pdf to word, pdf merge, pdf split, jpg to pdf`;
    } else if (page === 'tools') {
      const activeTool = activeToolId ? allTools.find((tool) => tool.id === activeToolId) : undefined;
      if (activeTool) {
        title = `${activeTool.name} | VinzaTools`;
        description = `Use ${activeTool.name} on VinzaTools to finish your task quickly with clean, downloadable results.`;
        const groupKeywords = toolKeywordsByGroup[activeTool.category] || '';
        keywords = `${baseKeywords}, ${activeTool.name.toLowerCase()}, ${groupKeywords}`.trim();
      } else if (catalogReady && activeToolId) {
        title = `${activeToolId} | VinzaTools`;
        description = 'Use VinzaTools to finish your task quickly with clean, downloadable results.';
        keywords = `${baseKeywords}, ${activeToolId}`;
      } else {
        title = 'All Tools | VinzaTools';
        description = 'Browse all available tools for PDF, image, and text tasks in one place.';
        keywords = `${baseKeywords}, all tools`;
      }
    } else if (page === 'team') {
      title = 'Team | VinzaTools';
      description = 'Meet the team behind VinzaTools and our mission to simplify file tasks.';
    } else if (page === 'themes') {
      title = 'Themes | VinzaTools';
      description = 'Browse downloadable Shopify themes and preview theme files before using them on your store.';
    } else if (page === 'about') {
      title = 'About VinzaTools';
      description = 'Learn why VinzaTools exists and how we build friendly, fast tools for everyone.';
    } else if (page === 'blog') {
      title = 'Blog | VinzaTools';
      description = 'Tips, guides, and product updates from the VinzaTools team.';
    } else if (page === 'contact') {
      title = 'Contact VinzaTools';
      description = 'Reach out for support, request new tools, or share feedback with VinzaTools.';
    } else if (page === 'policy') {
      title = 'Privacy Policy | VinzaTools';
      description = 'Read how VinzaTools handles privacy, contact data, logs, and file processing.';
      keywords = `${baseKeywords}, privacy policy, data handling, platform privacy`;
    } else if (page === 'terms') {
      title = 'Terms & Conditions | VinzaTools';
      description = 'Review the VinzaTools terms for uploads, downloads, themes, and platform usage.';
      keywords = `${baseKeywords}, terms and conditions, usage policy, file tools terms`;
    } else if (page === 'cookies') {
      title = 'Cookie Policy | VinzaTools';
      description = 'Learn how VinzaTools uses cookies and local browser storage for performance and interface preferences.';
      keywords = `${baseKeywords}, cookie policy, browser storage, website cookies`;
    } else if (page === 'admin') {
      robots = 'noindex,nofollow';
    }

    document.title = title;

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    const setOg = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('author', 'VinzaTools');
    const routePath = page === 'home' ? '' : `/${page}`;
    const canonicalUrl = `https://vinzatools.com${routePath}`;
    setMeta('robots', robots);
    setMeta('viewport', 'width=device-width, initial-scale=1');
    setMeta('theme-color', '#0f0a0a');
    setOg('og:title', title);
    setOg('og:description', description);
    setOg('og:type', 'website');
    setOg('og:url', canonicalUrl);
    setOg('og:image', 'https://vinzatools.com/assets/images/toolora-logo.webp');
    setOg('og:site_name', 'VinzaTools');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [page, activeToolId, activeToolName]);

  if (page === 'admin') {
    return (
      <Suspense fallback={<PageFallback label="Loading admin dashboard..." />}>
        <AdminPage />
      </Suspense>
    );
  }

  return (
    <SiteLayout
      page={page}
      setPage={setPageWithRoute}
      pageLabels={PAGE_LABELS}
      allTools={allTools}
      onToolSelect={handleToolClick}
      onCatalogNeeded={ensureCatalogLoaded}
    >
      <Suspense fallback={<PageFallback label="Loading VinzaTools..." />}>
        {page === 'home' && (
          <HomePage
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            filteredTools={filteredTools}
            featuredTools={featuredTools}
            handleToolClick={handleToolClick}
            openSubTool={openSubTool}
            goTools={goTools}
            onSecondaryVisible={ensureCatalogLoaded}
          />
        )}
        {page === 'tools' &&
          (showToolsFallback ? (
            <PageFallback label="Loading full tool library..." />
          ) : (
            <ToolsPage
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              filteredTools={filteredTools}
              handleToolClick={handleToolClick}
              activeToolId={activeToolId}
              setActiveToolId={setActiveToolId}
              renderTool={renderTool}
              activeToolName={activeToolName}
            />
          ))}
        {page === 'themes' && <ThemesPage />}
        {page === 'team' && <TeamPage imageSrc={rizwanImage} />}
        {page === 'blog' && <BlogPage />}
        {page === 'about' && <AboutPage />}
        {page === 'contact' && <ContactPage contactTab={contactTab} setContactTab={setContactTab} />}
        {page === 'policy' && <PolicyPage />}
        {page === 'terms' && <TermsPage />}
        {page === 'cookies' && <CookiePolicyPage />}
      </Suspense>
    </SiteLayout>
  );
}



