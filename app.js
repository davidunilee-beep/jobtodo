'use strict';

(() => {
  const STORAGE_KEY = 'one-day-journal-v1';
  const $ = (selector) => document.querySelector(selector);
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const parseDate = (key) => new Date(`${key}T12:00:00`);
  const isDateKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(parseDate(key).valueOf()) && dateKey(parseDate(key)) === key;
  let selected = dateKey(new Date());
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  let data = {};
  let toastTimer;
  let lastToday = selected;

  function notify(text) {
    $('#message').textContent = text;
    $('#message').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#message').hidden = true; }, 4500);
  }

  function validateData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('잘못된 기록 형식');
    const result = {};
    for (const [key, day] of Object.entries(value)) {
      if (!isDateKey(key) || !day || typeof day.note !== 'string' || day.note.length > 50000 || !Array.isArray(day.tasks) || day.tasks.length > 1000) throw new Error('잘못된 날짜 또는 기록');
      const tasks = day.tasks.map((task) => {
        if (!task || typeof task.text !== 'string' || !task.text.trim() || task.text.length > 300 || typeof task.done !== 'boolean') throw new Error('잘못된 할 일');
        return { id: crypto.randomUUID(), text: task.text, done: task.done };
      });
      result[key] = { note: day.note, tasks };
    }
    return result;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) data = validateData(JSON.parse(saved));
  } catch {
    notify('저장된 기록을 읽지 못했어요. 기존 데이터는 덮어쓰지 않습니다.');
    // Require explicit recovery before a corrupt store can be overwritten.
    $('#todo-input').disabled = true;
    $('#todo-form button').disabled = true;
    $('#daily-note').disabled = true;
  }

  function dayData() { return data[selected] || { note: '', tasks: [] }; }
  function hasRecord(day) { return !!day && (!!day.note.trim() || day.tasks.length > 0); }
  function save(nextData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      data = nextData;
      $('#save-status').textContent = `저장됨 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      renderCalendar();
      return true;
    } catch {
      $('#save-status').textContent = '저장 실패';
      notify('저장 공간이 부족하거나 브라우저 저장이 차단됐어요. 입력한 내용을 복사해 보관해 주세요.');
      return false;
    }
  }

  function renderCalendar() {
    const year = month.getFullYear();
    const m = month.getMonth();
    $('#month-title').textContent = `${year}년 ${m + 1}월`;
    $('#prev-month').disabled = year <= 1900 && m === 0;
    $('#next-month').disabled = year >= 9999 && m === 11;
    const firstWeekday = new Date(year, m, 1, 12).getDay();
    const days = new Date(year, m + 1, 0, 12).getDate();
    const cells = Math.ceil((firstWeekday + days) / 7) * 7;
    const fragment = document.createDocumentFragment();
    const today = dateKey(new Date());
    for (let i = 0; i < cells; i++) {
      const date = new Date(year, m, i - firstWeekday + 1, 12);
      const key = dateKey(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      button.classList.toggle('outside', date.getMonth() !== m);
      button.classList.toggle('today', key === today);
      button.classList.toggle('selected', key === selected);
      button.classList.toggle('sunday', date.getDay() === 0);
      button.classList.toggle('has-record', hasRecord(data[key]));
      button.textContent = date.getDate();
      button.setAttribute('aria-label', `${date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}${hasRecord(data[key]) ? ', 기록 있음' : ''}`);
      button.setAttribute('aria-pressed', String(key === selected));
      if (key === today) button.setAttribute('aria-current', 'date');
      button.addEventListener('click', () => selectDate(key));
      fragment.append(button);
    }
    $('#calendar').replaceChildren(fragment);
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}-`;
    const monthDays = Object.entries(data).filter(([key]) => key.startsWith(prefix)).map(([, day]) => day);
    $('#record-days').textContent = monthDays.filter(hasRecord).length;
    $('#completed-total').textContent = monthDays.reduce((sum, day) => sum + day.tasks.filter((task) => task.done).length, 0);
  }

  function renderTasks() {
    const tasks = dayData().tasks;
    const fragment = document.createDocumentFragment();
    tasks.forEach((task) => {
      const row = document.createElement('li');
      row.className = `todo-row${task.done ? ' done' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.id = `task-${task.id}`;
      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = task.text;
      checkbox.addEventListener('change', () => {
        const day = dayData();
        save({ ...data, [selected]: { ...day, tasks: day.tasks.map((item) => item.id === task.id ? { ...item, done: checkbox.checked } : item) } });
        renderTasks();
      });
      const remove = document.createElement('button');
      remove.className = 'delete-task';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${task.text} 삭제`);
      remove.addEventListener('click', () => {
        const day = dayData();
        if (save({ ...data, [selected]: { ...day, tasks: day.tasks.filter((item) => item.id !== task.id) } })) {
          renderTasks();
          $('#todo-input').focus();
        }
      });
      row.append(checkbox, label, remove);
      fragment.append(row);
    });
    $('#todo-list').replaceChildren(fragment);
    $('#empty-todos').hidden = tasks.length > 0;
    $('#todo-count').textContent = tasks.length;
    const completed = tasks.filter((task) => task.done).length;
    $('#progress-label').textContent = `${completed} / ${tasks.length} 완료`;
    $('#progress-bar').style.width = `${tasks.length ? completed / tasks.length * 100 : 0}%`;
  }

  function selectDate(key) {
    // Keep unsaved text on screen rather than silently losing it on navigation.
    if (!$('#daily-note').disabled && $('#daily-note').value !== dayData().note) {
      if (!save({ ...data, [selected]: { ...dayData(), note: $('#daily-note').value } })) return;
    }
    selected = key;
    const date = parseDate(key);
    month = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    $('#selected-label').textContent = `${date.getFullYear()} · ${String(date.getMonth() + 1).padStart(2, '0')} · ${String(date.getDate()).padStart(2, '0')}`;
    $('#selected-title').textContent = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    $('#day-badge').textContent = key === dateKey(new Date()) ? '오늘의 페이지' : '하루의 페이지';
    $('#daily-note').value = dayData().note;
    $('#note-count').textContent = `${dayData().note.length.toLocaleString('ko-KR')}자`;
    $('#todo-input').value = '';
    $('#save-status').textContent = hasRecord(dayData()) ? '저장된 기록' : '자동 저장';
    renderCalendar();
    renderTasks();
  }

  $('#todo-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('#todo-input').value.trim();
    if (!text) return;
    const day = dayData();
    if (day.tasks.length >= 1000) return notify('하루에 할 일은 1,000개까지 기록할 수 있어요.');
    if (save({ ...data, [selected]: { ...day, tasks: [...day.tasks, { id: crypto.randomUUID(), text, done: false }] } })) {
      $('#todo-input').value = '';
      renderTasks();
      $('#todo-input').focus();
    }
  });

  $('#daily-note').addEventListener('input', () => {
    const note = $('#daily-note').value;
    $('#note-count').textContent = `${note.length.toLocaleString('ko-KR')}자`;
    save({ ...data, [selected]: { ...dayData(), note } });
  });
  $('#prev-month').addEventListener('click', () => { month.setMonth(month.getMonth() - 1); renderCalendar(); });
  $('#next-month').addEventListener('click', () => { month.setMonth(month.getMonth() + 1); renderCalendar(); });
  $('#go-today').addEventListener('click', () => selectDate(dateKey(new Date())));

  $('#export-data').addEventListener('click', () => {
    const snapshot = { ...data, [selected]: { ...dayData(), note: $('#daily-note').value } };
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), days: snapshot }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `오늘의기록-${dateKey(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('기록 백업 파일을 내보냈어요.');
  });
  $('#import-data').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('파일이 너무 큽니다');
      const backup = JSON.parse(await file.text());
      if (backup.version !== 1) throw new Error('지원하지 않는 백업 형식');
      const imported = validateData(backup.days);
      if (!confirm('백업 기록을 불러올까요? 같은 날짜의 기존 기록은 백업 내용으로 바뀝니다.')) return;
      if (save({ ...data, ...imported })) {
        $('#todo-input').disabled = false;
        $('#todo-form button').disabled = false;
        $('#daily-note').disabled = false;
        // Reset before selection so an old editor value cannot overwrite restored text.
        $('#daily-note').value = dayData().note;
        selectDate(selected);
        notify('백업 기록을 불러왔어요.');
      }
    } catch { notify('올바른 오늘의 기록 백업 파일을 선택해 주세요. (최대 10MB)'); }
    finally { event.target.value = ''; }
  });

  function tick() {
    const now = new Date();
    $('#live-date').textContent = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    $('#live-clock').textContent = now.toLocaleTimeString('ko-KR', { hour12: false });
    const today = dateKey(now);
    if (lastToday !== today) {
      lastToday = today;
      renderCalendar();
      $('#day-badge').textContent = selected === today ? '오늘의 페이지' : '하루의 페이지';
    }
  }
  // Update open tabs when another tab saves, while preserving actively edited text.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (document.activeElement === $('#daily-note') || $('#todo-input').value) {
      notify('다른 탭의 기록이 변경됐어요. 입력을 마친 후 새로고침해 확인해 주세요.');
      return;
    }
    try {
      const incoming = validateData(JSON.parse(event.newValue || '{}'));
      data = incoming;
      $('#daily-note').value = dayData().note;
      selectDate(selected);
    } catch { notify('다른 탭의 기록을 읽지 못했어요.'); }
  });
  tick();
  $('#daily-note').value = dayData().note;
  selectDate(selected);
  setInterval(tick, 1000);
})();
