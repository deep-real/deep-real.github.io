const $ = selector => document.querySelector(selector);

const modelResults = $('#model');
const resultTabs = [...document.querySelectorAll('[data-result-tab]')];
const resultPanels = resultTabs.map(tab => document.getElementById(tab.dataset.resultTab));

if (modelResults && resultTabs.length && resultPanels.every(Boolean)) {
  function selectResult(index, moveFocus = false) {
    resultTabs.forEach((tab, current) => {
      const selected = current === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      resultPanels[current].hidden = !selected;
    });
    if (moveFocus) resultTabs[index].focus({preventScroll: true});
  }

  function revealLinkedResult() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const index = resultPanels.findIndex(panel => panel === target || panel.contains(target));
    if (index < 0) return;
    selectResult(index);
    const scrollTarget = target.classList.contains('model-result-heading') ? resultPanels[index] : target;
    requestAnimationFrame(() => scrollTarget.scrollIntoView({block: 'start'}));
  }

  resultTabs.forEach((tab, index) => {
    const panel = resultPanels[index];
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', () => selectResult(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % resultTabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + resultTabs.length) % resultTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = resultTabs.length - 1;
      else return;
      event.preventDefault();
      selectResult(next, true);
    });
  });

  modelResults.classList.add('model-results-enhanced');
  modelResults.querySelector('.model-result-tabs').hidden = false;
  selectResult(0);
  revealLinkedResult();
  window.addEventListener('hashchange', revealLinkedResult);
}

async function copyCitationText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // A directly opened review file may require the selection-based fallback.
    }
  }
  const previousFocus = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    field.remove();
    previousFocus?.focus({preventScroll: true});
  }
  if (!copied) throw new Error('Clipboard is unavailable');
}

const citations = {
  icml: `@inproceedings{Ma2025tumor,
  title = {{\`\`Why Is There a Tumor?'': Tell Me the Reason, Show Me the Evidence}},
  author = {Ma, Mengmeng and Li, Tang and Peng, Yunxiang and Lin, Lu and Beylergil, Volkan and Zhao, Binsheng and Akin, Oguz and Peng, Xi},
  booktitle = {ICML},
  year = {2025}
}`,
  eccv: `@inproceedings{ma2026medsae,
  title = {{Medical AI Encodes a "Feeling of Error": Verifying Cancer Segmentation via Internal Concepts}},
  author = {Mengmeng Ma and Yunxiang Peng and Tang Li and Lin Lu and Volkan Beylergil and Binsheng Zhao and Oguz Akin and Xi Peng},
  booktitle = {Proceedings of the European Conference on Computer Vision (ECCV)},
  year = {2026},
}`,
  correct: `@inproceedings{li2024correct,
  title = {{Beyond Accuracy: Ensuring Correct Predictions With Correct Rationales}},
  author = {Li, Tang and Ma, Mengmeng and Peng, Xi},
  booktitle = {Proceedings of the Conference on Neural Information Processing Systems (NeurIPS)},
  year = {2024},
  url = {https://neurips.cc/virtual/2024/poster/96272}
}`,
  deal: `@inproceedings{li2024deal,
  title = {{DEAL: Disentangle and Localize Concept-level Explanations for VLMs}},
  author = {Li, Tang and Ma, Mengmeng and Peng, Xi},
  booktitle = {Proceedings of the European Conference on Computer Vision (ECCV)},
  year = {2024},
  note = {Strong Double Blind},
  url = {https://link.springer.com/chapter/10.1007/978-3-031-72933-1_22}
}`,
  vase: `@inproceedings{li2026vase,
  title = {{Inside the Visual Mind: Neuroscience-Motivated Concept Circuits for Interpreting and Steering Vision Transformers}},
  author = {Tang Li and Yanlin Chen and Mengmeng Ma and Xi Peng},
  booktitle = {Proceedings of the International Conference on Machine Learning (ICML)},
  year = {2026},
  url = {https://icml.cc/virtual/2026/poster/64294}
}`,
  world: `@inproceedings{chen2026world,
  title = {{"World Knowledge" in the Weights: Reading Concept Circuits of Vision Transformers}},
  author = {Chen, Yanlin and Li, Tang and Peng, Xi},
  booktitle = {Proceedings of the European Conference on Computer Vision (ECCV)},
  year = {2026},
  url = {https://arxiv.org/abs/2609.09055}
}`
};
document.querySelectorAll('[data-citation]').forEach(button => {
  const key = button.dataset.citation;
  const panel = $(`#citation-${key}`);
  const copyButton = $(`[data-copy-citation="${key}"]`);
  const copyLabel = copyButton.querySelector('.copy-label');
  const message = panel.querySelector('.citation-message');
  panel.querySelector('code').textContent = citations[key];
  let resetCopyLabel;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
    copyButton.hidden = !expanded;
  });
  copyButton.addEventListener('click', async () => {
    clearTimeout(resetCopyLabel);
    copyButton.disabled = true;
    copyLabel.textContent = 'Copy';
    message.hidden = true;
    $('#citation-status').textContent = '';
    try {
      await copyCitationText(citations[key]);
      copyLabel.textContent = 'Copied ✓';
      $('#citation-status').textContent = `${key.toUpperCase()} BibTeX citation copied to clipboard.`;
      resetCopyLabel = setTimeout(() => {copyLabel.textContent = 'Copy';}, 2300);
    } catch {
      message.textContent = 'Copy is unavailable here. Select the citation above and copy it manually.';
      message.hidden = false;
      $('#citation-status').textContent = message.textContent;
    } finally {
      copyButton.disabled = false;
    }
  });
});
