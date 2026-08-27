import {
  signIn,
  signUp,
  sendReset,
  resendVerification,
  reloadAndCheckVerified,
  currentEmail,
  logout,
  authMessage,
  AuthError,
} from '../application/auth-service';

type LoginField = 'email' | 'password';

const icons = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4z"/><path d="m4 7 8 6 8-6"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16"/><path d="M9.8 6.3A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8"/><path d="M6.1 7.5C3.8 9.2 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 3.1-.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></svg>',
  route: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="24" r="3"/><circle cx="24" cy="8" r="3"/><path d="M8 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 0 6-4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>'
};

const loginMarkup = `
  <section class="auth-shell" id="authShell" aria-labelledby="authTitle">
    <div class="auth-city" aria-hidden="true"></div>
    <div class="auth-ambient auth-ambient-one" aria-hidden="true"></div>
    <div class="auth-ambient auth-ambient-two" aria-hidden="true"></div>

    <div class="auth-layout">
      <div class="auth-scene">
        <a class="auth-brand" href="#" aria-label="Painel Motoboy — início">
          <span class="auth-brand-mark">${icons.route}</span>
          <span class="auth-brand-copy">
            <strong class="display">Painel Motoboy</strong>
            <small>Gestão na rua</small>
          </span>
        </a>

        <div class="auth-scene-copy">
          <span class="auth-eyebrow"><i></i> Sua operação em movimento</span>
          <h2 class="display">Seu corre.<br><em>Seus números.</em><br>No controle.</h2>
          <p>Rotas, despesas e resultados acompanhando o seu ritmo.</p>
        </div>

        <div class="auth-route-line" aria-hidden="true">
          <span class="auth-route-dot"></span>
          <span class="auth-route-track"></span>
          <span class="auth-route-bike">${icons.route}</span>
        </div>
      </div>

      <div class="auth-panel-wrap">
        <div class="auth-panel" id="loginPanel">
          <div class="auth-panel-topline" aria-hidden="true"></div>
          <div class="auth-mobile-brand">
            <span class="auth-brand-mark">${icons.route}</span>
            <span class="auth-brand-copy">
              <strong class="display">Painel Motoboy</strong>
              <small>Gestão na rua</small>
            </span>
          </div>

          <div class="auth-heading">
            <span class="auth-kicker">ACESSO SEGURO</span>
            <h1 id="authTitle">Bem-vindo de volta</h1>
            <p>Entre para acompanhar suas rotas, despesas e resultados.</p>
          </div>

          <form class="auth-form" id="loginForm" novalidate>
            <div class="auth-field" data-field="email">
              <label for="loginEmail">E-mail</label>
              <div class="auth-input-wrap">
                <span class="auth-input-icon">${icons.mail}</span>
                <input
                  id="loginEmail"
                  name="email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="voce@email.com"
                  aria-describedby="emailError"
                  aria-invalid="false"
                >
              </div>
              <span class="auth-field-error" id="emailError" aria-live="polite"></span>
            </div>

            <div class="auth-field" data-field="password">
              <div class="auth-label-row">
                <label for="loginPassword">Senha</label>
                <button class="auth-text-button" id="forgotPassword" type="button">Esqueci minha senha</button>
              </div>
              <div class="auth-input-wrap">
                <span class="auth-input-icon">${icons.lock}</span>
                <input
                  id="loginPassword"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Digite sua senha"
                  aria-describedby="passwordError"
                  aria-invalid="false"
                >
                <button class="auth-password-toggle" id="passwordToggle" type="button" aria-label="Mostrar senha" aria-pressed="false">
                  ${icons.eye}
                </button>
              </div>
              <span class="auth-field-error" id="passwordError" aria-live="polite"></span>
            </div>

            <div class="auth-status" id="authStatus" role="status" aria-live="polite"></div>

            <button class="auth-submit" id="loginSubmit" type="submit">
              <span class="auth-submit-label">Entrar</span>
              <span class="auth-submit-spinner" aria-hidden="true"></span>
              <span class="auth-submit-icon">${icons.arrow}</span>
            </button>
          </form>

          <p class="auth-create-account">
            Ainda não possui uma conta?
            <button class="auth-text-button" id="createAccount" type="button">Criar conta</button>
          </p>

          <div class="auth-security-note">
            <span>${icons.shield}</span>
            <p><strong>Seus dados, somente seus.</strong><br>O acesso será protegido individualmente para cada motoboy.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
`;

