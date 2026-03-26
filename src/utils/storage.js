// 轻量持久化工具（localStorage），带命名空间与版本
const DEFAULT_NAMESPACE = 'smartreads';

function nsKey(namespace, key, version) {
    return `${namespace || DEFAULT_NAMESPACE}:${version || 'v1'}:${key}`;
}

export function saveJSON(key, value, { namespace, version } = {}) {
    try {
        const fullKey = nsKey(namespace, key, version);
        const payload = JSON.stringify(value);
        localStorage.setItem(fullKey, payload);
        return true;
    } catch (e) {
        console.warn('storage.saveJSON error:', e);
        return false;
    }
}

export function loadJSON(key, defaultValue = null, { namespace, version } = {}) {
    try {
        const fullKey = nsKey(namespace, key, version);
        const raw = localStorage.getItem(fullKey);
        if (raw == null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('storage.loadJSON error:', e);
        return defaultValue;
    }
}

export function removeKey(key, { namespace, version } = {}) {
    try {
        const fullKey = nsKey(namespace, key, version);
        localStorage.removeItem(fullKey);
    } catch (e) {
        console.warn('storage.removeKey error:', e);
    }
}

export function clearNamespace(namespace = DEFAULT_NAMESPACE) {
    try {
        const prefix = `${namespace}:`;
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith(prefix)) localStorage.removeItem(k);
        });
    } catch (e) {
        console.warn('storage.clearNamespace error:', e);
    }
} 