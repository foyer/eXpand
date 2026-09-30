const DEFAULTS = {
  enabled: true,
  columnWidth: 1200,
  fillWidth: false,
  leftNav: 'icons',
  rightSidebar: 'hide',
  autoExpand: true,
  expandMaxLines: 15,
  mediaMaxHeight: 800,
  theme: 'x',
  videoCrop: '3:4',
  hideAds: true,
  hideComposer: false,
  hideTabBar: false,
  hideViews: false,
  hideCounts: false,
  hideGrokButton: false,
  hideNavGrok: false,
  hideNavPremium: false,
  hideNavCreatorStudio: false,
  hideNavHistory: false,
  hideNavCommunities: false,
  hideNavJobs: false
};

const $ = (id) => document.getElementById(id);

function save(patch) {
  chrome.storage.sync.set(patch);
}

function reflect(s) {
  $('enabled').checked = s.enabled;
  document.body.classList.toggle('disabled', !s.enabled);

  $('fillWidth').checked = s.fillWidth;
  $('widthSection').classList.toggle('off', s.fillWidth);
  $('columnWidth').value = s.columnWidth;
  $('columnWidthOut').textContent = `${s.columnWidth}px`;

  for (const seg of document.querySelectorAll('.seg')) {
    const key = seg.dataset.key;
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('active', b.dataset.value === s[key]);
  }

  $('mediaMaxHeight').value = s.mediaMaxHeight;
  $('mediaMaxHeightOut').textContent = `${s.mediaMaxHeight}px`;

  for (const box of document.querySelectorAll('.checks input[data-key]')) box.checked = !!s[box.dataset.key];

  $('autoExpand').checked = s.autoExpand;
  $('thresholdSection').classList.toggle('off', !s.autoExpand);
  $('expandMaxLines').value = s.expandMaxLines;
  $('expandMaxLinesOut').textContent = s.expandMaxLines;
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  const s = { ...DEFAULTS, ...stored };
  reflect(s);

  $('enabled').addEventListener('change', (e) => { s.enabled = e.target.checked; save({ enabled: s.enabled }); reflect(s); });

  $('fillWidth').addEventListener('change', (e) => { s.fillWidth = e.target.checked; save({ fillWidth: s.fillWidth }); reflect(s); });

  $('columnWidth').addEventListener('input', (e) => { s.columnWidth = Number(e.target.value); reflect(s); });
  $('columnWidth').addEventListener('change', (e) => save({ columnWidth: Number(e.target.value) }));

  for (const seg of document.querySelectorAll('.seg')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      s[seg.dataset.key] = b.dataset.value;
      save({ [seg.dataset.key]: b.dataset.value });
      reflect(s);
    });
  }

  $('mediaMaxHeight').addEventListener('input', (e) => { s.mediaMaxHeight = Number(e.target.value); reflect(s); });
  $('mediaMaxHeight').addEventListener('change', (e) => save({ mediaMaxHeight: Number(e.target.value) }));

  for (const box of document.querySelectorAll('.checks input[data-key]')) {
    box.addEventListener('change', (e) => { s[box.dataset.key] = e.target.checked; save({ [box.dataset.key]: e.target.checked }); });
  }

  $('autoExpand').addEventListener('change', (e) => { s.autoExpand = e.target.checked; save({ autoExpand: s.autoExpand }); reflect(s); });

  $('expandMaxLines').addEventListener('input', (e) => { s.expandMaxLines = Number(e.target.value); reflect(s); });
  $('expandMaxLines').addEventListener('change', (e) => save({ expandMaxLines: Number(e.target.value) }));
});
