export const FILE_PICKER_CANCEL_MESSAGE = '用户取消选择';

const getSelectedFiles = (input) => Array.from(input.files || []);

const applyDirectoryMode = (input) => {
    input.webkitdirectory = true;
    input.directory = true;
};

export const openFileInput = ({ accept = '*', multiple = false, directory = false } = {}) => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.style.display = 'none';

        if (directory) {
            applyDirectoryMode(input);
        }

        let settled = false;
        let focusTimer = null;
        let readyForFocusFallback = false;

        const cleanup = () => {
            window.removeEventListener('focus', handleWindowFocus, true);
            input.removeEventListener('change', handleChange);
            input.removeEventListener('cancel', handleCancel);
            input.removeEventListener('error', handleError);
            if (focusTimer !== null) {
                window.clearTimeout(focusTimer);
            }
            if (typeof input.remove === 'function') {
                input.remove();
            }
        };

        const settle = (callback, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback(value);
        };

        const rejectCancelled = () => {
            settle(reject, new Error(FILE_PICKER_CANCEL_MESSAGE));
        };

        const resolveSelection = (files) => {
            settle(resolve, multiple || directory ? files : files[0]);
        };

        function handleChange() {
            const files = getSelectedFiles(input);
            if (files.length > 0) {
                resolveSelection(files);
            } else {
                rejectCancelled();
            }
        }

        function handleCancel() {
            rejectCancelled();
        }

        function handleError(error) {
            const message = error?.message || '未知错误';
            settle(reject, new Error(`文件选择错误: ${message}`));
        }

        function handleWindowFocus() {
            if (!readyForFocusFallback) return;
            if (focusTimer !== null) {
                window.clearTimeout(focusTimer);
            }
            focusTimer = window.setTimeout(() => {
                if (settled) return;
                const files = getSelectedFiles(input);
                if (files.length > 0) {
                    resolveSelection(files);
                } else {
                    rejectCancelled();
                }
            }, 300);
        }

        input.addEventListener('change', handleChange);
        input.addEventListener('cancel', handleCancel);
        input.addEventListener('error', handleError);
        window.addEventListener('focus', handleWindowFocus, true);
        document.body.appendChild(input);
        window.setTimeout(() => {
            readyForFocusFallback = true;
        }, 0);
        input.click();
    });
};
