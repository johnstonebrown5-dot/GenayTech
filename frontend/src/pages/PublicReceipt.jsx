import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

function amountToWordsKES(num){
  try{
    const n = Math.floor(Number(num)||0)
    if(n===0) return 'Zero Kenya Shillings Only'
    const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    const s=['','Thousand','Million','Billion']
    const chunkToWords=(x)=>{
      let str=''
      const h=Math.floor(x/100), r=x%100
      if(h) str+=a[h]+' Hundred'
      if(r){ str+=(str?' ':'')+(r<20? a[r] : (b[Math.floor(r/10)] + (r%10? ' '+a[r%10] : '')))}
      return str
    }
    const parts=[]
    let i=0, m=n
    while(m>0 && i<s.length){ const chunk=m%1000; if(chunk){ parts.unshift(chunkToWords(chunk) + (s[i]? ' '+s[i] : '')) } m=Math.floor(m/1000); i++ }
    return parts.join(' ') + ' Kenya Shillings Only'
  }catch{ return '' }
}

export default function PublicReceipt(){
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paperSize, setPaperSize] = useState('A5')
  const compactMode = true

  useEffect(()=>{
    let active = true
    ;(async()=>{
      setLoading(true)
      setError('')
      try{
        const { data } = await api.get(`/finance/payments/${encodeURIComponent(id)}/receipt/`)
        if(active) setData(data)
      }catch(e){
        try{
          const { data } = await api.get(`/finance/payments/${encodeURIComponent(id)}/`)
          if(active) setData({
            fallback:true,
            id:data.id,
            date:data.created_at,
            method:data.method,
            reference:data.reference,
            amount:data.amount,
            invoice:data.invoice,
          })
        }catch(err){
          if(active) setError(e?.response?.data?.detail || e?.message || 'Failed to load receipt')
        }
      }finally{
        if(active) setLoading(false)
      }
    })()
    return ()=>{ active=false }
  },[id])

  const html = useMemo(()=>{
    if(!data) return ''
    const page = paperSize==='A5' ? 'A5' : (paperSize==='80mm' ? '80mm' : 'A4')
    const widthMm = page==='A4'? 210 : page==='A5'? 148 : 80
    const side = page==='80mm'? 4 : (page==='A5'? 6 : 12)
    const top = page==='80mm'? 4 : (page==='A5'? 6 : 6)
    const bottom = page==='80mm'? 6 : (page==='A5'? 6 : 10)
    const contentWidth = Math.max(40, widthMm - side*2)
    const baseFont = page==='A5'? 14 : 12
    const accent = (data.school?.accent_color || data.school?.brand_color || data.school?.primary_color || '#2563eb')
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/receipt/${encodeURIComponent(data.receipt_no || data.id)}`)}`
    const list = Array.isArray(data.fee_assignments) ? data.fee_assignments : []
    const map = new Map()
    for(const it of list){ const k = `${it.category||'Fee'}|${it.year||''}|${it.term||''}`; const prev = map.get(k)||{...it,amount:0}; prev.amount=Number(prev.amount||0)+Number(it.amount||0); prev.category=it.category; prev.year=it.year; prev.term=it.term; map.set(k,prev)}
    const rows = Array.from(map.values())
    const words = amountToWordsKES(data.amount)
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Receipt ${data.receipt_no || data.id}</title><style>@page { size: ${page==='80mm' ? '80mm auto' : page+' portrait'}; margin: ${top}mm ${side}mm ${bottom}mm ${side}mm; } html, body { margin:0; padding:0; } :root { --accent:${accent}; --muted:#6b7280; --line:#e5e7eb; } body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .wrap { width: ${contentWidth}mm; margin: 0 auto; font-size: ${baseFont}px; line-height: 1.45; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; } .hdr { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--line); padding:16px 0 12px; } .sch { font-weight:800; font-size: ${page==='A5'? 22 : 18}px; color: var(--accent); letter-spacing:.2px; } .addr { font-size:10px; color: var(--muted); } .motto { font-size:10px; color:#475569; font-style: italic; } .logo { width: 16mm; height: 16mm; object-fit: contain; margin-right: 6px; } .meta { text-align:right; font-size:11px; color:#334155; } .badge { display:inline-block; padding:2px 6px; border:1px solid var(--accent); color:var(--accent); border-radius:999px; font-size:10px; font-weight:600; letter-spacing:.03em; } .grid { display:grid; grid-template-columns: 1fr 1fr; gap: ${page==='A5'? 22 : 16}px; padding: ${page==='A5'? 16 : 12}px 0; } .sec-h { font-size: 10px; letter-spacing: .08em; color:var(--muted); text-transform:uppercase; margin-bottom:4px; } table { width:100%; border-collapse:collapse; table-layout: fixed; } thead th { background: #e9efff; color:#0f172a; font-size: 11px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); letter-spacing:.02em; } th, td { padding: ${page==='A5'? 13 : 10}px ${page==='A5'? 16 : 12}px; border-top:1px solid var(--line); word-wrap:break-word; } tbody tr:nth-child(even) { background:#fafafa; } tbody tr:last-child td { border-top:2px solid #9ca3af; font-weight:700; } tfoot td { border-top:1px solid var(--line); } .total-amt { color: var(--accent); font-size: 13px; font-weight:800; } .row-total td { background: rgba(37,99,235,.06); border-top:2px solid var(--accent); } .row-term td { background: #f8fafc; } .row-arrears td { background: #fff7ed; } .pill { display:inline-block; padding:4px 8px; border:1px solid var(--line); border-radius:999px; font-size:10px; margin-right:6px; } .pill-accent { border-color: var(--accent); color: var(--accent); font-weight:700; } .pill-warn { border-color: #f59e0b; color:#b45309; background:#fffbeb; } .sign { display:grid; grid-template-columns: 1fr auto; align-items: start; gap: ${page==='A5'? 24 : 18}px; padding-top: ${page==='A5'? 18 : 16}px; } .line { border-top:1px solid #94a3b8; height:14px; } .name-underline { display:inline-block; font-size: 12px; font-weight:700; padding-bottom: 2px; border-bottom: 1px solid #94a3b8; min-width: 60mm; } .stamp-space { min-height: 38mm; } .foot { display:flex; justify-content:space-between; color:var(--muted); font-size:10px; padding-top:10px; } .qr { text-align:right; } img { max-width:100%; height:auto; } .wm { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; pointer-events:none; opacity:0.05; } .wm img { max-width:60%; max-height:60%; } .compact .wrap { font-size: 11px; } .compact .hdr { padding:8px 0 6px; } .compact .sch { font-size: 16px; } .compact th, .compact td { padding:6px 8px; } .compact .grid { gap: 10px; padding: 8px 0; } @media print { html, body { margin:0 !important; padding:0 !important } }</style></head><body class="${compactMode ? 'compact' : ''}">${data.school?.logo_url ? `<div class=\"wm\"><img src=\"${data.school.logo_url}\" alt=\"\"/></div>` : ''}<div class="wrap"><div class="hdr"><div style="display:flex; align-items:center; gap:8px;">${data.school?.logo_url ? `<img src="${data.school.logo_url}" alt="Logo" class="logo"/>` : ''}<div><div class="sch">${(data.school?.name||'Payment Receipt')}</div><div class="addr">${data.school?.address||''}</div>${(data.school?.motto || data.school?.moto) ? `<div class="motto">${data.school.motto || data.school.moto}</div>` : ''}</div></div><div class="meta"><div>Date: ${String(data.date).slice(0,10)}</div><div><span class="badge">Receipt</span> No: ${data.receipt_no || `PMT-${data.id}`}</div></div></div><div class="grid"><div><div class="sec-h">Payer</div><div><strong>${data.student?.name||'-'}</strong></div><div>Admission: ${data.student?.admission_no||'-'}</div><div>Class: ${data.student?.class||'-'}</div></div><div><div class="sec-h">Payment Details</div><div>Method: ${(data.method||'').toString().toUpperCase()}</div><div>Reference: ${data.reference||'-'}</div><div>Invoice: ${data.invoice||'-'}</div></div></div><table><thead><tr><th align="left">Item</th><th align="right">KES</th></tr></thead><tbody>${rows.length>0 ? rows.map(f=>`<tr><td>${f.category || 'Fee'} ${f.year?`(${f.year} Term ${f.term||''})`:''}</td><td align="right">${Number(f.amount||0).toLocaleString()}</td></tr>`).join('') : ''}${rows.length===0 && data.invoice ? `<tr><td>Invoice #${data.invoice} (Total)</td><td align="right">${Number(data.invoice_amount||0).toLocaleString()}</td></tr>`:''}<tr><td><strong>Paid now</strong></td><td align="right"><strong>${Number(data.amount||0).toLocaleString()}</strong></td></tr></tbody><tfoot><tr class="row-term"><td align="right">This term balance</td><td align="right">${Number(data.current_term_balance||0).toLocaleString()}</td></tr><tr class="row-arrears"><td align="right">Previous terms (arrears)</td><td align="right">${Number(data.arrears_balance||0).toLocaleString()}</td></tr><tr><td align="right">Total balance</td><td align="right">${Number(data.student_balance||0).toLocaleString()}</td></tr></tfoot></table><div class="words"><strong>Amount in words:</strong> ${words}</div><div class="sign"><div><div style="font-size:10px;color:#6b7280">Received by</div><div class="name-underline">${data.recorded_by_name || '-'}</div><div class="stamp-space"></div><div class="line" style="margin-top:8px"></div><div style="font-size:10px;color:#6b7280">Signature</div></div><div class="qr" style="text-align:right"><img src="${qrUrl}" alt="QR" /><div style="font-size:9px;color:#6b7280">Scan to verify</div></div></div><div class="foot"><div>Thank you for your payment.</div><div></div></div></div><script>window.addEventListener('load',()=>{ setTimeout(()=>{ try{ window.print() }catch(e){} }, 150) })</script></body></html>`
  }, [data, paperSize])

  if (loading) return <div className="p-6 text-center">Loading receipt...</div>
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>
  if (!data) return <div className="p-6 text-center">Receipt not found.</div>

  return (
    <div className="p-0">
      <div className="flex items-center justify-between p-3 border-b bg-white sticky top-0 z-10">
        <div className="font-semibold">Receipt #{data.receipt_no || data.id}</div>
        <div className="flex items-center gap-2">
          <select value={paperSize} onChange={e=>setPaperSize(e.target.value)} className="border px-2 py-1 rounded text-sm">
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="80mm">80mm</option>
          </select>
          <button onClick={()=>{ const w=window.open('', '_blank'); if(w){ w.document.open(); w.document.write(html); w.document.close() } }} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Open Print</button>
        </div>
      </div>
      <div className="p-2">
        <iframe title="receipt" style={{width:'100%', height:'86vh', border:'1px solid #e5e7eb', borderRadius:8}} srcDoc={html} />
      </div>
    </div>
  )
}
