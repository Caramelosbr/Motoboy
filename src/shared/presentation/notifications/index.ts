/**
 * API pública das notificações compartilhadas (Etapa 1D-A).
 * Importa o CSS e re-exporta somente a superfície pública.
 */

import './notifications.css';

export { showToast } from './toast';
export type { ToastKind, ToastOptions } from './toast';
