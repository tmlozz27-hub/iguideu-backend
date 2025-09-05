function has(obj, key){ return Object.prototype.hasOwnProperty.call(obj, key); }
function isEmail(s){ return typeof s==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function bad(res, msg){ return res.status(400).json({ error: msg }); }

export function validateSignup(req,res,next){
  const b = req.body || {};
  if(!isEmail(b.email)) return bad(res, 'email inválido');
  if(typeof b.password!=='string' || b.password.length<6) return bad(res, 'password inválido');
  if(typeof b.name!=='string' || b.name.length<2) return bad(res, 'name inválido');
  next();
}

export function validateLogin(req,res,next){
  const b = req.body || {};
  if(!isEmail(b.email)) return bad(res, 'email inválido');
  if(typeof b.password!=='string' || !b.password) return bad(res, 'password requerido');
  next();
}

export function validateBookingCreate(req,res,next){
  const b = req.body || {};
  if(typeof b.guide!=='string' || !b.guide) return bad(res, 'guide requerido');
  if(!has(b,'startAt') || !has(b,'endAt')) return bad(res, 'startAt/endAt requeridos');
  const s = new Date(b.startAt), e = new Date(b.endAt);
  if(isNaN(+s) || isNaN(+e)) return bad(res, 'fechas inválidas');
  if(e <= s) return bad(res, 'endAt debe ser > startAt');
  if(typeof b.price!=='number' || !(b.price>0)) return bad(res, 'price inválido');
  next();
}
