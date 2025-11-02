let container = null;
function ensureContainer(){
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.right = '16px';
  container.style.zIndex = '9999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';
  document.body.appendChild(container);
  return container;
}
export function toast(message, type='info', duration=3000){
  try{
    const el = document.createElement('div');
    el.textContent = message;
    el.style.padding = '10px 14px';
    el.style.borderRadius = '8px';
    el.style.color = type === 'error' ? '#7f1d1d' : '#065f46';
    el.style.background = type === 'error' ? '#fee2e2' : '#d1fae5';
    el.style.border = '1px solid ' + (type === 'error' ? '#fecaca' : '#a7f3d0');
    el.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)';
    ensureContainer().appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, duration);
  }catch{}
}
