export function showLoadingHint(message, percent){
  try{ window.dispatchEvent(new CustomEvent('loading:hint', { detail:{ message, percent } })) }catch{}
}
export function setLoadingProgress(percent){
  try{ window.dispatchEvent(new CustomEvent('loading:progress', { detail:{ percent } })) }catch{}
}
export function clearLoadingHint(){
  try{ window.dispatchEvent(new Event('loading:clear')) }catch{}
}
