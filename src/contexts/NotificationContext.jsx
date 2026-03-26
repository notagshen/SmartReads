import React, { createContext, useState, useContext, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = (message, type = 'info', durationMs = 2500) => {
        // 仅保留成功与失败提示，其余类型直接忽略
        if (type !== 'success' && type !== 'error') {
            return;
        }

        const id = uuidv4();
        setNotifications(current => [...current, { id, message, type }]);
        setTimeout(() => {
            removeNotification(id);
        }, durationMs);
    };

    const removeNotification = (id) => {
        setNotifications(current => current.filter(n => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}
            <div className="notification-container">
                {notifications.map(n => (
                    <Notification key={n.id} {...n} onClose={() => removeNotification(n.id)} />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

const Notification = ({ message, type, onClose }) => {
    return (
        <div className={`notification notification-${type}`}>
            {message}
            <button onClick={onClose}>&times;</button>
        </div>
    );
}; 