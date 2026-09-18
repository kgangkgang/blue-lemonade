(() => {
  const form = document.querySelector('#reading-controls');
  const sample = document.querySelector('#reading-sample');
  const values = [
    ['size', 'px', 1], ['spacing', 'em', .01], ['line', '', 1],
    ['para', 'em', 1], ['gutter', 'px', 1],
  ];
  function updateReading() {
    for (const [key, unit, multiplier] of values) {
      const input = document.querySelector('#read-' + key);
      const value = Number((Number(input.value) * multiplier).toFixed(2)) + unit;
      sample.style.setProperty('--read-' + key, value);
      form.querySelector(`output[for="${input.id}"]`).textContent = value;
      input.setAttribute('aria-valuetext', value);
    }
    const align = document.querySelector('#read-align').value;
    sample.style.textAlign = align === 'left' ? 'left' : 'justify';
    sample.style.wordBreak = align === 'break' ? 'break-all' : 'keep-all';
    sample.style.setProperty('--read-indent', document.querySelector('#read-indent').checked ? '1em' : '0');
  }
  form.addEventListener('input', updateReading);
  form.addEventListener('change', updateReading);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => requestAnimationFrame(updateReading));
  updateReading();

  const query = document.querySelector('#feature-query');
  const groups = [...document.querySelectorAll('.feature-group')];
  const cards = [...document.querySelectorAll('.feature-card')];
  const originalOpen = new Map();
  let searching = false;
  function filter() {
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length && !searching) groups.forEach(group => originalOpen.set(group, group.open));
    let total = 0;
    for (const group of groups) {
      let count = 0;
      for (const card of group.querySelectorAll('.feature-card')) {
        const text = card.textContent.toLocaleLowerCase();
        const matches = terms.every(term => text.includes(term));
        card.hidden = !matches;
        if (matches) count++;
      }
      group.hidden = count === 0;
      group.querySelector('.feature-group-count').textContent = count + '가지';
      if (terms.length) group.open = count > 0;
      else if (searching) group.open = originalOpen.get(group);
      total += count;
    }
    searching = terms.length > 0;
    document.querySelector('#feature-result').textContent = searching
      ? `${cards.length}가지 중 ${total}가지 기능` : `${cards.length}가지 기능 안내`;
    document.querySelector('#feature-empty').hidden = total > 0;
  }
  query.addEventListener('input', filter);
  document.querySelector('#feature-clear').addEventListener('click', () => {
    query.value = ''; filter(); query.focus();
  });
  document.querySelector('.feature-search').hidden = false;
})();
