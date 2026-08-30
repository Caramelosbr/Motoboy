/**
 * Toast compartilhado (Etapa 1D-A).
 *
 * Notificação leve no visual do app, para substituir os diálogos nativos do
 * navegador (sucesso, informação, aviso e erro NÃO bloqueante).
 *
 * Regras: sem bibliotecas externas, sem propriedades em window, sem innerHTML
 * (apenas textContent), sem regras de negócio. Funciona chamado por main.ts ou
 * pelo módulo legado (é um módulo ES importável).
 */

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** Duração em ms; 0 mantém aberto até fechar manualmente. Padrão por tipo. */
  durationMs?: number;
}

/** Duração padrão por tipo (erro fica mais tempo; aviso um pouco mais). */
const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

/** Máximo de toasts simultâneos (evita empilhamento excessivo). */
const MAX_TOASTS = 4;

interface ActiveToast {
  el: HTMLElement;
  message: string;
  kind: ToastKind;
  timer: number | null;
  remainingMs: number;
  startedAt: number;
  cleanup: () => void;
}

let container: HTMLElement | null = null;
const active: ActiveToast[] = [];

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  const el = document.createElement('div');
  el.className = 'mb-toast-container';
  document.body.appendChild(el);
  container = el;
  return el;
}

function removeContainerIfEmpty(): void {
  if (container && active.length === 0) {
    container.remove();
    container = null;
  }
}

function dismiss(toast: ActiveToast): void {
  const index = active.indexOf(toast);
  if (index === -1) return;
  active.splice(index, 1);
  toast.cleanup();
  toast.el.remove();
  removeContainerIfEmpty();
}

export function showToast(message: string, options: ToastOptions = {}): void {
  const text = String(message ?? '');
  if (!text) return;

  const kind: ToastKind = options.kind ?? 'info';
  const duration = options.durationMs ?? DEFAULT_DURATION[kind];

  // Evita duplicata consecutiva (mesma mensagem e tipo do toast mais recente).
  const last = active[active.length - 1];
  if (last && last.message === text && last.kind === kind) return;

  const root = ensureContainer();

  // Limita o empilhamento: remove o(s) mais antigo(s).
  while (active.length >= MAX_TOASTS) {
    dismiss(active[0]);
  }

  const isAlert = kind === 'warning' || kind === 'error';

  const el = document.createElement('div');
  el.className = `mb-toast mb-toast--${kind}`;
  el.setAttribute('role', isAlert ? 'alert' : 'status');
  el.setAttribute('aria-live', isAlert ? 'assertive' : 'polite');

  const msg = document.createElement('span');
  msg.className = 'mb-toast__msg';
  msg.textContent = text; // nunca innerHTML

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mb-toast__close';
  closeBtn.setAttribute('aria-label', 'Fechar notificação');
  closeBtn.textContent = '×'; // "×" via texto, sem markup

  el.appendChild(msg);
  el.appendChild(closeBtn);
  root.appendChild(el);

  const toast: ActiveToast = {
    el,
    message: text,
    kind,
    timer: null,
    remainingMs: duration,
    startedAt: 0,
    cleanup: () => {},
  };

  const startTimer = (): void => {
    if (duration <= 0 || toast.remainingMs <= 0) return; // 0 = persistente
    toast.startedAt = Date.now();
    toast.timer = window.setTimeout(() => dismiss(toast), toast.remainingMs);
  };
  const pauseTimer = (): void => {
    if (toast.timer !== null) {
      window.clearTimeout(toast.timer);
      toast.timer = null;
      toast.remainingMs -= Date.now() - toast.startedAt;
    }
  };

  const onClose = (): void => dismiss(toast);
  const onEnter = (): void => pauseTimer();
  const onLeave = (): void => startTimer();
  const onFocusIn = (): void => pauseTimer();
  const onFocusOut = (): void => startTimer();

  closeBtn.addEventListener('click', onClose);
  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mouseleave', onLeave);
  el.addEventListener('focusin', onFocusIn);
  el.addEventListener('focusout', onFocusOut);

  toast.cleanup = (): void => {
    if (toast.timer !== null) {
      window.clearTimeout(toast.timer);
      toast.timer = null;
    }
    closeBtn.removeEventListener('click', onClose);
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    el.removeEventListener('focusin', onFocusIn);
    el.removeEventListener('focusout', onFocusOut);
  };

  active.push(toast);
  startTimer();
}
