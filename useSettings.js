import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';

// 设置schema定义
const SETTINGS_SCHEMA = {
    version: '1.0.0',
    fields: {
        apiKey: { type: 'string', required: false, maxLength: 200 },
        baseUrl: { type: 'string', required: true, pattern: /^https?:\/\/.+/ },
        model: { type: 'string', required: true, minLength: 1 },
        temperature: { type: 'number', required: true, min: 0, max: 1 },
        maxTokens: { type: 'number', required: true, min: 100, max: 32000 }
    }
};

// 默认设置
const DEFAULT_SETTINGS = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 4000
};

/**
 * 高级设置管理Hook
 * 包含验证、持久化、备份、版本控制等功能
 */
export const useSettings = () => {
    const { addNotification } = useNotification();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState(null);

    // 验证单个字段
    const validateField = useCallback((key, value) => {
        const schema = SETTINGS_SCHEMA.fields[key];
        if (!schema) return { valid: false, error: '未知字段' };

        // 必填检查
        if (schema.required && (value === null || value === undefined || value === '')) {
            return { valid: false, error: '该字段为必填项' };
        }

        // 类型检查
        if (value !== null && value !== undefined && value !== '') {
            if (schema.type === 'string' && typeof value !== 'string') {
                return { valid: false, error: '必须是字符串类型' };
            }
            if (schema.type === 'number' && typeof value !== 'number') {
                return { valid: false, error: '必须是数字类型' };
            }
        }

        // 字符串验证
        if (schema.type === 'string' && value) {
            if (schema.minLength && value.length < schema.minLength) {
                return { valid: false, error: `最少需要${schema.minLength}个字符` };
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                return { valid: false, error: `最多允许${schema.maxLength}个字符` };
            }
            if (schema.pattern && !schema.pattern.test(value)) {
                return { valid: false, error: '格式不正确' };
            }
        }

        // 数字验证
        if (schema.type === 'number' && typeof value === 'number') {
            if (schema.min !== undefined && value < schema.min) {
                return { valid: false, error: `不能小于${schema.min}` };
            }
            if (schema.max !== undefined && value > schema.max) {
                return { valid: false, error: `不能大于${schema.max}` };
            }
        }

        return { valid: true };
    }, []);

    // 验证整个设置对象
    const validateSettings = useCallback((settingsToValidate) => {
        const errors = {};
        let isValid = true;

        Object.keys(SETTINGS_SCHEMA.fields).forEach(key => {
            const validation = validateField(key, settingsToValidate[key]);
            if (!validation.valid) {
                errors[key] = validation.error;
                isValid = false;
            }
        });

        return { isValid, errors };
    }, [validateField]);

    // 从localStorage加载设置
    const loadSettings = useCallback(async () => {
        try {
            setIsLoading(true);
            
            const saved = localStorage.getItem('smartreads-settings');
            if (saved) {
                const parsedSettings = JSON.parse(saved);
                
                // 版本兼容性检查
                if (parsedSettings.version && parsedSettings.version !== SETTINGS_SCHEMA.version) {
                    addNotification('检测到设置版本不匹配，正在迁移...', 'info');
                    // 这里可以添加版本迁移逻辑
                }

                // 合并默认设置和保存的设置
                const mergedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
                
                // 验证加载的设置
                const validation = validateSettings(mergedSettings);
                if (validation.isValid) {
                    setSettings(mergedSettings);
                    setLastSaved(new Date());
                } else {
                    addNotification('设置数据无效，已重置为默认值', 'warning');
                    setSettings(DEFAULT_SETTINGS);
                }
            } else {
                setSettings(DEFAULT_SETTINGS);
            }
        } catch (error) {
            addNotification('加载设置失败: ' + error.message, 'error');
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setIsLoading(false);
        }
    }, [addNotification, validateSettings]);

    // 保存设置到localStorage
    const saveSettings = useCallback(async (settingsToSave = settings) => {
        try {
            // 验证设置
            const validation = validateSettings(settingsToSave);
            if (!validation.isValid) {
                const errorMessages = Object.values(validation.errors).join(', ');
                addNotification('设置验证失败: ' + errorMessages, 'error');
                return { success: false, errors: validation.errors };
            }

            // 添加版本信息和时间戳
            const settingsWithMeta = {
                ...settingsToSave,
                version: SETTINGS_SCHEMA.version,
                lastModified: new Date().toISOString()
            };

            localStorage.setItem('smartreads-settings', JSON.stringify(settingsWithMeta));
            setSettings(settingsToSave);
            setLastSaved(new Date());
            
            addNotification('设置保存成功', 'success');
            return { success: true };
            
        } catch (error) {
            addNotification('保存设置失败: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [settings, validateSettings, addNotification]);

    // 更新单个设置
    const updateSetting = useCallback((key, value) => {
        const validation = validateField(key, value);
        
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));

        // 如果验证失败，延迟显示错误（不立即阻止用户输入）
        if (!validation.valid) {
            setTimeout(() => {
                addNotification(`${key}: ${validation.error}`, 'warning');
            }, 1000);
        }

        return validation;
    }, [validateField, addNotification]);

    // 重置设置
    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
        addNotification('设置已重置为默认值', 'info');
    }, [addNotification]);

    // 导出设置
    const exportSettings = useCallback(() => {
        try {
            const settingsToExport = {
                ...settings,
                version: SETTINGS_SCHEMA.version,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(settingsToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `smartreads-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addNotification('设置导出成功', 'success');
            return true;
        } catch (error) {
            addNotification('导出设置失败: ' + error.message, 'error');
            return false;
        }
    }, [settings, addNotification]);

    // 导入设置
    const importSettings = useCallback(async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.style.display = 'none';
            
            return new Promise((resolve, reject) => {
                input.onchange = async (e) => {
                    try {
                        const file = e.target.files[0];
                        if (!file) {
                            reject(new Error('未选择文件'));
                            return;
                        }

                        const text = await file.text();
                        const importedSettings = JSON.parse(text);
                        
                        // 验证导入的设置
                        const validation = validateSettings(importedSettings);
                        if (!validation.isValid) {
                            const errorMessages = Object.values(validation.errors).join(', ');
                            reject(new Error('导入的设置无效: ' + errorMessages));
                            return;
                        }

                        // 保存导入的设置
                        const result = await saveSettings(importedSettings);
                        if (result.success) {
                            addNotification('设置导入成功', 'success');
                            resolve(true);
                        } else {
                            reject(new Error('保存导入设置失败'));
                        }
                    } catch (error) {
                        reject(error);
                    } finally {
                        document.body.removeChild(input);
                    }
                };
                
                input.oncancel = () => {
                    reject(new Error('用户取消导入'));
                    document.body.removeChild(input);
                };
                
                document.body.appendChild(input);
                input.click();
            });
            
        } catch (error) {
            addNotification('导入设置失败: ' + error.message, 'error');
            return false;
        }
    }, [saveSettings, validateSettings, addNotification]);

    // 获取设置状态信息
    const getSettingsInfo = useCallback(() => {
        const validation = validateSettings(settings);
        return {
            isValid: validation.isValid,
            errors: validation.errors,
            lastSaved,
            hasChanges: JSON.stringify(settings) !== localStorage.getItem('smartreads-settings')
        };
    }, [settings, validateSettings, lastSaved]);

    // 初始化加载设置
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    return {
        settings,
        isLoading,
        lastSaved,
        updateSetting,
        saveSettings,
        resetSettings,
        exportSettings,
        importSettings,
        validateField,
        validateSettings,
        getSettingsInfo,
        loadSettings
    };
}; 
