/* ============================================================
   Feltöltés előtti automatikus átméretezés — max 1200px a hosszabbik
   oldalon, JPEG, kb. 150-250 kB/kép (spec 2.7 / 5.3).
   ============================================================ */
function loadImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("A kép nem tölthető be.")); };
    img.src=url;
  });
}

export async function resizeImage(file, maxSide=1200, quality=0.82){
  const img = await loadImage(file);
  let w=img.naturalWidth, h=img.naturalHeight;
  if(w>maxSide || h>maxSide){
    if(w>=h){ h=Math.round(h*maxSide/w); w=maxSide; }
    else { w=Math.round(w*maxSide/h); h=maxSide; }
  }
  const canvas=document.createElement("canvas");
  canvas.width=w; canvas.height=h;
  canvas.getContext("2d").drawImage(img,0,0,w,h);
  const blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  if(!blob) throw new Error("A kép feldolgozása sikertelen.");
  return blob;
}
