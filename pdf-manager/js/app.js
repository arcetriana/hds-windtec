// js/app.js

const params    = new URLSearchParams(window.location.search);
const userType  = params.get('tipo') === 'admin' ? 'admin' : 'empleado';
let editingMode = false;
let allSelected = false;

document.addEventListener('DOMContentLoaded', () => {
  if (userType === 'admin') {
    document.getElementById('adminToggle').style.display = 'block';
    document.getElementById('btnToggleEdit').addEventListener('click', toggleEditMode);
    document.getElementById('btnToggleHistory').addEventListener('click', toggleHistory);
    document.getElementById('btnSelectAll').addEventListener('click', toggleSelectAll);
    document.getElementById('btnDeleteSelected').addEventListener('click', deleteSelected);
    document.getElementById('btnAdd').addEventListener('click', () =>
      document.getElementById('uploadPdf').click()
    );
    document.getElementById('uploadPdf').addEventListener('change', uploadPdf);
  }
  loadPdfList();
});

function toggleEditMode() {
  editingMode = !editingMode;
  document.getElementById('btnToggleEdit').textContent =
    editingMode ? '✅ Guardar' : '✏️ Editar';
  document.getElementById('adminControls').style.display =
    editingMode ? 'flex' : 'none';
  document.querySelectorAll('#pdfList li').forEach(li => {
    li.classList.toggle('editing', editingMode);
    if (!editingMode) li.classList.remove('selected');
  });
  allSelected = false;
  document.getElementById('btnSelectAll').textContent = 'Seleccionar todo';
}

function loadPdfList() {
  fetch('server.php?action=list')
    .then(r => r.json())
    .then(pdfs => {
      const list = document.getElementById('pdfList');
      list.innerHTML = '';
      pdfs.forEach(pdf => {
        const li = document.createElement('li');
        li.dataset.name = pdf.name;
        // Construye ruta relativa para el PDF
        const relativeUrl = `pdfs/${pdf.name}`;
        li.innerHTML = `
          <div class="select-circle"></div>
          <a href="${relativeUrl}" target="_blank">
            <canvas class="pdf-thumb"></canvas>
            <div class="pdf-title">${pdf.name}</div>
          </a>
        `;
        li.addEventListener('click', e => {
          if (!editingMode) return;
          e.preventDefault();
          li.classList.toggle('selected');
        });
        list.appendChild(li);

        // Renderiza miniatura con PDF.js usando ruta relativa
        const canvas = li.querySelector('canvas');
        pdfjsLib.getDocument({ url: relativeUrl }).promise
          .then(doc => doc.getPage(1))
          .then(page => {
            const vp = page.getViewport({ scale: 0.8 });
            canvas.width  = vp.width;
            canvas.height = vp.height;
            return page.render({
              canvasContext: canvas.getContext('2d'),
              viewport: vp
            }).promise;
          })
          .catch(console.error);
      });
    })
    .catch(console.error);
}

function toggleSelectAll() {
  if (!editingMode) return;
  allSelected = !allSelected;
  document.querySelectorAll('#pdfList li').forEach(li =>
    li.classList.toggle('selected', allSelected)
  );
  document.getElementById('btnSelectAll').textContent =
    allSelected ? 'Deseleccionar todo' : 'Seleccionar todo';
}

function deleteSelected() {
  const sel = Array.from(document.querySelectorAll('#pdfList li.selected'));
  if (!sel.length) return alert('No hay archivos seleccionados.');
  const reason = prompt('Razón para la eliminación:') || '';
  if (reason.trim().length < 1) return alert('Debes indicar una razón.');
  if (!confirm(`Eliminar ${sel.length} PDF(s)?`)) return;
  const form = new FormData();
  form.append('reason', reason.trim());
  sel.forEach(li => form.append('filenames[]', li.dataset.name));
  fetch('server.php?action=deleteMultiple', { method:'POST', body: form })
    .then(r => r.json())
    .then(res => {
      if (res.success) loadPdfList();
      else alert('Error: ' + res.error);
    })
    .catch(console.error);
}

function uploadPdf() {
  const input = document.getElementById('uploadPdf');
  if (!input.files.length) return alert('Selecciona un PDF.');
  const uploads = [...input.files].map(file => {
    const f = new FormData();
    f.append('file', file);
    return fetch('server.php?action=upload', { method:'POST', body: f })
      .then(r => r.json())
      .catch(() => ({ success:false, error:'Red' }));
  });
  Promise.all(uploads).then(results => {
    const errs = results.filter(r => !r.success).map(r => r.error);
    if (errs.length) alert('No subidos: ' + errs.join(', '));
    loadPdfList();
  });
}

function toggleHistory() {
  const c = document.getElementById('historyContainer');
  const btn = document.getElementById('btnToggleHistory');
  if (c.style.display === 'block') {
    c.style.display = 'none';
    btn.textContent = 'Historial';
  } else {
    c.style.display = 'block';
    btn.textContent = 'Ocultar historial';
    loadHistory();
  }
}

function loadHistory() {
  fetch('server.php?action=history')
    .then(r => r.json())
    .then(entries => {
      const ul = document.getElementById('historyList');
      if (!entries.length) {
        ul.innerHTML = '<li>No hay registros.</li>';
        return;
      }
      ul.innerHTML = entries
        .map(e => {
          let line = `${e.timestamp} | ${e.action} | ${e.filename}`;
          if (e.action === 'DELETE') line += ` | ${e.reason}`;
          return `<li>${line}</li>`;
        })
        .join('');
    })
    .catch(console.error);
}

function filterPdfs() {
  const term = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#pdfList li').forEach(li => {
    const title = li.querySelector('.pdf-title').textContent.toLowerCase();
    li.style.display = title.includes(term) ? '' : 'none';
  });
}