const registerMarkup = `
  <div class="auth-panel" id="registerPanel" hidden>
    <div class="auth-panel-topline" aria-hidden="true"></div>
    <div class="auth-heading">
      <span class="auth-kicker">CRIAR CONTA</span>
      <h1>Comece agora</h1>
      <p>Crie sua conta para acompanhar rotas, despesas e resultados.</p>
    </div>

    <form class="auth-form" id="registerForm" novalidate>
      <div class="auth-field" data-field="name">
        <label for="regName">Nome</label>
        <div class="auth-input-wrap">
          <span class="auth-input-icon">${icons.user}</span>
          <input id="regName" name="name" type="text" autocomplete="name" placeholder="Seu nome" aria-describedby="nameError" aria-invalid="false">
        </div>
        <span class="auth-field-error" id="nameError" aria-live="polite"></span>
      </div>

      <div class="auth-field" data-field="regEmail">
        <label for="regEmail">E-mail</label>
        <div class="auth-input-wrap">
          <span class="auth-input-icon">${icons.mail}</span>
          <input id="regEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="voce@email.com" aria-describedby="regEmailError" aria-invalid="false">
        </div>
        <span class="auth-field-error" id="regEmailError" aria-live="polite"></span>
      </div>

      <div class="auth-field" data-field="regPassword">
        <label for="regPassword">Senha</label>
        <div class="auth-input-wrap">
          <span class="auth-input-icon">${icons.lock}</span>
          <input id="regPassword" name="password" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres" aria-describedby="regPasswordError" aria-invalid="false">
          <button class="auth-password-toggle" id="regPasswordToggle" type="button" aria-label="Mostrar senha" aria-pressed="false">${icons.eye}</button>
        </div>
        <span class="auth-field-error" id="regPasswordError" aria-live="polite"></span>
      </div>

      <div class="auth-field" data-field="confirm">
        <label for="regConfirm">Confirmar senha</label>
        <div class="auth-input-wrap">
          <span class="auth-input-icon">${icons.lock}</span>
          <input id="regConfirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repita a senha" aria-describedby="confirmError" aria-invalid="false">
        </div>
        <span class="auth-field-error" id="confirmError" aria-live="polite"></span>
      </div>

      <label class="auth-terms" id="regTermsRow" data-field="terms">
        <input type="checkbox" id="regTerms" aria-describedby="termsError">
        <span>Li e aceito os <a href="#" class="auth-link">Termos de Uso</a> e a <a href="#" class="auth-link">Política de Privacidade</a>.</span>
      </label>
      <span class="auth-field-error" id="termsError" aria-live="polite"></span>

      <div class="auth-status" id="registerStatus" role="status" aria-live="polite"></div>

      <button class="auth-submit" id="registerSubmit" type="submit">
        <span class="auth-submit-label">Criar conta</span>
        <span class="auth-submit-spinner" aria-hidden="true"></span>
        <span class="auth-submit-icon">${icons.arrow}</span>
      </button>
    </form>

    <p class="auth-create-account">
      Já possui uma conta?
      <button class="auth-text-button" id="backToLogin" type="button">Entrar</button>
    </p>
  </div>
`;

const verifyMarkup = `
  <div class="auth-panel" id="verifyPanel" hidden>
    <div class="auth-panel-topline" aria-hidden="true"></div>
    <div class="auth-heading">
      <span class="auth-kicker">VERIFICAÇÃO</span>
      <h1>Confirme seu e-mail</h1>
      <p>Enviamos um link de verificação para <strong class="auth-verify-email" id="verifyEmail">seu e-mail</strong>. Abra o link para ativar sua conta e depois toque em "Já verifiquei".</p>
    </div>

    <div class="auth-status" id="verifyStatus" role="status" aria-live="polite"></div>

    <div class="auth-verify-actions">
      <button class="auth-submit" id="verifyCheck" type="button">
        <span class="auth-submit-label">Já verifiquei</span>
        <span class="auth-submit-spinner" aria-hidden="true"></span>
        <span class="auth-submit-icon">${icons.arrow}</span>
      </button>
      <button class="auth-text-button" id="verifyResend" type="button">Reenviar e-mail</button>
      <button class="auth-text-button" id="verifyBack" type="button">Usar outra conta</button>
    </div>
  </div>
`;

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Remove o login e revela o painel (usado após entrar / com sessão válida). */
export function unmountLoginView(): void {
  document.getElementById('authShell')?.remove();
  document.body.classList.remove('auth-locked');
}

