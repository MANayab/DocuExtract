import { OCR_MAX_PAGES } from '../../config/limits';
export async function runOcr(pages:Blob[],onProgress?:(p:number)=>void):Promise<string>{
  if(pages.length>OCR_MAX_PAGES)throw new Error('OCR is limited to 20 pages.');
  onProgress?.(0);
  await import('tesseract.js');
  throw new Error('OCR language data is not bundled in v1.0.0. Configure a local Tesseract language-data bundle before using OCR; the application will not silently download OCR data from a CDN.');
}
