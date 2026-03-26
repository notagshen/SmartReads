import React from 'react';
import styles from './FileInput.module.css';
import { FaFolderOpen, FaFile, FaCheck } from 'react-icons/fa';

const FileInput = ({ 
    label, 
    placeholder, 
    value = '', 
    onBrowse, 
    accept = '*',
    readOnly = true,
    icon,
    buttonText = '浏览',
    multiple = false,
    showFileInfo = false,
    disabled = false 
}) => {
    const handleBrowseClick = () => {
        if (onBrowse && !disabled) {
            onBrowse();
        }
    };

    const getFileIcon = () => {
        if (value) {
            return <FaCheck className={styles.fileSelectedIcon} />;
        }
        return icon || <FaFolderOpen />;
    };

    const getFileName = () => {
        if (!value) return placeholder;
        
        // 如果是File对象
        if (value instanceof File) {
            return value.name;
        }
        
        // 如果是路径字符串，提取文件名
        if (typeof value === 'string') {
            return value.split(/[/\\]/).pop() || value;
        }
        
        return value.toString();
    };

    const getFileSize = () => {
        if (value instanceof File) {
            const size = value.size;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
        return null;
    };

    return (
        <div className={styles.formGroup}>
            <label className={styles.label}>{label}</label>
            <div className={`${styles.fileInputGroup} ${disabled ? styles.disabled : ''}`}>
                <div className={styles.inputContainer}>
                    <input 
                        type="text" 
                        className={`${styles.formInput} ${value ? styles.hasFile : ''}`}
                        placeholder={placeholder}
                        value={getFileName()}
                        readOnly={readOnly}
                        disabled={disabled}
                    />
                    {showFileInfo && value instanceof File && (
                        <div className={styles.fileInfo}>
                            <span className={styles.fileSize}>{getFileSize()}</span>
                            <span className={styles.fileType}>{value.type || '未知类型'}</span>
                        </div>
                    )}
                </div>
                <button 
                    className={`${styles.browseButton} ${value ? styles.success : ''}`}
                    onClick={handleBrowseClick}
                    disabled={disabled}
                    type="button"
                >
                    {getFileIcon()}
                    <span>{value ? '已选择' : buttonText}</span>
                </button>
            </div>
            {multiple && value && Array.isArray(value) && (
                <div className={styles.multipleFilesInfo}>
                    <small>已选择 {value.length} 个文件</small>
                </div>
            )}
        </div>
    );
};

export default FileInput; 