'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const dialog = $('#auth-dialog');
  let mode = 'login';
  let busy = false;
  let clientPromise;
  let sdkPromise;

  function feedback(message, error = false) {
    $('#auth-feedback').textContent = message;
    $('#auth-feedback').classList.toggle('error', error);
  }

  function setBusy(value) {
    busy = value;
    ['#auth-submit', '#login-mode', '#signup-mode', '#auth-email', '#auth-password'].forEach((selector) => { $(selector).disabled = value; });
    $('#auth-form').setAttribute('aria-busy', String(value));
    $('#auth-submit').textContent = value ? '잠시만 기다려 주세요…' : mode === 'login' ? '로그인' : '회원가입';
  }

  function setMode(nextMode) {
    if (busy) return;
    mode = nextMode;
    const signup = mode === 'signup';
    $('#login-mode').setAttribute('aria-pressed', String(!signup));
    $('#signup-mode').setAttribute('aria-pressed', String(signup));
    $('#auth-title').textContent = signup ? '나의 하루, 여기서 시작해요' : '다시 만나 반가워요';
    $('#auth-description').textContent = signup ? '이메일로 새로운 계정을 만들어 보세요.' : '이메일과 비밀번호로 로그인하세요.';
    $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    $('#auth-password').minLength = signup ? 8 : 1;
    $('#auth-password').value = '';
    $('#password-help').hidden = !signup;
    $('#auth-submit').textContent = signup ? '회원가입' : '로그인';
    feedback('');
  }

  function renderSession(session) {
    const email = session?.user?.email;
    $('#open-auth').hidden = !!email;
    $('#account-email').hidden = !email;
    $('#logout').hidden = !email;
    $('#account-email').textContent = email || '';
    $('#account-email').title = email || '';
  }

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      let timeout;
      const fail = () => {
        clearTimeout(timeout);
        script.remove();
        sdkPromise = null;
        reject(new Error('로그인 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'));
      };
      script.onload = () => {
        clearTimeout(timeout);
        if (window.supabase?.createClient) resolve(window.supabase);
        else fail();
      };
      script.onerror = fail;
      timeout = setTimeout(fail, 15000);
      document.head.append(script);
    });
    return sdkPromise;
  }

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      if (!/^https?:$/.test(location.protocol)) throw new Error('로그인은 Vercel 배포 주소에서 사용할 수 있어요. 로컬에서는 Vercel 개발 서버를 실행해 주세요.');
      const response = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      let config;
      try { config = await response.json(); }
      catch { throw new Error('로그인 설정 API가 없어요. Vercel 배포 주소 또는 Vercel 개발 서버에서 실행해 주세요.'); }
      if (!response.ok) throw new Error(config.error || '로그인 설정을 불러오지 못했어요.');
      const sdk = await loadSdk();
      const client = sdk.createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
      });
      // Keep this callback synchronous: awaiting another auth call here can deadlock.
      let receivedEvent = false;
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        receivedEvent = true;
        renderSession(session);
      });
      const { data, error } = await client.auth.getSession();
      if (error) {
        listener.subscription.unsubscribe();
        throw error;
      }
      if (!receivedEvent) renderSession(data.session);
      return client;
    })().catch((error) => { clientPromise = null; throw error; });
    return clientPromise;
  }

  function errorMessage(error) {
    const messages = {
      invalid_credentials: '이메일 또는 비밀번호가 올바르지 않아요.',
      email_not_confirmed: '받은 메일에서 이메일 인증을 완료한 뒤 로그인해 주세요.',
      user_already_exists: '이미 가입된 이메일이에요. 로그인해 주세요.',
      email_exists: '이미 가입된 이메일이에요. 로그인해 주세요.',
      weak_password: '비밀번호가 보안 조건을 충족하지 않아요. 더 강한 비밀번호를 입력해 주세요.',
      signup_disabled: '현재 회원가입이 비활성화되어 있어요.',
      over_email_send_rate_limit: '이메일 발송 요청이 많아요. 잠시 후 다시 시도해 주세요.',
      over_request_rate_limit: '요청이 많아요. 잠시 후 다시 시도해 주세요.'
    };
    if (messages[error.code]) return messages[error.code];
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError) return '연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    // Supabase messages can include project-specific validation requirements.
    return error.message || '요청을 처리하지 못했어요. 다시 시도해 주세요.';
  }

  $('#open-auth').addEventListener('click', () => {
    if (!busy) {
      setMode('login');
      $('#auth-form').reset();
    }
    dialog.showModal();
    $('#auth-email').focus();
  });
  $('#close-auth').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { $('#auth-password').value = ''; });
  $('#login-mode').addEventListener('click', () => setMode('login'));
  $('#signup-mode').addEventListener('click', () => setMode('signup'));

  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !event.target.reportValidity()) return;
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    setBusy(true);
    feedback('연결하고 있어요…');
    try {
      const client = await getClient();
      const { data, error } = mode === 'signup'
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/` } })
        : await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      $('#auth-password').value = '';
      if (data.session) {
        renderSession(data.session);
        dialog.close();
      } else {
        feedback('인증 메일을 확인해 주세요. 이메일 인증을 마친 뒤 로그인할 수 있어요.');
      }
    } catch (error) { feedback(errorMessage(error), true); }
    finally { setBusy(false); }
  });

  $('#logout').addEventListener('click', async () => {
    $('#logout').disabled = true;
    $('#logout').textContent = '로그아웃 중…';
    try {
      const client = await getClient();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      renderSession(null);
    } catch (error) {
      dialog.showModal();
      feedback(`로그아웃하지 못했어요. ${errorMessage(error)}`, true);
    } finally {
      $('#logout').disabled = false;
      $('#logout').textContent = '로그아웃';
    }
  });

  // Restore a persisted session without interrupting calendar initialization.
  getClient().catch(() => {});
})();
