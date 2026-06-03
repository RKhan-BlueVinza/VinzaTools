import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PageKey, Tool } from '../types/app';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Mail,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { trackGaEvent } from '../lib/analytics';

type PageLabel = { key: PageKey; label: string };

type MegaMenuColumn = {
  title: string;
  items: Tool[];
};

type MegaMenu = {
  id: string;
  label: string;
  hint: string;
  columns: MegaMenuColumn[];
};

interface SiteLayoutProps {
  page: PageKey;
  setPage: (page: PageKey) => void;
  pageLabels: PageLabel[];
  allTools: Tool[];
  onToolSelect: (tool: Tool) => void;
  onCatalogNeeded?: () => void;
  children: React.ReactNode;
}

export const SiteLayout = ({
  page,
  setPage,
  pageLabels,
  allTools,
  onToolSelect,
  onCatalogNeeded,
  children,
}: SiteLayoutProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openFooterSection, setOpenFooterSection] = useState<string | null>('tools');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuShellRef = useRef<HTMLDivElement | null>(null);

  const toolMap = useMemo(
    () => new Map(allTools.map((tool) => [tool.id, tool])),
    [allTools]
  );

  const pickTools = (...ids: string[]) =>
    ids
      .map((id) => toolMap.get(id))
      .filter((tool): tool is Tool => Boolean(tool));

  const megaMenus = useMemo<MegaMenu[]>(
    () => [
      {
        id: 'convert',
        label: 'Convert',
        hint: 'PDF, image, and media converters',
        columns: [
          {
            title: 'PDF & Documents',
            items: pickTools(
              'pdf-to-word',
              'pdf-to-ppt',
              'pdf-to-excel',
              'word-to-pdf',
              'ppt-to-pdf',
              'excel-to-pdf',
              'html-to-pdf',
              'jpg-to-pdf',
              'pdf-to-jpg',
              'extract-pages-from-pdf'
            ),
          },
          {
            title: 'Image & Design',
            items: pickTools(
              'image-converter',
              'resize-image',
              'crop-image',
              'rotate-image',
              'flip-image',
              'image-enlarger',
              'color-picker',
              'image-compressor',
              'bg-remover',
              'qr-code-generator',
              'youtube-thumbnail-downloader',
              'gif-maker'
            ),
          },
          {
            title: 'Video & Audio',
            items: pickTools(
              'video-converter',
              'audio-converter',
              'mp4-to-mp3',
              'video-to-gif',
              'crop-video',
              'trim-video',
              'media-youtube',
              'media-tiktok',
              'media-instagram',
              'media-facebook'
            ),
          },
        ],
      },
      {
        id: 'compress',
        label: 'Compress',
        hint: 'Optimize files without leaving the site',
        columns: [
          {
            title: 'PDF Workflow',
            items: pickTools(
              'pdf-compress',
              'pdf-merge',
              'pdf-split',
              'pdf-rotate',
              'crop-pdf',
              'organize-pdf',
              'flatten-pdf',
              'resize-pdf',
              'pdf-page-remover',
              'page-numbers',
              'compare-pdf',
              'extract-image-from-pdf'
            ),
          },
          {
            title: 'Secure & Edit',
            items: pickTools(
              'edit-pdf',
              'watermark-pdf',
              'sign-pdf',
              'protect-pdf',
              'unlock-pdf',
              'redact-pdf'
            ),
          },
          {
            title: 'Content Cleanup',
            items: pickTools(
              'image-compressor',
              'image-compare',
              'resize-image',
              'crop-image',
              'color-picker',
              'text-counter',
              'case-converter',
              'slug-generator',
              'keyword-density-checker'
            ),
          },
        ],
      },
    ],
    [toolMap]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuShellRef.current) return;
      if (!menuShellRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (openMenu && onCatalogNeeded) {
      onCatalogNeeded();
    }
  }, [openMenu, onCatalogNeeded]);

  const directLinks: PageLabel[] = [
    { key: 'home', label: 'Home' },
    { key: 'tools', label: 'Tools' },
    { key: 'themes', label: 'Themes' },
    { key: 'contact', label: 'Contact' },
  ];
  const primaryLink = directLinks[0];
  const secondaryLinks = directLinks.slice(1);

  const activeMenu = megaMenus.find((menu) => menu.id === openMenu) || null;

  const handleMenuToolClick = (tool: Tool) => {
    setOpenMenu(null);
    onToolSelect(tool);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f0a0a] text-white selection:bg-rose-500/30">
      <div className="fixed inset-0 pointer-events-none z-0 hidden md:block">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0a0a] via-transparent to-[#0f0a0a]" />
      </div>

      <div className="fixed top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none z-0 hidden md:block" />
      <div className="fixed bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[100px] pointer-events-none z-0 hidden md:block" />

      <div
        ref={menuShellRef}
        className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-[#0f0a0a]/92 md:backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              setPage('home');
            }}
            className="vinza-button cursor-pointer rounded-2xl"
          >
            <BrandMark compact subtitle="Fast File Toolkit" />
          </button>

          <div className="hidden xl:flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setPage(primaryLink.key);
              }}
              className={`vinza-button cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                page === primaryLink.key
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {primaryLink.label}
            </button>

            {megaMenus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() =>
                  setOpenMenu((current) =>
                    current === menu.id ? null : menu.id
                  )
                }
                className={`vinza-button cursor-pointer inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  openMenu === menu.id
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {menu.label}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    openMenu === menu.id ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ))}

            {secondaryLinks.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  setPage(item.key);
                }}
                className={`vinza-button cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  page === item.key
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setPage('tools');
              }}
              className="vinza-button cursor-pointer inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-rose-400/25 hover:bg-white/10 hover:shadow-lg hover:shadow-rose-500/10"
            >
              <Sparkles size={15} className="text-rose-300" />
              Browse All Tools
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setPage('contact');
                trackGaEvent('request_tool_click', { location: 'header' });
              }}
              className="vinza-button cursor-pointer rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-500/30"
            >
              Request Tool
            </button>
          </div>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="vinza-button md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {activeMenu && (
          <div className="hidden xl:block border-t border-white/5 bg-[#120d0d]/98">
            <div className="mx-auto max-w-7xl px-4 py-5">
              <div className="max-h-[calc(100vh-150px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#171111] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-rose-400">
                      {activeMenu.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {activeMenu.hint}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setPage('tools');
                    }}
                    className="vinza-button cursor-pointer rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
                  >
                    Open full tools page
                  </button>
                </div>

                <div className="grid max-h-[calc(100vh-240px)] grid-cols-3 gap-5 overflow-y-auto pr-2 app-scrollbar">
                  {activeMenu.columns.map((column) => (
                    <div
                      key={column.title}
                      className="min-w-0 border-r border-white/5 pr-5 last:border-r-0 last:pr-0"
                    >
                      <div className="mb-4 text-sm font-black text-white">
                        {column.title}
                      </div>
                      <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1 app-scrollbar">
                        {column.items.map((tool) => {
                          const Icon = tool.icon;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => handleMenuToolClick(tool)}
                              className="vinza-button cursor-pointer group flex w-full items-start gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-3 py-3 text-left transition-all hover:border-rose-500/20 hover:bg-rose-500/10"
                            >
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white group-hover:text-rose-200">
                                  {tool.name}
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                  {tool.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile quick-tab strip (hidden when hamburger menu is open) */}
        {!mobileMenuOpen && (
          <div className="border-t border-white/5 bg-[#0f0a0a]/85 px-4 py-3 xl:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto app-scrollbar">
              {[primaryLink, ...secondaryLinks].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPage(item.key)}
                  className={`vinza-button cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    page === item.key
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full-screen mobile slide-in menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <nav
            className="absolute left-0 right-0 top-0 bg-[#0f0a0a] px-4 pb-8 pt-20 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              {[primaryLink, ...secondaryLinks].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setPage(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`vinza-button cursor-pointer w-full rounded-2xl px-5 py-4 text-left text-base font-semibold transition-all ${
                    page === item.key
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setPage('tools');
                  setMobileMenuOpen(false);
                }}
                className="vinza-button cursor-pointer flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 py-4 text-base font-semibold text-white transition hover:bg-white/10"
              >
                <Sparkles size={16} className="text-rose-300" />
                Browse All 94+ Tools
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage('contact');
                  setMobileMenuOpen(false);
                  trackGaEvent('request_tool_click', { location: 'mobile_menu' });
                }}
                className="vinza-button cursor-pointer flex items-center justify-center rounded-2xl bg-rose-500 py-4 text-base font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-600"
              >
                Request a Tool
              </button>
            </div>
          </nav>
        </div>
      )}

      <main
        id="main-content"
        className="relative z-10 mx-auto max-w-6xl px-4 pt-36 pb-16 xl:pt-28"
      >
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#0f0a0a]">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <BrandMark />
              </div>
              <p className="max-w-sm text-sm text-slate-400">
                A friendly toolbox for PDFs, media, images, resumes, themes,
                and developer utilities. Designed to feel fast and easy.
              </p>
              <p className="max-w-md text-xs leading-relaxed text-slate-500">
                Popular tools include PDF to Word Converter, PDF to PowerPoint
                Converter, PDF to Excel Converter, Word to PDF Converter, JPG to
                PDF Converter, Image Converter, AI Background Remover, Shopify
                ProExtract Studio, and the theme library.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPage('contact');
                    trackGaEvent('request_tool_click', { location: 'footer' });
                  }}
                  className="vinza-button cursor-pointer flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-500/20"
                >
                  Request Tool
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage('tools')}
                  className="vinza-button cursor-pointer rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 font-semibold text-white transition-colors hover:border-rose-400/25 hover:bg-white/10 hover:text-rose-100"
                >
                  Browse
                </button>
              </div>
            </div>

            {[
              {
                id: 'tools',
                title: 'Tools',
                items: [
                  { label: 'All Tools', page: 'tools' as PageKey },
                  { label: 'Theme Library', page: 'themes' as PageKey },
                  { label: 'PDF Tools', page: 'tools' as PageKey },
                  { label: 'Media Tools', page: 'tools' as PageKey },
                  { label: 'Shopify ProExtract Studio', page: 'tools' as PageKey },
                ],
              },
              {
                id: 'company',
                title: 'Company',
                items: [
                  { label: 'About', page: 'about' as PageKey },
                  { label: 'Team', page: 'team' as PageKey },
                  { label: 'Blog', page: 'blog' as PageKey },
                  { label: 'Contact', page: 'contact' as PageKey },
                  { label: 'Privacy Policy', page: 'policy' as PageKey },
                  { label: 'Terms & Conditions', page: 'terms' as PageKey },
                  { label: 'Cookie Policy', page: 'cookies' as PageKey },
                ],
              },
            ].map((section) => {
              const isOpen = openFooterSection === section.id;
              return (
                <div key={section.id} className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFooterSection((current) =>
                        current === section.id ? null : section.id
                      )
                    }
                    className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left md:cursor-default md:border-0 md:bg-transparent md:px-0 md:py-0"
                  >
                    <span className="text-sm font-bold text-white">{section.title}</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform md:hidden ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div className={`${isOpen ? 'flex' : 'hidden'} flex-col gap-3 md:flex`}>
                    {section.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setPage(item.page)}
                        className="vinza-button cursor-pointer block text-left text-sm text-slate-400 transition-colors hover:text-rose-400"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-slate-500 md:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span>© 2026 VinzaTools.</span>
              <span className="flex items-center gap-1 text-rose-400">
                <Heart size={12} className="fill-rose-400" />
                Made with care
              </span>
              <span className="text-slate-600">|</span>
              <span>Powered by</span>
              <a
                href="https://bluevinza.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-rose-400 transition-colors hover:text-rose-300"
              >
                BlueVinza
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="mailto:info@bluevinza.com"
                className="flex items-center gap-1.5 transition-colors hover:text-rose-400"
              >
                <Mail size={12} />
                info@bluevinza.com
              </a>
              <div className="flex items-center gap-3">
                {[
                  {
                    label: 'Twitter / X',
                    href: 'https://x.com/vinzatools',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'YouTube',
                    href: 'https://youtube.com/@vinzatools',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Instagram',
                    href: 'https://instagram.com/vinzatools',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Facebook',
                    href: 'https://facebook.com/vinzatools',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    ),
                  },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

