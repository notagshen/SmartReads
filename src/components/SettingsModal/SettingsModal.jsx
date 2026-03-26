import React, { useState } from 'react';
import styles from './SettingsModal.module.css';
import { useAppContext } from '../../contexts/AppContext';
import { useNotification } from '../../contexts/NotificationContext';
import { FaCog, FaTimes, FaSave } from 'react-icons/fa';
import Button from '../common/Button/Button';
import ApiSettings from './ApiSettings';
import UiSettings from './UiSettings';
import { buildApiUrl, normalizeApiBaseUrl, PROXY_API_BASE_URL } from '../../utils/apiBaseUrl';

const SettingsModal = () => {
  const { isSettingsModalOpen, closeSettingsModal, saveSettings, settings, setApiConnectionStatus } = useAppContext();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('api');

  if (!isSettingsModalOpen) {
    return null;
  }

  const handleSave = async () => {
    // 保存设置
    saveSettings();
    addNotification('设置已保存!', 'success');
    
    // 如果有API密钥，自动测试连接
    if (settings.apiKey && settings.baseUrl) {
      try {
        const response = await fetch(buildApiUrl(PROXY_API_BASE_URL, '/models'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'X-Upstream-Base-Url': normalizeApiBaseUrl(settings.baseUrl)
          }
        });
        
        const isConnected = response.ok;
        const message = isConnected ? 'API连接成功' : `连接失败: ${response.status}`;
        
        setApiConnectionStatus({
          isConnected,
          lastTested: new Date().toISOString(),
          message
        });
        
        if (isConnected) {
          addNotification('API连接测试成功!', 'success');
        }
      } catch (error) {
        setApiConnectionStatus({
          isConnected: false,
          lastTested: new Date().toISOString(),
          message: `连接失败: ${error.message}`
        });
      }
    } else {
      // 没有配置API信息，设置为未连接
      setApiConnectionStatus({
        isConnected: false,
        lastTested: null,
        message: '请配置API密钥和URL'
      });
    }
  };

  return (
    <div className={`${styles.modalOverlay} ${isSettingsModalOpen ? styles.active : ''}`} onClick={closeSettingsModal}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3><FaCog /> 设置</h3>
          <button onClick={closeSettingsModal} className={styles.modalClose}><FaTimes /></button>
        </div>
        
        <div className={styles.modalContent}>
          <div className={styles.settingsTabs}>
            <button 
              className={`${styles.settingsTab} ${activeTab === 'api' ? styles.active : ''}`}
              onClick={() => setActiveTab('api')}
            >
              API设置
            </button>
            <button 
              className={`${styles.settingsTab} ${activeTab === 'ui' ? styles.active : ''}`}
              onClick={() => setActiveTab('ui')}
            >
              界面设置
            </button>
          </div>

          {activeTab === 'api' && <ApiSettings />}
          {activeTab === 'ui' && <UiSettings />}
        </div>

        <div className={styles.modalFooter}>
          <Button label="取消" onClick={closeSettingsModal} variant="secondary" />
          <Button label="保存设置" icon={<FaSave />} onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 
