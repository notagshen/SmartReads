import React, { useState } from 'react';
import styles from './ApiSettings.module.css';
import { useAppContext } from '../../contexts/AppContext';
import { useAnalyzer } from '../../hooks/useAnalyzer';
import { useOptimizedNotifications } from '../../hooks/useOptimizedNotifications';
import {
    sanitizeMaxTokens,
    sanitizeTemperature,
    sanitizeTruncationThreshold
} from '../../utils/settingsValidation';

const ApiSettings = () => {
    const { settings, updateSettings, clearClientCache, setApiConnectionStatus } = useAppContext();
    const { testAPIConnection } = useAnalyzer();
    const { notifySuccess, notifyError } = useOptimizedNotifications();

    const [apiKeyVisible, setApiKeyVisible] = useState(false);

    const handleChange = (field, value) => {
        let processedValue = value;
        if (field === 'temperature') {
            processedValue = sanitizeTemperature(value, 0.7);
        } else if (field === 'maxTokens') {
            processedValue = sanitizeMaxTokens(value, 4000);
        } else if (field === 'truncationThresholdChars') {
            processedValue = sanitizeTruncationThreshold(value, 120000);
        }
        updateSettings({ [field]: processedValue });
    };

    const handleApiTest = async () => {
        try {
            const result = await testAPIConnection({
                apiKey: settings.apiKey,
                baseUrl: settings.baseUrl
            });
            
            // 更新连接状态
            setApiConnectionStatus({
                isConnected: result.success,
                lastTested: new Date().toISOString(),
                message: result.message
            });
            
            if (result.success) notifySuccess('API测试', result.message);
            else notifyError('API测试', result.message);
        } catch (error) {
            // 更新连接状态为失败
            setApiConnectionStatus({
                isConnected: false,
                lastTested: new Date().toISOString(),
                message: error.message
            });
            notifyError('API测试', error.message);
        }
    };

    const handleClearCache = () => {
        clearClientCache();
        notifySuccess('缓存', '已清除本地缓存');
    };

    return (
        <div className={styles.container}>
            <div className={styles.form}>
                <div className={styles.formGroup}>
                    <label htmlFor="apiKey">API密钥:</label>
                    <div className={styles.inputWithIcon}>
                        <input
                            id="apiKey"
                            type={apiKeyVisible ? 'text' : 'password'}
                            className={styles.formInput}
                            placeholder="输入API密钥..."
                            value={settings.apiKey || ''}
                            onChange={(e) => handleChange('apiKey', e.target.value)}
                        />
                        <button
                            type="button"
                            className={styles.eyeBtn}
                            onClick={() => setApiKeyVisible(v => !v)}
                            title={apiKeyVisible ? '隐藏' : '显示'}
                        >
                            {apiKeyVisible ? '🙈' : '👁️'}
                        </button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="baseUrl">API基础URL:</label>
                    <input
                        id="baseUrl"
                        type="text"
                        className={styles.formInput}
                        placeholder="输入你的上游API基础URL，如：https://axonhub.example.com/v1"
                        value={settings.baseUrl || ''}
                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                    />
                    <div className={styles.formHelp}>
                        <small>每个用户可填自己的上游URL；前端会通过本项目后端同源中转，避免浏览器跨域</small>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="model">模型:</label>
                    <input
                        id="model"
                        type="text"
                        className={styles.formInput}
                        placeholder="输入模型名称，如：gemini-2.5-pro, gpt-4等"
                        value={settings.model || ''}
                        onChange={(e) => handleChange('model', e.target.value)}
                    />
                    <div className={styles.formHelp}>
                        <small>常用模型：gemini-2.5-pro</small>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="temperature">
                        温度: <span className={styles.tempValue}>{(settings.temperature ?? 0.7).toFixed(1)}</span>
                    </label>
                    <div className={styles.temperatureContainer}>
                        <input
                            id="temperature"
                            type="range"
                            className={styles.formRange}
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.temperature ?? 0.7}
                            onChange={(e) => handleChange('temperature', e.target.value)}
                        />
                        <div className={styles.temperatureLabels}>
                            <span className={styles.tempLabelLeft}>精确 (0)</span>
                            <span className={styles.tempLabelRight}>创造性 (1)</span>
                        </div>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="maxTokens">最大令牌数:</label>
                    <input
                        id="maxTokens"
                        type="number"
                        className={styles.formInput}
                        placeholder="输入最大令牌数"
                        value={settings.maxTokens ?? 4000}
                        onChange={(e) => handleChange('maxTokens', e.target.value)}
                    />
                    <div className={styles.formHelp}>
                        <small>建议范围：1000-16000，根据模型选择合适的值</small>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="truncationThresholdChars">章节均衡截断阈值(字符):</label>
                    <input
                        id="truncationThresholdChars"
                        type="number"
                        className={styles.formInput}
                        placeholder="超过该长度才截断"
                        value={settings.truncationThresholdChars ?? 120000}
                        onChange={(e) => handleChange('truncationThresholdChars', e.target.value)}
                    />
                    <div className={styles.formHelp}>
                        <small>默认120000；仅当正文长度超过阈值时才触发章节均衡截断</small>
                    </div>
                </div>

                <div className={styles.apiTestSection}>
                    <button type="button" className={`${styles.formInput} ${styles.testButton}`} onClick={handleApiTest}>
                        <i className="fas fa-wifi"></i>
                        测试API连接
                    </button>
                    <button type="button" className={`${styles.formInput} ${styles.actionButton}`} onClick={handleClearCache}>
                        <i className="fas fa-broom"></i>
                        清除缓存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiSettings; 
