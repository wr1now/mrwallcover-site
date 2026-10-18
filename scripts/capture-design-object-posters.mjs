/** Rebuild original still fallbacks from the same geometry as the live illustrative objects. Run after build. */
import {mkdir,readdir} from 'node:fs/promises';
import sharp from 'sharp';
import {serve,launchBrowser} from './visual-browser.mjs';
import {designObjectKinds} from '../src/lib/design-object-kinds.ts';
const module=(await readdir('dist/_astro')).find(file=>/^design-object-scenes\..*\.js$/.test(file));
if(!module)throw new Error('Build the site before capturing the object posters.');
const server=await serve('dist');const browser=await launchBrowser();
try {
  const page=await browser.newPage();await page.setViewport({width:640,height:640,deviceScaleFactor:1});
  await page.goto(server.origin+'/404.html',{waitUntil:'networkidle0'});
  await page.evaluate(async url=>{
    const {createObjectStudio}=await import(url);
    window.objectStudio=createObjectStudio();window.objectStudio.resize(640);
    document.body.replaceChildren(window.objectStudio.canvas);
    document.documentElement.style.cssText='background:transparent!important;';
    document.body.style.cssText='margin:0;background:transparent!important;';
    window.objectStudio.canvas.style.cssText='width:640px;height:640px;display:block;';
  },server.origin+'/_astro/'+module);
  await mkdir('public/media/design-objects',{recursive:true});
  for(const kind of designObjectKinds) {
    await page.evaluate(kind=>{window.objectStudio.render(kind,0);},kind);
    const png=await page.screenshot({type:'png',omitBackground:true});
    await sharp(png).webp({quality:90}).toFile(`public/media/design-objects/${kind}.webp`);
  }
  await page.evaluate(()=>window.objectStudio.dispose());
  console.log(`Captured ${designObjectKinds.length} original 3D object posters, 640 × 640.`);
}finally{await browser.close();await server.close();}