export function mountLoginView(): void {
  if (document.getElementById('authShell')) return;

  document.body.insertAdjacentHTML('afterbegin', loginMarkup);
  document.body.classList.add('auth-locked');

  // Painéis de cadastro e verificação, no mesmo card do login (RF-07, RF-08).
  const panelWrap = document.querySelector<HTMLElement>('.auth-panel-wrap');
  panelWrap?.insertAdjacentHTML('beforeend', registerMarkup);
  panelWrap?.insertAdjacentHTML('beforeend', verifyMarkup);

  const form = document.querySelector<HTMLFormElement>('#loginForm');
  const email = document.querySelector<HTMLInputElement>('#loginEmail');
  const password = document.querySelector<HTMLInputElement>('#loginPassword');
  const toggle = document.querySelector<HTMLButtonElement>('#passwordToggle');
  const submit = document.querySelector<HTMLButtonElement>('#loginSubmit');
  const forgot = document.querySelector<HTMLButtonElement>('#forgotPassword');
  const createAccount = document.querySelector<HTMLButtonElement>('#createAccount');
  const status = document.querySelector<HTMLElement>('#authStatus');

  if (!form || !email || !password || !toggle || !submit || !forgot || !createAccount || !status) return;

  const showFieldError = (field: LoginField, message: string): void => {
    const input = field === 'email' ? email : password;
    const fieldElement = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
    const errorElement = document.querySelector<HTMLElement>(`#${field}Error`);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    fieldElement?.classList.toggle('has-error', Boolean(message));
    if (errorElement) errorElement.textContent = message;
  };

  const clearStatus = (): void => {
    status.textContent = '';
    status.removeAttribute('data-kind');
  };

  const validateEmail = (): boolean => {
    const value = email.value.trim();
    email.value = value;
    if (!value) {
      showFieldError('email', 'Informe seu e-mail.');
      return false;
    }
    if (!isEmailValid(value)) {
      showFieldError('email', 'Digite um e-mail válido.');
      return false;
    }
    showFieldError('email', '');
    return true;
  };

  const validatePassword = (): boolean => {
    if (!password.value) {
      showFieldError('password', 'Informe sua senha.');
      return false;
    }
    showFieldError('password', '');
    return true;
  };

  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid') === 'true') validateEmail();
    clearStatus();
  });

  password.addEventListener('input', () => {
    if (password.getAttribute('aria-invalid') === 'true') validatePassword();
    clearStatus();
  });

  email.addEventListener('blur', validateEmail);

  toggle.addEventListener('click', () => {
    const willShow = password.type === 'password';
    password.type = willShow ? 'text' : 'password';
    toggle.innerHTML = willShow ? icons.eyeOff : icons.eye;
    toggle.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');
    toggle.setAttribute('aria-pressed', String(willShow));
    password.focus({ preventScroll: true });
  });

  forgot.addEventListener('click', async () => {
    clearStatus();
    if (!validateEmail()) {
      email.focus();
      return;
    }
    forgot.disabled = true;
    try {
      await sendReset(email.value.trim());
    } catch (err) {
      if (err instanceof AuthError) {
        status.dataset.kind = 'error';
        status.textContent = authMessage(err.code);
        return;
      }
    } finally {
      forgot.disabled = false;
    }
    // Mensagem sempre genérica (RF-06): não revela se o e-mail está cadastrado.
    status.dataset.kind = 'success';
    status.textContent = 'Se este e-mail estiver cadastrado, enviaremos as instruções de recuperação.';
  });

  createAccount.addEventListener('click', () => {
    clearStatus();
    showStep('register');
  });

  const submitLabel = submit.querySelector<HTMLElement>('.auth-submit-label');

  const setLoading = (loading: boolean): void => {
    submit.disabled = loading;
    submit.classList.toggle('is-loading', loading);
    if (loading) submit.setAttribute('aria-busy', 'true');
    else submit.removeAttribute('aria-busy');
    if (submitLabel) submitLabel.textContent = loading ? 'Entrando...' : 'Entrar';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus();

    const emailIsValid = validateEmail();
    const passwordIsValid = validatePassword();
    if (!emailIsValid || !passwordIsValid) {
      (emailIsValid ? password : email).focus();
      return;
    }

    setLoading(true);
    try {
      await signIn(email.value.trim(), password.value);
      // Sucesso: revela o painel. O observador de auth (main.ts) também garante isso.
      unmountLoginView();
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'service-unavailable';
      status.dataset.kind = 'error';
      status.textContent = authMessage(code);
      setLoading(false);
    }
  });

  // ---------- Passos: login / cadastro / verificação ----------
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const verifyPanel = document.getElementById('verifyPanel');

  function showStep(step: 'login' | 'register' | 'verify'): void {
    if (loginPanel) loginPanel.hidden = step !== 'login';
    if (registerPanel) registerPanel.hidden = step !== 'register';
    if (verifyPanel) verifyPanel.hidden = step !== 'verify';
    const active = step === 'login' ? loginPanel : step === 'register' ? registerPanel : verifyPanel;
    active?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }

  // ---------- Cadastro (RF-07) ----------
  const regName = document.querySelector<HTMLInputElement>('#regName');
  const regEmail = document.querySelector<HTMLInputElement>('#regEmail');
  const regPassword = document.querySelector<HTMLInputElement>('#regPassword');
  const regConfirm = document.querySelector<HTMLInputElement>('#regConfirm');
  const regTerms = document.querySelector<HTMLInputElement>('#regTerms');
  const regToggle = document.querySelector<HTMLButtonElement>('#regPasswordToggle');
  const registerForm = document.querySelector<HTMLFormElement>('#registerForm');
  const registerSubmit = document.querySelector<HTMLButtonElement>('#registerSubmit');
  const registerStatus = document.querySelector<HTMLElement>('#registerStatus');
  const backToLogin = document.querySelector<HTMLButtonElement>('#backToLogin');

  const setRegError = (field: string, message: string): void => {
    const fieldEl = document.querySelector<HTMLElement>(`#registerPanel [data-field="${field}"]`);
    const errorEl = document.getElementById(`${field}Error`);
    fieldEl?.classList.toggle('has-error', Boolean(message));
    fieldEl?.querySelector('input')?.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (errorEl) errorEl.textContent = message;
  };

  if (
    registerForm && regName && regEmail && regPassword && regConfirm &&
    regTerms && regToggle && registerSubmit && registerStatus && backToLogin
  ) {
    regToggle.addEventListener('click', () => {
      const willShow = regPassword.type === 'password';
      regPassword.type = willShow ? 'text' : 'password';
      regToggle.innerHTML = willShow ? icons.eyeOff : icons.eye;
      regToggle.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');
      regToggle.setAttribute('aria-pressed', String(willShow));
      regPassword.focus({ preventScroll: true });
    });

    backToLogin.addEventListener('click', () => {
      registerStatus.textContent = '';
      registerStatus.removeAttribute('data-kind');
      showStep('login');
    });

    const regLabel = registerSubmit.querySelector<HTMLElement>('.auth-submit-label');
    const setRegLoading = (loading: boolean): void => {
      registerSubmit.disabled = loading;
      registerSubmit.classList.toggle('is-loading', loading);
      if (loading) registerSubmit.setAttribute('aria-busy', 'true');
      else registerSubmit.removeAttribute('aria-busy');
      if (regLabel) regLabel.textContent = loading ? 'Criando...' : 'Criar conta';
    };

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      registerStatus.textContent = '';
      registerStatus.removeAttribute('data-kind');

      const nameValue = regName.value.trim();
      regName.value = nameValue;
      const emailValue = regEmail.value.trim();
      regEmail.value = emailValue;

      let firstInvalid: HTMLElement | null = null;
      const fail = (el: HTMLElement): void => { if (!firstInvalid) firstInvalid = el; };

      if (!nameValue) { setRegError('name', 'Informe seu nome.'); fail(regName); } else setRegError('name', '');

      if (!emailValue) { setRegError('regEmail', 'Informe seu e-mail.'); fail(regEmail); }
      else if (!isEmailValid(emailValue)) { setRegError('regEmail', 'Digite um e-mail válido.'); fail(regEmail); }
      else setRegError('regEmail', '');

      if (!regPassword.value) { setRegError('regPassword', 'Crie uma senha.'); fail(regPassword); }
      else if (regPassword.value.length < 6) { setRegError('regPassword', 'A senha deve ter pelo menos 6 caracteres.'); fail(regPassword); }
      else setRegError('regPassword', '');

      if (!regConfirm.value) { setRegError('confirm', 'Repita a senha.'); fail(regConfirm); }
      else if (regConfirm.value !== regPassword.value) { setRegError('confirm', 'As senhas não coincidem.'); fail(regConfirm); }
      else setRegError('confirm', '');

      if (!regTerms.checked) { setRegError('terms', 'É necessário aceitar os termos.'); fail(regTerms); }
      else setRegError('terms', '');

      if (firstInvalid) { (firstInvalid as HTMLElement).focus({ preventScroll: true }); return; }

      setRegLoading(true);
      try {
        await signUp(nameValue, emailValue, regPassword.value);
        const verifyEmailEl = document.getElementById('verifyEmail');
        if (verifyEmailEl) verifyEmailEl.textContent = currentEmail() ?? emailValue;
        showStep('verify');
        const verifyStatusEl = document.getElementById('verifyStatus');
        if (verifyStatusEl) {
          verifyStatusEl.dataset.kind = 'success';
          verifyStatusEl.textContent = 'Conta criada! Enviamos um link de verificação para o seu e-mail.';
        }
      } catch (err) {
        const code = err instanceof AuthError ? err.code : 'service-unavailable';
        registerStatus.dataset.kind = 'error';
        registerStatus.textContent = authMessage(code);
      } finally {
        setRegLoading(false);
      }
    });

    [regName, regEmail, regPassword, regConfirm].forEach((input) => {
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') {
          const field = input.closest<HTMLElement>('[data-field]')?.dataset.field;
          if (field) setRegError(field, '');
        }
      });
    });
    regTerms.addEventListener('change', () => { if (regTerms.checked) setRegError('terms', ''); });
  }

  // ---------- Verificação de e-mail (RF-08) ----------
  const verifyCheck = document.querySelector<HTMLButtonElement>('#verifyCheck');
  const verifyResend = document.querySelector<HTMLButtonElement>('#verifyResend');
  const verifyBack = document.querySelector<HTMLButtonElement>('#verifyBack');
  const verifyStatus = document.querySelector<HTMLElement>('#verifyStatus');

  if (verifyCheck && verifyResend && verifyBack && verifyStatus) {
    const verifyLabel = verifyCheck.querySelector<HTMLElement>('.auth-submit-label');
    const setVerifyLoading = (loading: boolean): void => {
      verifyCheck.disabled = loading;
      verifyCheck.classList.toggle('is-loading', loading);
      if (loading) verifyCheck.setAttribute('aria-busy', 'true');
      else verifyCheck.removeAttribute('aria-busy');
      if (verifyLabel) verifyLabel.textContent = loading ? 'Verificando...' : 'Já verifiquei';
    };

    verifyCheck.addEventListener('click', async () => {
      verifyStatus.textContent = '';
      verifyStatus.removeAttribute('data-kind');
      setVerifyLoading(true);
      try {
        if (await reloadAndCheckVerified()) {
          unmountLoginView();
          return;
        }
        verifyStatus.dataset.kind = 'error';
        verifyStatus.textContent = 'Ainda não confirmamos seu e-mail. Abra o link que enviamos.';
      } catch {
        verifyStatus.dataset.kind = 'error';
        verifyStatus.textContent = authMessage('service-unavailable');
      } finally {
        setVerifyLoading(false);
      }
    });

    verifyResend.addEventListener('click', async () => {
      verifyStatus.textContent = '';
      verifyStatus.removeAttribute('data-kind');
      verifyResend.disabled = true;
      try {
        await resendVerification();
        verifyStatus.dataset.kind = 'success';
        verifyStatus.textContent = 'Reenviamos o e-mail de verificação.';
      } catch (err) {
        const code = err instanceof AuthError ? err.code : 'service-unavailable';
        verifyStatus.dataset.kind = 'error';
        verifyStatus.textContent = authMessage(code);
      } finally {
        verifyResend.disabled = false;
      }
    });

    verifyBack.addEventListener('click', async () => {
      try { await logout(); } catch { /* ignora */ }
      showStep('login');
    });
  }
}
