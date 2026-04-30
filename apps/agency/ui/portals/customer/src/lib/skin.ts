export type Skin = 'warm' | 'editorial' | 'product';

export const SKIN_STORAGE_KEY = 'site-skin';
export const DEFAULT_SKIN: Skin = 'warm';
export const SKINS: readonly Skin[] = ['warm', 'editorial', 'product'] as const;

/**
 * Runs before first paint. Resolves the active skin from URL query param
 * (`?skin=...`), localStorage, or the default, and sets it on `<html>` so
 * the skin tokens are in place before styles resolve. Pure browser code.
 */
export const SKIN_NO_FLASH_SCRIPT = `(function(){try{var u=new URL(window.location.href);var p=u.searchParams.get('skin');var v=p&&(p==='warm'||p==='editorial'||p==='product')?p:null;if(!v){var s=localStorage.getItem('site-skin');if(s==='warm'||s==='editorial'||s==='product')v=s;}if(!v)v='warm';if(p)localStorage.setItem('site-skin',p);document.documentElement.setAttribute('data-skin',v);}catch(_){document.documentElement.setAttribute('data-skin','warm');}})();`;
