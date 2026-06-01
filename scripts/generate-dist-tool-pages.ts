import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERNAL_TOOLS } from '../src/data/toolCatalog';

const SITE = 'https://www.vinzatools.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('dist/index.html not found. Run build first.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// Normalize multi-line <meta .../> or <meta ...> tags to single-line so regex removal works cleanly.
const normalizeMetas = (html: string) =>
  html.replace(/<meta\b[\s\S]*?(?:\/?>)/gi, (m) => m.replace(/\s+/g, ' '));

// Remove a meta tag by name or property attribute (single-line after normalization).
const removeMetaByName = (html: string, name: string) =>
  html.replace(new RegExp(`<meta [^>]*name=["']${name}["'][^>]*>\\s*`, 'gi'), '');
const removeMetaByProp = (html: string, prop: string) =>
  html.replace(new RegExp(`<meta [^>]*property=["']${prop}["'][^>]*>\\s*`, 'gi'), '');
const removeLink = (html: string, rel: string) =>
  html.replace(new RegExp(`<link [^>]*rel=["']${rel}["'][^>]*>\\s*`, 'gi'), '');

// Rich descriptions for high-traffic tools (keep under 155 chars).
const RICH_DESCRIPTIONS: Record<string, string> = {
  'bg-remover': 'Remove image backgrounds instantly with AI. Upload any photo and get a clean transparent PNG in seconds. Free, no signup required.',
  'pdf-to-word': 'Convert PDF to editable Word document online. Upload your PDF and download a clean DOCX file instantly. Free PDF to Word, no signup.',
  'media-youtube': 'Download YouTube videos and audio free. Save as MP4 or extract MP3 — no watermark, no signup required on VinzaTools.',
  'media-tiktok': 'Download TikTok videos without watermark for free. Save reels and clips instantly — no login, clean HD download on VinzaTools.',
  'media-instagram': 'Download Instagram reels, videos, and photos free. Save content without an account — fast, clean download on VinzaTools.',
  'media-facebook': 'Download Facebook videos online free. Save public video content fast and clean — no watermark, no signup on VinzaTools.',
  'pdf-merge': 'Merge multiple PDF files into one document online. Combine PDFs in any order and download instantly — free, no signup needed.',
  'pdf-compress': 'Compress PDF file size online while keeping quality. Reduce large PDFs for email or sharing — free PDF compressor, instant download.',
  'image-compressor': 'Compress images online without losing quality. Reduce JPG, PNG, and WEBP sizes for faster websites — free, no signup, instant download.',
  'qr-code-generator': 'Create custom QR codes for URLs, contacts, and campaigns online. Branded QR codes with logo support — free, instant PNG download.',
  'resume-builder': 'Build a professional ATS-ready resume with modern templates. Download as PDF or Word — free resume builder online, no signup.',
  'word-to-pdf': 'Convert Word document to PDF online for free. Upload DOCX and download a clean PDF instantly — no software, no signup on VinzaTools.',
  'jpg-to-pdf': 'Convert JPG images to PDF online for free. Combine multiple JPGs into one PDF document — fast, no signup, instant download.',
  'image-converter': 'Convert images between JPG, PNG, WEBP, and JPEG formats online. Free batch image converter — instant download, no signup needed.',
  'webp-to-png': 'Convert WEBP to PNG online for free. Upload WEBP and download a lossless PNG instantly — no signup needed on VinzaTools.',
  'heic-to-jpg': 'Convert iPhone HEIC photos to JPG online for free. Fast HEIC to JPG converter — no software needed, download instantly.',
  'heic-to-png': 'Convert iPhone HEIC photos to PNG online for free. Fast HEIC to PNG converter — no software needed, instant download.',
  'webp-to-jpg': 'Convert WEBP images to JPG online for free. Upload WEBP and download a clean JPG file instantly — no signup on VinzaTools.',
  'pdf-split': 'Split PDF into multiple files online for free. Extract specific pages or ranges — fast PDF splitter, no signup on VinzaTools.',
  'pdf-to-jpg': 'Convert PDF pages to JPG images online for free. Export each page as a high-quality JPG — no signup, instant download.',
  'poster-maker': 'Create posters, flyers, and banners online for free. Design with clean layouts and download as PNG or PDF — no signup required.',
  'password-generator': 'Generate strong, secure passwords online. Customize length and character rules — free password generator, instant copy on VinzaTools.',
  'color-palette-generator': 'Generate professional color palettes for branding and design. Create brand color schemes and export HEX codes — free online tool.',
  'text-counter': 'Count words, characters, and sentences instantly online. Free word counter — paste any text and get results immediately on VinzaTools.',
  'pdf-to-excel': 'Convert PDF to Excel spreadsheet online for free. Extract tables and data from PDFs into XLSX — no signup, instant download.',
  'pdf-to-ppt': 'Convert PDF to PowerPoint slides online for free. Turn PDF pages into editable PPT — fast, no signup, instant download on VinzaTools.',
  'jfif-to-png': 'Convert JFIF images to PNG format online for free. Upload JFIF and download a clean PNG instantly — no signup on VinzaTools.',
  'mp4-to-mp3': 'Extract MP3 audio from MP4 video online for free. Convert MP4 to MP3 instantly — no signup, fast download on VinzaTools.',
  'video-to-gif': 'Convert video clips to animated GIF online for free. Turn MP4, WEBM, or MOV into GIF — fast, no signup on VinzaTools.',
  'shopify-helper': 'Extract product details and export Shopify-ready product sheets with a professional workflow. Free Shopify product tool on VinzaTools.',
  'video-converter': 'Convert video to MP4, MOV, WEBM, or GIF online for free. Fast video format converter — no signup, instant download on VinzaTools.',
  'audio-converter': 'Convert audio files to MP3, WAV, OGG, or AAC online for free. Fast audio format converter — no signup, instant download on VinzaTools.',
  'mp4-converter': 'Convert video files to MP4 online for free. Fast MP4 converter — no signup, supports MOV, AVI, WEBM, and more on VinzaTools.',
  'mov-to-mp4': 'Convert MOV to MP4 online for free. Fast MOV to MP4 converter — no software needed, instant download on VinzaTools.',
  'gif-maker': 'Create animated GIFs from images online for free. Upload photos and build a GIF instantly — no signup, fast export on VinzaTools.',
  'crop-image': 'Crop images online for free. Upload any photo and crop to the exact area you need — instant download, no signup on VinzaTools.',
  'resize-image': 'Resize images online for free. Set custom width and height and download instantly — no signup needed on VinzaTools.',
  'rotate-image': 'Rotate images online for free. Rotate any photo left or right and download instantly — no signup needed on VinzaTools.',
  'flip-image': 'Flip images online for free. Mirror photos horizontally or vertically — instant download, no signup on VinzaTools.',
  'image-enlarger': 'Enlarge images online for free. Upscale photos for print or preview — no signup, instant download on VinzaTools.',
  'color-picker': 'Pick colors from any image online for free. Upload a photo and sample exact HEX colors — no signup needed on VinzaTools.',
  'edit-pdf': 'Edit PDF online for free. Add text edits to your PDF and download instantly — no software, no signup on VinzaTools.',
  'watermark-pdf': 'Add watermark to PDF online for free. Apply text or image watermarks across all pages — no signup, instant download on VinzaTools.',
  'sign-pdf': 'Sign PDF online for free. Upload and place your signature on any PDF — no software, no signup on VinzaTools.',
  'protect-pdf': 'Protect PDF with password online for free. Add password protection to any PDF — no signup, instant download on VinzaTools.',
  'unlock-pdf': 'Remove PDF password online for free. Unlock protected PDFs and download instantly — no signup needed on VinzaTools.',
  'ocr-pdf': 'Extract text from scanned PDF online for free. OCR tool to get editable text from PDF images — no signup on VinzaTools.',
  'ppt-to-pdf': 'Convert PowerPoint to PDF online for free. Upload PPT or PPTX and download a clean PDF — no signup, instant download.',
  'excel-to-pdf': 'Convert Excel to PDF online for free. Upload XLS or XLSX and download a clean PDF instantly — no signup on VinzaTools.',
  'html-to-pdf': 'Convert HTML to PDF online for free. Paste HTML and download as a formatted PDF — no signup on VinzaTools.',
  'pdf-page-remover': 'Remove pages from PDF online for free. Delete unwanted pages and download a clean PDF — no signup on VinzaTools.',
  'extract-pages-from-pdf': 'Extract pages from PDF online for free. Select specific pages and save them as a new PDF — no signup on VinzaTools.',
  'organize-pdf': 'Reorder PDF pages online for free. Arrange pages in any custom order and download — no signup on VinzaTools.',
  'compare-pdf': 'Compare two PDF files online for free. View differences side by side — no signup, fast PDF comparison on VinzaTools.',
  'redact-pdf': 'Redact PDF online for free. Remove or black out sensitive text from PDFs — no signup, instant download on VinzaTools.',
  'translate-pdf': 'Translate PDF online for free. Convert PDF text to another language — no signup, instant result on VinzaTools.',
  'case-converter': 'Convert text to uppercase, lowercase, or title case online for free. Instant case conversion — no signup on VinzaTools.',
  'slug-generator': 'Generate SEO-friendly URL slugs online for free. Create clean slugs for pages, posts, and products — no signup on VinzaTools.',
  'keyword-density-checker': 'Check keyword density in your content for free. Analyze keyword frequency and SEO focus — no signup on VinzaTools.',
  'url-encoder': 'Encode or decode URLs online for free. Convert special characters for APIs and links — no signup on VinzaTools.',
  'mp4-to-gif': 'Convert MP4 to GIF online for free. Turn MP4 video clips into animated GIFs — no signup, instant download on VinzaTools.',
  'video-to-gif': 'Convert video to GIF online for free. Turn any video clip into an animated GIF — no signup, instant download on VinzaTools.',
  'crop-video': 'Crop video online for free. Trim the frame area of your video and export a clean file — no signup on VinzaTools.',
  'trim-video': 'Trim video online for free. Cut the start and end of a video clip — no signup, instant download on VinzaTools.',
  'mp4-to-mp3': 'Convert MP4 to MP3 online for free. Extract audio from video files instantly — no signup, fast download on VinzaTools.',
};

