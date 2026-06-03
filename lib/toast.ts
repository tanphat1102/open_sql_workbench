export type ToastVariant = "default" | "destructive" | "success";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

export type ToastItem = ToastInput & {
  id: string;
};

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();

export function toast(input: ToastInput) {
  const item: ToastItem = {
    ...input,
    id: crypto.randomUUID(),
    variant: input.variant ?? "default",
  };

  listeners.forEach((listener) => listener(item));
}

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
