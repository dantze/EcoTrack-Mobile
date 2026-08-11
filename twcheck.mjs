import { compile } from 'tailwindcss';
import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const compiler = await compile(css, {
  base: process.cwd(),
  loadStylesheet: async (id, base) => {
    const path = await import('node:module').then(m => m.createRequire(import.meta.url).resolve(id.replace(/^tailwindcss$/, 'tailwindcss/index.css')));
    return { path, base, content: fs.readFileSync(path, 'utf8') };
  },
});

const candidates = [
  'animate-fade-in','animate-scale-in','animate-slide-left','animate-slide-up','animate-toast-in',
  'bg-surface-header','bg-brand-100','text-danger-600','ring-danger-200','bg-success-50','text-info-700',
  'shadow-popover','shadow-modal','shadow-panel','shadow-toast','shadow-card','shadow-xs',
  'z-[60]','z-[70]','z-[80]','tabular','border-separate','border-spacing-0','table-fixed',
  'focus-visible:outline-2','focus-visible:outline-offset-2','focus-visible:outline-brand-500',
  'focus-visible:-outline-offset-2','indeterminate:bg-brand-700','group-hover/row:bg-slate-50',
  'group-hover/th:opacity-100','[&>td:first-child]:shadow-[inset_2px_0_0_0_var(--color-brand-700)]',
  '[&::-webkit-search-cancel-button]:hidden','overscroll-contain','w-[calc(100%+0.5rem)]',
  'text-[0.6875rem]','backdrop-blur-[1px]','decoration-border-strong','max-w-[calc(100vw-3rem)]',
  'w-[30rem]','cursor-[inherit]','rounded-[0.25rem]','max-w-64','ring-inset','flex-row-reverse',
];
const out = compiler.build(candidates);
const missing = candidates.filter(c => {
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !out.includes(c.split(':').pop().slice(0,12)) && !new RegExp(esc.replace(/\\?\//g,'\\\\/')).test(out);
});
console.log('CSS bytes:', out.length);
console.log('keyframes present:', ['ui-fade-in','ui-scale-in','ui-slide-left','ui-slide-up','ui-toast-in'].filter(k=>out.includes(`@keyframes ${k}`)));
console.log('possible missing utilities:', missing);
