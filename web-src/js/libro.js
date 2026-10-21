'use strict';
// Libro de Reclamaciones: pide el número correlativo, envía la hoja a Netlify Forms y muestra la constancia.
(() => {
  const form = document.getElementById('lr-form');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const err = $('lr-err');
  const btn = form.querySelector('[type="submit"]');
  const LABELS = [
    ['numero', 'Hoja N.°'], ['fecha', 'Fecha'], ['nombre', 'Nombre'], ['tipo_documento', 'Documento'], ['documento', 'Número de documento'],
    ['domicilio', 'Domicilio'], ['telefono', 'Teléfono'], ['email', 'Correo'], ['apoderado', 'Madre, padre o apoderado'],
    ['bien', 'Bien contratado'], ['descripcion', 'Descripción'], ['monto', 'Monto reclamado (S/)'], ['tipo', 'Tipo'], ['detalle', 'Detalle'], ['pedido', 'Pedido']
  ];
  let last = null;

  form.elements.menor.addEventListener('change', e => { $('lr-apoderado').hidden = !e.target.checked; });

  const fechaLima = iso => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' });

  function constancia(d) {
    const dl = $('lr-datos');
    dl.textContent = '';
    for (const [k, label] of LABELS) {
      if (k === 'numero' || !d[k]) continue;
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = d[k];
      dl.append(dt, dd);
    }
    $('lr-numero').textContent = d.numero;
    form.hidden = true;
    $('lr-constancia').hidden = false;
    $('lr-ok').focus();
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const f = Object.fromEntries(new FormData(form));
      const r = await fetch('/api/reclamo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: f.nombre, documento: f.documento, email: f.email, tipo: f.tipo, detalle: f.detalle, pedido: f.pedido })
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.ok) throw new Error(out.error || 'numero');
      form.elements.numero.value = out.numero;
      form.elements.fecha.value = fechaLima(out.fecha);
      const s = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
      if (!s.ok) throw new Error('envio');
      last = Object.fromEntries(new FormData(form));
      last.tipo = last.tipo === 'queja' ? 'Queja' : 'Reclamo';
      constancia(last);
    } catch (x) {
      err.textContent = x && x.message === 'datos_incompletos'
        ? 'Revisa que estén tu nombre, tu documento, un correo válido, el detalle y tu pedido.'
        : 'No pudimos registrar tu hoja. Revisa tu conexión e inténtalo de nuevo en unos minutos.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar hoja de reclamación';
    }
  });

  $('lr-print').addEventListener('click', () => window.print());
  $('lr-download').addEventListener('click', () => {
    if (!last) return;
    const prov = [...document.querySelectorAll('.prov div')].map(d => `${d.querySelector('dt').textContent}: ${d.querySelector('dd').textContent}`).filter(l => !l.startsWith('Hoja'));
    const lines = ['LIBRO DE RECLAMACIONES: CONSTANCIA', ...prov, ''];
    for (const [k, label] of LABELS) if (last[k]) lines.push(`${label}: ${last[k]}`);
    lines.push('', 'Te responderemos al correo indicado en un plazo máximo de 15 días hábiles.');
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `hoja-reclamacion-${last.numero}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
})();
