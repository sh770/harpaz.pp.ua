document.getElementById('y').textContent=new Date().getFullYear();
// כתובת ה-Worker שלך. להחליף אחרי הפריסה.
const ENDPOINT='https://REPLACE-ME.workers.dev';
const f=document.getElementById('lead'),st=document.getElementById('formStatus');
f.addEventListener('submit',async e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(f));
  if(!d.name.trim()||d.phone.replace(/\D/g,'').length<7){st.className='status err';st.textContent='נא למלא שם ומספר טלפון תקין.';return}
  const b=f.querySelector('button');b.disabled=true;st.className='status';st.textContent='שולח...';
  try{
    const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    if(!r.ok)throw 0;
    f.reset();st.className='status ok';st.textContent='תודה, הפנייה התקבלה. אחזור אליכם בהקדם.';
  }catch{
    st.className='status err';st.textContent='משהו השתבש. אפשר לשלוח לי בוואטסאפ או להתקשר.';
  }
  b.disabled=false;
});