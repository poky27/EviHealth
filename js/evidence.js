// evidence.js — Epistemological evidence tags rendering

const TAG_CONFIG = {
  'GUIA-OFICIAL': {
    label: 'Guia Oficial',
    icon: '\u{1F6E1}\u{FE0F}',
    description: 'Viene de una guia, protocolo u organismo oficial vigente (OMS, AAOS, ACR, OARSI, EULAR).',
    trustLevel: 5,
    color: 'green'
  },
  'TEXTO-REF': {
    label: 'Texto Referencia',
    icon: '\u{1F4D6}',
    description: 'Viene de un articulo academico, libro de referencia o estudio verificado con autor, ano y fuente.',
    trustLevel: 4,
    color: 'blue'
  },
  'CONSENSO': {
    label: 'Consenso',
    icon: '\u{1F465}',
    description: 'Conocimiento clinico o metodologico establecido con amplio acuerdo en la literatura.',
    trustLevel: 3,
    color: 'yellow'
  },
  'VERIFICAR-FUENTE': {
    label: 'Verificar Fuente',
    icon: '\u{1F50D}',
    description: 'Afirmacion que puede haber cambiado o depende del contexto. Necesita confirmacion.',
    trustLevel: 2,
    color: 'orange'
  },
  'SIN-VERIFICAR': {
    label: 'Sin Verificar',
    icon: '\u{26A0}\u{FE0F}',
    description: 'No se ha confirmado con fuente exacta. NO usar sin verificacion adicional.',
    trustLevel: 1,
    color: 'red'
  }
};

export function createEvidenceBadge(evidence, exerciseName) {
  const tag = evidence.tag;
  const config = TAG_CONFIG[tag] || TAG_CONFIG['SIN-VERIFICAR'];

  const badge = document.createElement('button');
  badge.className = `evidence-badge evidence-${tag}`;
  badge.textContent = `${config.icon} ${config.label}`;
  badge.setAttribute('aria-label', `Evidencia: ${config.label}. Toque para ver detalles.`);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    showEvidenceModal(evidence, exerciseName, config);
  });

  return badge;
}

export function createEvidenceBadgeHTML(evidence) {
  const tag = evidence.tag;
  const config = TAG_CONFIG[tag] || TAG_CONFIG['SIN-VERIFICAR'];
  return `<span class="evidence-badge evidence-${tag}">${config.icon} ${config.label}</span>`;
}

function showEvidenceModal(evidence, exerciseName, config) {
  const modal = document.getElementById('evidence-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (!modal || !title || !body) return;

  title.textContent = `Evidencia: ${exerciseName}`;

  const sourcesHTML = evidence.sources.map(s => `
    <div class="modal-source">
      <div class="modal-tag">${config.icon} ${config.label}</div>
      <div>${s}</div>
    </div>
  `).join('');

  const trustBar = createTrustBar(config.trustLevel);

  body.innerHTML = `
    <div class="modal-level">
      <strong>Nivel de confianza:</strong> ${config.trustLevel}/5
      ${trustBar}
      <p style="margin-top:8px;font-size:16px;color:#6b7280;">${config.description}</p>
    </div>
    <h4 style="margin-top:16px;margin-bottom:8px;">Fuentes:</h4>
    ${sourcesHTML}
    <div style="margin-top:16px;padding:12px;background:#f3f4f6;border-radius:8px;font-size:14px;color:#6b7280;">
      <strong>Nivel de evidencia:</strong> ${evidence.level || 'No especificado'}<br>
      Esta informacion es de apoyo. Siempre consulte a su medico.
    </div>
  `;

  modal.classList.remove('hidden');
}

function createTrustBar(level) {
  const filled = level;
  const empty = 5 - level;
  const colors = ['#dc2626', '#ea580c', '#d97706', '#2563eb', '#16a34a'];
  const color = colors[level - 1] || '#6b7280';

  let bar = '<div style="display:flex;gap:4px;margin-top:6px;">';
  for (let i = 0; i < 5; i++) {
    const bg = i < filled ? color : '#e5e7eb';
    bar += `<div style="flex:1;height:8px;border-radius:4px;background:${bg};"></div>`;
  }
  bar += '</div>';
  return bar;
}

export function getTagConfig(tag) {
  return TAG_CONFIG[tag] || TAG_CONFIG['SIN-VERIFICAR'];
}
