import { toast } from 'sonner';

/**
 * Toast notification utilities
 * Provides consistent toast messages for success/error feedback.
 * 
 * Requirements: 25.2, 25.3
 */

export interface ToastOptions {
  description?: string;
  duration?: number;
}

/**
 * Shows a success toast notification
 * Requirements: 25.3
 */
export function showSuccess(message: string, options?: ToastOptions): void {
  toast.success(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
  });
}

/**
 * Shows an error toast notification
 * Requirements: 25.2
 */
export function showError(message: string, options?: ToastOptions): void {
  toast.error(message, {
    description: options?.description,
    duration: options?.duration ?? 5000,
  });
}

/**
 * Shows an info toast notification
 */
export function showInfo(message: string, options?: ToastOptions): void {
  toast.info(message, {
    description: options?.description,
    duration: options?.duration ?? 3000,
  });
}

/**
 * Shows a warning toast notification
 */
export function showWarning(message: string, options?: ToastOptions): void {
  toast.warning(message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Shows a loading toast that can be updated
 * Returns a function to dismiss the toast
 */
export function showLoading(message: string): string | number {
  return toast.loading(message);
}

/**
 * Dismisses a specific toast by ID
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Shows a promise-based toast that updates based on promise state
 * Requirements: 25.2, 25.3
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
): Promise<T> {
  return toast.promise(promise, messages);
}

// Re-export toast for direct access if needed
export { toast };
