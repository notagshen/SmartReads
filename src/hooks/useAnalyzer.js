import { useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { buildApiUrl, normalizeApiBaseUrl, PROXY_API_BASE_URL } from '../utils/apiBaseUrl';

export const useAnalyzer = () => {
    const { settings } = useAppContext();

    const testAPIConnection = useCallback(async (overrides = {}) => {
        try {
            const apiKey = overrides.apiKey ?? settings.apiKey;
            const baseUrl = overrides.baseUrl ?? settings.baseUrl;
            if (!apiKey) throw new Error('请先配置API密钥');

            const response = await fetch(buildApiUrl(PROXY_API_BASE_URL, '/models'), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-Upstream-Base-Url': normalizeApiBaseUrl(baseUrl)
                }
            });

            if (response.ok) {
                return { success: true, message: 'API连接成功' };
            }

            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                message: `连接失败: ${response.status} ${errorData.error?.message || response.statusText}`
            };
        } catch (error) {
            return { success: false, message: `连接失败: ${error.message}` };
        }
    }, [settings]);

    return { testAPIConnection };
};
