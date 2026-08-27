type LoginField = 'email' | 'password';

const icons = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4z"/><path d="m4 7 8 6 8-6"/></svg>',
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
        <div class="auth-panel">
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

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function mountLoginView(): void {
  if (document.getElementById('authShell')) return;

  document.body.insertAdjacentHTML('afterbegin', loginMarkup);
  document.body.classList.add('auth-locked');

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

  forgot.addEventListener('click', () => {
    clearStatus();
    if (!validateEmail()) {
      email.focus();
      return;
    }
    status.dataset.kind = 'success';
    status.textContent = 'Se este e-mail estiver cadastrado, enviaremos as instruções de recuperação.';
  });

  createAccount.addEventListener('click', () => {
    status.dataset.kind = 'info';
    status.textContent = 'A criação de conta será habilitada na etapa de cadastro.';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearStatus();

    const emailIsValid = validateEmail();
    const passwordIsValid = validatePassword();
    if (!emailIsValid || !passwordIsValid) {
      (emailIsValid ? password : email).focus();
      return;
    }

    submit.disabled = true;
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    const submitLabel = submit.querySelector<HTMLElement>('.auth-submit-label');
    if (submitLabel) submitLabel.textContent = 'Entrando...';

    window.setTimeout(() => {
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submit.removeAttribute('aria-busy');
      if (submitLabel) submitLabel.textContent = 'Entrar';
      status.dataset.kind = 'info';
      status.textContent = 'Visual do login pronto. A autenticação será conectada ao Firebase na próxima etapa.';
    }, 850);
  });
}