// Category-level base keywords appended to every tool page.
const CATEGORY_BASE_KEYWORDS: Record<string, string> = {
  pdf: 'pdf tools, free pdf converter online, pdf editor, merge pdf, split pdf',
  image: 'image tools, image converter, free image editor, photo tools online',
  media: 'video downloader, media downloader, free video download, online downloader',
  creative: 'creative tools, design tools, free online design maker, graphic tool',
  text: 'text tools, writing tools, seo tools, free text utilities',
  developer: 'developer tools, dev utilities, free coding tools, web developer tools',
};

const buildKeywords = (toolId: string, toolName: string, category: string): string => {
  const catKeywords = CATEGORY_BASE_KEYWORDS[category] || 'online tools, free tools';
  return `${toolName.toLowerCase()}, ${catKeywords}, VinzaTools, vinzatools.com`;
};

const buildLdJson = (toolName: string, metaDesc: string, canonical: string): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: toolName,
    description: metaDesc,
    applicationCategory: 'WebApplication',
    operatingSystem: 'All',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'VinzaTools', url: SITE },
  });

// Short how-to blurb for noscript content per category.
const HOW_TO_USE: Record<string, string> = {
  pdf: 'Upload your PDF file, configure options if needed, then click Process. Results download instantly — no upload to external servers.',
  image: 'Upload your image, set options, then click Process. Preview the result and download the converted file instantly.',
  media: 'Paste the video URL, click Download, and save the file to your device. No account needed.',
  creative: 'Fill in your content or upload assets, then export your design as PNG or PDF in one click.',
  text: 'Paste or type your text and see results instantly. Copy or download your processed text right away.',
  developer: 'Paste your input data, configure options, then click Process. Results appear instantly and can be copied or downloaded.',
};

