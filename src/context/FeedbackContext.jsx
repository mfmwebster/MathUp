import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FeedbackContext = createContext(null);

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const notify = useCallback((message, type = 'info', duration = 2600) => {
    if (!message) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const confirmAction = useCallback((options = {}) => {
    const {
      title = 'Onay',
      message = '',
      confirmText = 'Onayla',
      cancelText = 'İptal',
      danger = false
    } = options;

    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        danger,
        resolve
      });
    });
  }, []);

  const promptValue = useCallback((options = {}) => {
    const {
      title = 'Bilgi Girin',
      message = '',
      defaultValue = '',
      placeholder = '',
      confirmText = 'Kaydet',
      cancelText = 'İptal',
      danger = false
    } = options;

    return new Promise((resolve) => {
      setDialog({
        type: 'prompt',
        title,
        message,
        inputValue: String(defaultValue ?? ''),
        placeholder,
        confirmText,
        cancelText,
        danger,
        resolve
      });
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog((current) => {
      if (!current) return null;
      current.resolve(current.type === 'confirm' ? false : null);
      return null;
    });
  }, []);

  const confirmDialog = useCallback(() => {
    setDialog((current) => {
      if (!current) return null;
      if (current.type === 'confirm') {
        current.resolve(true);
      } else {
        current.resolve(current.inputValue);
      }
      return null;
    });
  }, []);

  const updatePromptInput = useCallback((value) => {
    setDialog((current) => {
      if (!current || current.type !== 'prompt') return current;
      return {
        ...current,
        inputValue: value
      };
    });
  }, []);

  const value = useMemo(() => ({
    notify,
    confirmAction,
    promptValue
  }), [notify, confirmAction, promptValue]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="fixed top-3 right-3 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              'pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg border ' +
              (toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : toast.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : toast.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-700')
            }
          >
            {toast.message}
          </div>
        ))}
      </div>

      {dialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={closeDialog} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div className="bg-white rounded-2xl p-5 w-full max-w-md pointer-events-auto">
              <h3 className="text-lg font-semibold text-gray-900">{dialog.title}</h3>
              {dialog.message ? <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{dialog.message}</p> : null}

              {dialog.type === 'prompt' && (
                <input
                  autoFocus
                  value={dialog.inputValue}
                  onChange={(e) => updatePromptInput(e.target.value)}
                  className="input-field mt-3"
                  placeholder={dialog.placeholder}
                />
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={closeDialog} className="flex-1 btn-secondary py-2">{dialog.cancelText}</button>
                <button
                  onClick={confirmDialog}
                  className={'flex-1 py-2 rounded-xl font-medium ' + (dialog.danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary')}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
};
