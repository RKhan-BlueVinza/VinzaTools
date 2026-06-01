import React, { useState } from 'react';
import { Eraser, Upload, Download, CheckCircle2, RefreshCw, Scissors, Image as ImageIcon, Sparkles, Wand2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { removeBackground as removeBackgroundLocal } from '@imgly/background-removal';
import { apiFetch } from '../api';

export const BackgroundRemover = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'white'>('auto');
  const [threshold, setThreshold] = useState(238);
  const [tolerance, setTolerance] = useState(24);
  const [view, setView] = useState<'removed' | 'original'>('removed');
  const [notice, setNotice] = useState<string | null>(null);
  const sampleImages = [
  { label: 'Portrait Sample', url: '/assets/images/rizwan.webp' },
    { label: 'Theme Cover', url: '/assets/theme-covers/vinza-luxury-storefront.webp' },
    { label: 'Studio Card', url: '/assets/placeholders/sample-card.svg' },
    { label: 'Media Preview', url: '/assets/placeholders/media-thumbnail.svg' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setView('removed');
      setNotice(null);
    }
  };

  const loadSampleImage = async (sampleUrl: string, label: string) => {
    try {
      const response = await fetch(sampleUrl);
      const blob = await response.blob();
      const extension = sampleUrl.split('.').pop() || 'png';
      const sampleFile = new File([blob], `${label.toLowerCase().replace(/\s+/g, '-')}.${extension}`, {
        type: blob.type || 'image/png',
      });

      setFile(sampleFile);
      setPreview(URL.createObjectURL(sampleFile));
      setResult(null);
      setView('removed');
      setNotice(`${label} loaded. You can test removal now.`);
    } catch (error) {
      console.error(error);
      setNotice('Sample image could not be loaded right now.');
    }
  };

  const loadImageElement = (input: Blob) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(input);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  };

  const hasTransparency = async (input: Blob) => {
    const img = await loadImageElement(input);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 40) {
      if (data[i] < 250) return true;
    }
    return false;
  };

  const removeWhiteBackground = async (input: Blob) => {
    const img = await loadImageElement(input);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const edge = Math.max(0, threshold - tolerance);
    const soft = Math.max(4, tolerance);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const sat = max - min;

      if (lum >= threshold && sat <= tolerance) {
        data[i + 3] = 0;
      } else if (lum >= edge && sat <= tolerance * 1.5) {
        const alpha = Math.round(255 * (threshold - lum) / soft);
        data[i + 3] = Math.max(0, Math.min(255, alpha));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error('Failed to create output image'));
          return;
        }
        resolve(b);
      }, 'image/png');
    });
    return outBlob;
  };

  const tryLocalRemoval = async (inputFile: File) => {
    try {
      const outputBlob = await removeBackgroundLocal(inputFile, {
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(100, Math.round((current / total) * 100));
            setProgress(`Downloading ${key}... ${pct}%`);
          } else {
            setProgress(`Downloading ${key}...`);
          }
        }
      });
      if (mode === 'auto') {
        const transparent = await hasTransparency(outputBlob);
        if (!transparent) {
          const whiteBlob = await removeWhiteBackground(inputFile);
          setResult(URL.createObjectURL(whiteBlob));
          setNotice('AI kept the background, switched to smart white-background cleanup.');
          return true;
        }
      }
      setResult(URL.createObjectURL(outputBlob));
      setNotice('Background removed successfully with AI.');
      return true;
    } catch (err) {
      console.error('Local background removal failed', err);
      return false;
    } finally {
      setProgress(null);
    }
  };

  const handleRemoveBackground = async () => {
    if (!file) return;
    setProcessing(true);
    setNotice(null);
    try {
      if (mode === 'white') {
        const whiteBlob = await removeWhiteBackground(file);
        setResult(URL.createObjectURL(whiteBlob));
        setNotice('White background cleanup completed.');
        return;
      }

      setProgress('Preparing AI model...');
      const localOk = await tryLocalRemoval(file);
      if (localOk) return;

      const formData = new FormData();
      formData.append('image', file);

      const response = await apiFetch('/api/image/remove-bg', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const transparent = await hasTransparency(blob);
        if (!transparent) {
          const whiteBlob = await removeWhiteBackground(file);
          setResult(URL.createObjectURL(whiteBlob));
          setNotice('Used smart white-background fallback for cleaner result.');
        } else {
          setResult(URL.createObjectURL(blob));
          setNotice('Background removed successfully.');
        }
      } else {
        const whiteBlob = await removeWhiteBackground(file);
        setResult(URL.createObjectURL(whiteBlob));
        setNotice('AI service busy, used built-in white-background cleanup.');
      }
    } catch (err) {
      console.error(err);
      try {
        const whiteBlob = await removeWhiteBackground(file);
        setResult(URL.createObjectURL(whiteBlob));
        setNotice('Used built-in white-background cleanup.');
      } catch {
        setNotice('Background removal failed. Try a cleaner image or white-background mode.');
      }
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0505] overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex-shrink-0 p-8">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full mb-4">
              <Sparkles size={14} className="text-rose-400" />
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">AI Powered</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400 drop-shadow-[0_0_30px_rgba(244,63,94,0.3)]">
              Remove Background
            </h1>
            <p className="text-xl text-rose-200/50 font-medium">100% Automatic & Free</p>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-5xl w-full">
          {!result ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid lg:grid-cols-5 gap-8"
            >
              {/* Upload Area */}
              <div className="lg:col-span-3">
                <div className="relative group">
                  {/* Glow Effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 rounded-[2.5rem] blur-xl opacity-40 group-hover:opacity-60 transition duration-500" />
                  
                  <div className={`relative border-2 border-dashed rounded-[2rem] p-10 text-center transition-all backdrop-blur-sm ${file ? 'border-rose-500/50 bg-rose-500/5' : 'border-rose-500/20 bg-[#141010]/80 hover:border-rose-500/40 hover:bg-[#1a1111]/80'}`}>
                    {!file ? (
                      <label className="cursor-pointer space-y-8 block">
                        <motion.div 
                          whileHover={{ scale: 1.05 }}
                          className="w-24 h-24 bg-gradient-to-br from-rose-600 to-rose-700 text-white rounded-3xl flex items-center justify-center mx-auto shadow-[0_20px_60px_-15px_rgba(244,63,94,0.5)]"
                        >
                          <Upload size={40} />
                        </motion.div>
                        <div className="space-y-2">
                          <p className="text-2xl font-black text-[#f0e6e6]">Drop your image here</p>
                          <p className="text-sm text-rose-300/40">or click to browse • JPG, PNG, WEBP supported</p>
                        </div>
                        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                      </label>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="relative">
                          <div className="absolute -inset-4 bg-gradient-to-r from-rose-600/20 to-pink-600/20 rounded-3xl blur-xl" />
                          <img src={preview!} alt="Uploaded image preview" className="relative max-h-[350px] rounded-2xl mx-auto shadow-2xl shadow-black/50" />
                        </div>
                        <div className="flex justify-center gap-4">
                          <button 
                            onClick={() => setFile(null)} 
                            className="px-6 py-3 bg-[#1f1616] border border-rose-500/20 rounded-xl text-sm font-bold text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all"
                          >
                            Cancel
                          </button>
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleRemoveBackground} 
                            disabled={processing}
                            className="px-8 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl text-sm font-bold hover:from-rose-700 hover:to-rose-800 transition-all shadow-lg shadow-rose-500/30 disabled:opacity-50 flex items-center gap-2"
                          >
                            {processing ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                            {processing ? 'Processing...' : 'Remove Background'}
                          </motion.button>
                        </div>
                        {processing && progress && (
                          <div className="flex items-center justify-center gap-2 text-sm text-rose-300/60">
                            <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                            {progress}
                          </div>
                        )}
                        {notice && (
                          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                            <CheckCircle2 size={14} />
                            {notice}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
                
                <p className="text-center text-xs text-rose-300/30 mt-4">
                  By uploading, you agree to our Terms of Service
                </p>
              </div>

              {/* Settings Panel */}
              <div className="lg:col-span-2 space-y-6">
                {/* Mode Selector */}
                <div className="p-6 rounded-2xl bg-[#141010] border border-rose-500/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={16} className="text-rose-400" />
                    <span className="text-sm font-bold text-rose-300/70 uppercase tracking-wider">Mode</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode('auto')}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'auto' ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-500/30' : 'bg-[#1f1616] text-rose-300/60 border border-rose-500/20 hover:border-rose-500/40'}`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <Sparkles size={16} />
                        Auto AI
                      </div>
                    </button>
                    <button
                      onClick={() => setMode('white')}
                      className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'white' ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-500/30' : 'bg-[#1f1616] text-rose-300/60 border border-rose-500/20 hover:border-rose-500/40'}`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <Eraser size={16} />
                        White BG
                      </div>
                    </button>
                  </div>
                </div>

                {/* Sliders */}
                <div className="p-6 rounded-2xl bg-[#141010] border border-rose-500/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-2 mb-5">
                    <Scissors size={16} className="text-rose-400" />
                    <span className="text-sm font-bold text-rose-300/70 uppercase tracking-wider">Fine Tune</span>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-rose-300/50 font-medium">White Threshold</span>
                        <span className="text-rose-400 font-mono font-bold">{threshold}</span>
                      </div>
                      <input
                        type="range"
                        min="220"
                        max="255"
                        step="1"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full h-2 bg-rose-500/20 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-rose-300/50 font-medium">Edge Tolerance</span>
                        <span className="text-rose-400 font-mono font-bold">{tolerance}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="40"
                        step="1"
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-full h-2 bg-rose-500/20 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-rose-300/30 mt-4">
                    Best for product photos with white backgrounds
                  </p>
                </div>

                {/* Sample Images */}
                <div className="p-6 rounded-2xl bg-[#141010] border border-rose-500/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                  <p className="text-sm font-bold text-rose-300/70 uppercase tracking-wider mb-4">Try Samples</p>
                  <div className="grid grid-cols-4 gap-3">
                    {sampleImages.map((sample, i) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ scale: 1.05 }}
                        onClick={() => loadSampleImage(sample.url, sample.label)}
                        className="aspect-square rounded-xl overflow-hidden border border-rose-500/10 cursor-pointer hover:border-rose-500/40 transition-all shadow-lg relative group"
                      >
                        <img src={sample.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={sample.label} />
                        <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                          {sample.label}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Result Card */}
              <div className="relative">
                {/* Glow */}
                <div className="absolute -inset-2 bg-gradient-to-r from-rose-600/30 via-pink-600/20 to-rose-600/30 rounded-[2.5rem] blur-2xl opacity-50" />
                
                <div className="relative rounded-[2rem] bg-[#141010] border border-rose-500/20 shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Tabs */}
                  <div className="flex border-b border-rose-500/10">
                    <button
                      onClick={() => setView('removed')}
                      className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'removed' ? 'bg-rose-500/10 text-rose-400 border-b-2 border-rose-500' : 'text-rose-300/40 hover:text-rose-300/60 hover:bg-rose-500/5'}`}
                    >
                      <CheckCircle2 size={16} />
                      Result
                    </button>
                    <button
                      onClick={() => setView('original')}
                      className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'original' ? 'bg-rose-500/10 text-rose-400 border-b-2 border-rose-500' : 'text-rose-300/40 hover:text-rose-300/60 hover:bg-rose-500/5'}`}
                    >
                      <ImageIcon size={16} />
                      Original
                    </button>
                  </div>

                  {/* Image Preview */}
                  <div className="p-10 flex items-center justify-center min-h-[450px] relative bg-[#0a0505]">
                    {/* Checkerboard Pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ 
                      backgroundImage: 'linear-gradient(45deg, #f43f5e 25%, transparent 25%), linear-gradient(-45deg, #f43f5e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f43f5e 75%), linear-gradient(-45deg, transparent 75%, #f43f5e 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px 10px, 10px 0'
                    }} />
                    
                    <motion.img 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={view === 'removed' ? result : (preview || result || '')} 
                      className="max-h-[500px] rounded-xl relative z-10 shadow-2xl shadow-black/50" 
                    />
                  </div>

                  {/* Actions */}
                  <div className="p-8 bg-[#0f0a0a] border-t border-rose-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <button 
                      onClick={() => { setFile(null); setResult(null); }} 
                      className="flex items-center gap-2 text-rose-400 font-bold hover:text-rose-300 transition-colors"
                    >
                      <div className="p-2 bg-rose-500/10 rounded-lg">
                        <RefreshCw size={18} />
                      </div>
                      Upload New
                    </button>
                    <motion.a 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={result} 
                      download="no-bg.png" 
                      className="px-10 py-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-2xl font-bold text-lg hover:from-rose-700 hover:to-rose-800 transition-all shadow-xl shadow-rose-500/30 flex items-center gap-3"
                    >
                      <Download size={24} />
                      Download PNG
                    </motion.a>
                  </div>
                </div>
              </div>

              {notice && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-sm font-medium text-emerald-400 flex items-center gap-3"
                >
                  <CheckCircle2 size={18} />
                  {notice}
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(244,63,94,0.2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(244,63,94,0.4); }
      `}</style>
    </div>
  );
};