const buildToolPage = (toolId: string, toolName: string, description: string, category: string): string => {
  const title = `${toolName} | VinzaTools`;
  const canonical = `${SITE}/tools/${encodeURIComponent(toolId)}`;
  const rawDesc = RICH_DESCRIPTIONS[toolId] ||
    `Free online ${toolName.toLowerCase()} on VinzaTools. ${description.trimEnd().replace(/\.$/, '')} — no signup required, instant download.`;
  // Hard limit at 155 chars (Google truncates after this).
  const metaDesc = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc;

  let html = baseHtml;

  // Normalize multi-line meta tags before regex removal.
  html = normalizeMetas(html);

  // Strip all meta/link tags we will re-inject with tool-specific values.
  html = removeMetaByName(html, 'description');
  html = removeMetaByName(html, 'keywords');
  html = removeMetaByName(html, 'robots');
  html = removeMetaByName(html, 'twitter:card');
  html = removeMetaByName(html, 'twitter:title');
  html = removeMetaByName(html, 'twitter:description');
  html = removeMetaByName(html, 'twitter:image');
  html = removeMetaByProp(html, 'og:title');
  html = removeMetaByProp(html, 'og:description');
  html = removeMetaByProp(html, 'og:url');
  html = removeMetaByProp(html, 'og:image');
  html = removeMetaByProp(html, 'og:site_name');
  html = removeLink(html, 'canonical');

  // Replace LD+JSON with SoftwareApplication schema.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${buildLdJson(toolName, metaDesc, canonical)}</script>`
  );

  // Replace title.
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

  const ogImg = `${SITE}/assets/images/toolora-logo.png`;
  const keywords = buildKeywords(toolId, toolName, category);

  const headBlock = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="description" content="${escapeHtml(metaDesc)}">`,
    `<meta name="keywords" content="${escapeHtml(keywords)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(metaDesc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${ogImg}">`,
    `<meta property="og:site_name" content="VinzaTools">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metaDesc)}">`,
    `<meta name="twitter:image" content="${ogImg}">`,
  ].join('\n');
  html = html.replace('</head>', `${headBlock}\n</head>`);

  // Rich noscript block — gives crawlers real readable content.
  const howToUse = HOW_TO_USE[category] || 'Open the tool, upload your file or enter your input, then click Process to get your result instantly.';
  const noscript = [
    `<noscript>`,
    `<main style="max-width:760px;margin:40px auto;font-family:Arial,sans-serif;line-height:1.7;padding:0 16px;">`,
    `<nav style="font-size:13px;margin-bottom:16px;"><a href="${SITE}" style="color:#e11d48;text-decoration:none;">VinzaTools</a> &rsaquo; <a href="${SITE}/tools" style="color:#e11d48;text-decoration:none;">Tools</a> &rsaquo; ${escapeHtml(toolName)}</nav>`,
    `<h1 style="margin-bottom:8px;">${escapeHtml(toolName)}</h1>`,
    `<p style="color:#444;margin-bottom:16px;">${escapeHtml(metaDesc)}</p>`,
    `<h2 style="font-size:1rem;margin-bottom:6px;">How to use</h2>`,
    `<p style="color:#444;margin-bottom:16px;">${escapeHtml(howToUse)}</p>`,
    `<p><strong>Open tool:</strong> <a href="${canonical}" style="color:#e11d48;">${canonical}</a></p>`,
    `<p><a href="${SITE}/tools" style="color:#e11d48;">Browse all VinzaTools &rarr;</a></p>`,
    `</main>`,
    `</noscript>`,
  ].join('\n');
  html = html.replace('<body>', `<body>\n${noscript}\n`);

  return html;
};

const toolsRoot = path.join(distDir, 'tools');
fs.mkdirSync(toolsRoot, { recursive: true });

for (const tool of INTERNAL_TOOLS) {
  const outDir = path.join(toolsRoot, tool.id);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, buildToolPage(tool.id, tool.name, tool.description, tool.category), 'utf8');
}

console.log(`Generated ${INTERNAL_TOOLS.length} tool landing pages into dist/tools/<id>/index.html`);
