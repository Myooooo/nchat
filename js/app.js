document.addEventListener('DOMContentLoaded', () => {
    const getEl = id => document.getElementById(id);
    const appTitle = getEl('app-title');
    const titleWrapper = getEl('title-wrapper');
    const settingsPanel = getEl('settings-panel'), toggleSettingsBtn = getEl('toggle-settings-btn');
    // Settings Inputs
    const configSelect = getEl('config-select');
    const addConfigBtn = getEl('add-config-btn');
    const delConfigBtn = getEl('delete-config-btn');
    const configNameInput = getEl('config-name');
    const systemPromptInput = getEl('system-prompt'), apiUrlInput = getEl('api-url'), apiKeyInput = getEl('api-key'), modelIdInput = getEl('model-id');
    const saveSettingsBtn = getEl('save-settings-btn'), saveStatus = getEl('save-status');
    // Advanced Settings Inputs
    const advancedToggleBtn = getEl('advanced-toggle-btn');
    const advancedSettingsContainer = getEl('advanced-settings-container');
    const tempSlider = getEl('temp-slider'), tempInput = getEl('temp-input');
    const toppSlider = getEl('topp-slider'), toppInput = getEl('topp-input');
    const clearChatBtn = getEl('clear-chat-btn'), chatContainer = getEl('chat-container');
    const userInput = getEl('user-input'), sendBtn = getEl('send-btn');
    const uploadBtn = getEl('upload-btn'), imageInput = getEl('image-input'), imagePreviewContainer = getEl('image-preview-container');
    const imageLightbox = getEl('image-lightbox'), lightboxImg = getEl('lightbox-img'), lightboxClose = getEl('lightbox-close');
    const menuBtn = getEl('menu-btn');
    const dropdownMenu = getEl('main-menu');
    const configDropdownMenu = getEl('config-dropdown-menu');
    const exportSettingsBtn = getEl('export-settings-btn');
    const exportConversationBtn = getEl('export-conversation-btn');
    const backupConversationBtn = getEl('backup-conversation-btn');
    const restoreConversationBtn = getEl('restore-conversation-btn');
    const importSettingsBtn = getEl('import-settings-btn');
    const importSettingsInput = getEl('import-settings-input');
    const restoreConversationInput = document.createElement('input');
    restoreConversationInput.type = 'file';
    restoreConversationInput.hidden = true;
    restoreConversationInput.accept = '.json';
    document.body.appendChild(restoreConversationInput);
    const customPromptOverlay = getEl('custom-prompt-overlay');
    const customPromptTitle = getEl('custom-prompt-title');
    const customPromptMessage = getEl('custom-prompt-message');
    const customPromptConfirm = getEl('custom-prompt-confirm');
    const customPromptCancel = getEl('custom-prompt-cancel');
    const editModalOverlay = getEl('edit-modal-overlay');
    const editModalTextarea = getEl('edit-modal-textarea');
    const editModalSave = getEl('edit-modal-save');
    const editModalCancel = getEl('edit-modal-cancel');
    const inputAreaContainer = getEl('input-area-container');
    const themeToggleBtn = getEl('theme-toggle-btn');

    let conversationHistory = [];
    let configList = [];
    let currentConfigId = null;
    let currentSettings = {};
    let stagedImages = [];
    let isAssistantResponding = false;
    let currentEditingMessageId = null;
    let abortController = null; // For aborting requests
    const MAX_IMAGES = 5;
    const generateId = () => Math.random().toString(36).substr(2, 9);
    const CONVERSATION_STORAGE_KEY = 'nchat-conversation';

    // --- Theme Management ---
    const initTheme = () => {
        const storedTheme = localStorage.getItem('nchat-theme');
        if (storedTheme) {
            document.documentElement.setAttribute('data-theme', storedTheme);
            updateThemeBtnText(storedTheme);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const defaultTheme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', defaultTheme);
            updateThemeBtnText(defaultTheme);
        }
    };

    const toggleTheme = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('nchat-theme', newTheme);
        updateThemeBtnText(newTheme);
        dropdownMenu.classList.remove('show');
    };

    const updateThemeBtnText = (theme) => {
        themeToggleBtn.textContent = theme === 'light' ? '深色模式' : '浅色模式';
    };

    themeToggleBtn.addEventListener('click', toggleTheme);
    initTheme();

    // --- Helper Functions ---
    const syncInputs = (range, number) => {
        range.addEventListener('input', () => number.value = range.value);
        number.addEventListener('input', () => range.value = number.value);
    };
    syncInputs(tempSlider, tempInput);
    syncInputs(toppSlider, toppInput);

    advancedToggleBtn.addEventListener('click', () => {
        const isExpanded = advancedSettingsContainer.classList.toggle('show');
        advancedToggleBtn.classList.toggle('expanded', isExpanded);
        currentSettings.enableAdvanced = isExpanded;
        if (isExpanded) {
            currentSettings.temperature = parseFloat(tempInput.value);
            currentSettings.top_p = parseFloat(toppInput.value);
        }
    });

    const copyTextToClipboard = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            return new Promise((resolve, reject) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.top = "-9999px";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) resolve(); else reject(new Error('Fallback: Unable to copy'));
                } catch (err) { reject(err); } finally { document.body.removeChild(textArea); }
            });
        }
    };

    const adjustChatPadding = () => {
        const inputAreaHeight = inputAreaContainer.offsetHeight;
        chatContainer.style.paddingBottom = `${inputAreaHeight + 10}px`;
    };
    try {
        const resizeObserver = new ResizeObserver(adjustChatPadding);
        resizeObserver.observe(inputAreaContainer);
    } catch (error) { console.warn("ResizeObserver not supported."); }
    adjustChatPadding();

    const showCustomPrompt = (title, message, options = {}) => {
        return new Promise(resolve => {
            customPromptTitle.textContent = title;
            customPromptMessage.innerHTML = message;
            const { isConfirm = false, confirmText = '确认', cancelText = '取消', isDestructive = false } = options;
            customPromptConfirm.textContent = confirmText;
            customPromptCancel.textContent = cancelText;
            customPromptCancel.style.display = isConfirm ? 'block' : 'none';
            customPromptConfirm.classList.toggle('btn-destructive', isDestructive);
            customPromptConfirm.classList.toggle('btn-primary', !isDestructive);
            customPromptOverlay.classList.add('show');
            const closePrompt = (value) => {
                customPromptOverlay.classList.remove('show');
                resolve(value);
            };
            customPromptConfirm.onclick = () => closePrompt(true);
            customPromptCancel.onclick = () => closePrompt(false);
            customPromptOverlay.onclick = (e) => { if (e.target === customPromptOverlay) closePrompt(false); };
        });
    };

    // --- Config Management ---
    const createDefaultConfig = () => ({
        id: generateId(),
        name: '默认配置',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelId: 'gpt-4o',
        systemPrompt: '',
        enableAdvanced: false,
        temperature: 1.0,
        top_p: 0.95
    });

    const renderConfigSelect = () => {
        configSelect.innerHTML = '';
        configList.forEach(config => {
            const option = document.createElement('option');
            option.value = config.id;
            option.textContent = config.name || '(未命名配置)';
            configSelect.appendChild(option);
        });
        if (currentConfigId) configSelect.value = currentConfigId;
    };

    const updateTitle = (name) => {
        appTitle.textContent = `nChat | ${name || '未命名配置'}`;
    };

    const loadConfigToUI = (id) => {
        const config = configList.find(c => c.id === id);
        if (!config) return;
        currentConfigId = id;
        currentSettings = { ...config };
        updateTitle(config.name);
        
        configNameInput.value = config.name || '';
        apiUrlInput.value = config.apiUrl || '';
        apiKeyInput.value = config.apiKey || '';
        modelIdInput.value = config.modelId || '';
        systemPromptInput.value = config.systemPrompt || '';
        tempInput.value = config.temperature ?? 1.0;
        tempSlider.value = config.temperature ?? 1.0;
        toppInput.value = config.top_p ?? 0.95;
        toppSlider.value = config.top_p ?? 0.95;

        if (config.enableAdvanced) {
            advancedSettingsContainer.classList.add('show');
            advancedToggleBtn.classList.add('expanded');
        } else {
            advancedSettingsContainer.classList.remove('show');
            advancedToggleBtn.classList.remove('expanded');
        }
    };

    const loadSettings = () => {
        const savedSettings = localStorage.getItem('nchat-settings');
        let loadedData = null;
        try { if (savedSettings) loadedData = JSON.parse(savedSettings); } catch (e) { console.error('Settings parse error', e); }
        
        if (!loadedData) {
            const def = createDefaultConfig();
            configList = [def];
            currentConfigId = def.id;
        } else if (!loadedData.configs) {
            const newConfig = createDefaultConfig();
            newConfig.name = '旧配置备份';
            newConfig.apiUrl = loadedData.apiUrl || newConfig.apiUrl;
            newConfig.apiKey = loadedData.apiKey || '';
            newConfig.modelId = loadedData.modelId || newConfig.modelId;
            newConfig.systemPrompt = loadedData.systemPrompt || '';
            configList = [newConfig];
            currentConfigId = newConfig.id;
            saveSettings();
        } else {
            configList = loadedData.configs;
            currentConfigId = loadedData.currentId;
            if (!configList.find(c => c.id === currentConfigId)) {
                currentConfigId = configList[0]?.id || createDefaultConfig().id;
                if (configList.length === 0) configList = [createDefaultConfig()];
            }
        }
        renderConfigSelect();
        loadConfigToUI(currentConfigId);
    };

    const saveSettings = () => {
        const updatedConfig = {
            id: currentConfigId,
            name: configNameInput.value.trim() || '未命名配置',
            apiUrl: apiUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            modelId: modelIdInput.value.trim(),
            systemPrompt: systemPromptInput.value.trim(),
            enableAdvanced: advancedSettingsContainer.classList.contains('show'),
            temperature: parseFloat(tempInput.value),
            top_p: parseFloat(toppInput.value)
        };
        const idx = configList.findIndex(c => c.id === currentConfigId);
        if (idx !== -1) configList[idx] = updatedConfig; else configList.push(updatedConfig);
        
        currentSettings = updatedConfig;
        renderConfigSelect();
        updateTitle(updatedConfig.name);
        
        localStorage.setItem('nchat-settings', JSON.stringify({
            currentId: currentConfigId,
            configs: configList
        }));
        
        saveStatus.style.opacity = '1';
        setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
    };

    const handleAddConfig = () => {
        const newConfig = createDefaultConfig();
        newConfig.name = '新配置 ' + (configList.length + 1);
        configList.push(newConfig);
        renderConfigSelect();
        configSelect.value = newConfig.id;
        loadConfigToUI(newConfig.id);
    };

    const handleDeleteConfig = async () => {
        if (configList.length <= 1) {
            showCustomPrompt('无法删除', '至少保留一个配置。');
            return;
        }
        const confirmed = await showCustomPrompt('删除配置', '确定要删除当前选中的配置吗？', { isConfirm: true, isDestructive: true });
        if (confirmed) {
            configList = configList.filter(c => c.id !== currentConfigId);
            currentConfigId = configList[0].id;
            renderConfigSelect();
            loadConfigToUI(currentConfigId);
            saveSettings();
        }
    };

    configSelect.addEventListener('change', (e) => {
        loadConfigToUI(e.target.value);
        saveSettings();
    });
    addConfigBtn.addEventListener('click', handleAddConfig);
    delConfigBtn.addEventListener('click', handleDeleteConfig);

    // --- Title Click Quick Switch ---
    const populateConfigDropdown = () => {
        configDropdownMenu.innerHTML = '';
        configList.forEach(config => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            if (config.id === currentConfigId) item.classList.add('active');
            item.textContent = config.name || '(未命名配置)';
            item.onclick = (e) => {
                e.stopPropagation();
                configSelect.value = config.id;
                loadConfigToUI(config.id);
                saveSettings();
                configDropdownMenu.classList.remove('show');
            };
            configDropdownMenu.appendChild(item);
        });
    };

    titleWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        if (configDropdownMenu.classList.contains('show')) {
            configDropdownMenu.classList.remove('show');
        } else {
            dropdownMenu.classList.remove('show');
            populateConfigDropdown();
            configDropdownMenu.classList.add('show');
        }
    });

    // --- Chat Logic ---
    const saveConversation = () => {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversationHistory));
    };

    const loadConversation = () => {
        const saved = localStorage.getItem(CONVERSATION_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    conversationHistory = parsed;
                    chatContainer.innerHTML = '';
                    conversationHistory.forEach(msg => {
                        if (msg.role === 'user') {
                            let html = '';
                            if (Array.isArray(msg.content)) {
                                const textPart = msg.content.find(p => p.type === 'text');
                                const text = textPart ? textPart.text : '';
                                html = text ? `<p>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : '';
                                const images = msg.content.filter(p => p.type === 'image_url');
                                if (images.length > 0) {
                                    html += `<div class="message-images">${images.map(img => ` <img src="${img.image_url.url}">`).join('')}</div>`;
                                }
                            } else {
                                html = msg.content;
                            }
                            addMessage({ id: msg.id, role: 'user', content: html, isHtml: true });
                        } else if (msg.role === 'assistant') {
                            addMessage({ id: msg.id, role: 'assistant', content: msg.content, reasoning: msg.reasoning, stats: msg.stats });
                        }
                    });
                    return true;
                }
            } catch (e) {
                console.error('Failed to load conversation:', e);
            }
        }
        return false;
    };

    const clearConversation = async () => {
        if (isAssistantResponding) return;
        const confirmed = await showCustomPrompt('清除对话', '确定要清除所有对话记录吗？', { isConfirm: true, confirmText: '清除', isDestructive: true });
        if (confirmed) {
            conversationHistory = []; chatContainer.innerHTML = '';
            localStorage.removeItem(CONVERSATION_STORAGE_KEY);
            addMessage({ role: 'assistant', content: '新对话已开始。' });
        }
    };

    const removeErrorMessages = () => {
        const errorMessages = chatContainer.querySelectorAll('.message.error');
        errorMessages.forEach(el => {
            const id = el.dataset.id;
            if (id) {
                conversationHistory = conversationHistory.filter(m => m.id !== id);
            }
            el.remove();
        });
    };

    const autoAdjustTextareaHeight = (el) => {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    };

    const handleDeleteMessage = id => {
        conversationHistory = conversationHistory.filter(msg => msg.id !== id);
        document.querySelector(`[data-id='${id}']`)?.remove();
    };

    const renderMessageContent = (content) => {
        marked.setOptions({ breaks: true, gfm: true });
        return DOMPurify.sanitize(marked.parse(content), { ADD_ATTR: ['target'] });
    };

    const enterEditMode = (messageElement, id) => {
        if (isAssistantResponding) return;
        const message = conversationHistory.find(m => m.id === id);
        if (!message) return;
        currentEditingMessageId = id;
        let originalText = '';
        if (message.role === 'user') {
            const textPart = message.content.find(p => p.type === 'text');
            originalText = textPart ? textPart.text : '';
        } else {
            originalText = message.content;
        }
        editModalTextarea.value = originalText;
        editModalOverlay.classList.add('show');
        editModalTextarea.focus();
        autoAdjustTextareaHeight(editModalTextarea);
    };

    const saveEdit = (id, newContent) => {
        const editIndex = conversationHistory.findIndex(msg => msg.id === id);
        if (editIndex === -1) return;
        const messageToUpdate = conversationHistory[editIndex];
        
        // Truncate history after this message for consistency
        const messagesToRemove = conversationHistory.slice(editIndex + 1);
        messagesToRemove.forEach(msg => document.querySelector(`[data-id='${msg.id}']`)?.remove());
        conversationHistory.splice(editIndex + 1);

        if (messageToUpdate.role === 'user') {
            const textPart = messageToUpdate.content.find(p => p.type === 'text');
            if (textPart) textPart.text = newContent; else messageToUpdate.content.unshift({ type: 'text', text: newContent });
            
            let html = `<p>${newContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
            const images = messageToUpdate.content.filter(p => p.type === 'image_url');
            if (images.length > 0) html += `<div class="message-images">${images.map(img => ` <img src="${img.image_url.url}">`).join('')}</div>`;
            
            document.querySelector(`[data-id='${id}'] .message-content`).innerHTML = html;
            fetchAssistantResponse();
        } else {
             // Should generally not happen as we regenerate assistant, but support direct edit
             messageToUpdate.content = newContent;
             document.querySelector(`[data-id='${id}'] .message-content`).innerHTML = renderMessageContent(newContent);
        }
    };
    
    const handleRegenerate = async (id) => {
        if (isAssistantResponding) return;
        removeErrorMessages(); // Remove error messages when regenerating
        const msgIndex = conversationHistory.findIndex(msg => msg.id === id);
        if (msgIndex === -1) return;
        const targetMsg = conversationHistory[msgIndex];

        if (targetMsg.role === 'user') {
            // Remove subsequent messages and re-fetch for this user message
            const messagesToRemove = conversationHistory.slice(msgIndex + 1);
            messagesToRemove.forEach(msg => document.querySelector(`[data-id='${msg.id}']`)?.remove());
            conversationHistory.splice(msgIndex + 1);
            fetchAssistantResponse();
        } else if (targetMsg.role === 'assistant') {
            // Remove this assistant message and any subsequent, then re-fetch
            const messagesToRemove = conversationHistory.slice(msgIndex);
            messagesToRemove.forEach(msg => document.querySelector(`[data-id='${msg.id}']`)?.remove());
            conversationHistory.splice(msgIndex);
            fetchAssistantResponse();
        }
    };

    const addMessage = (message) => {
        const { id, role, content, isHtml, stats, reasoning } = message;
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role);
        if (id) messageElement.dataset.id = id;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // If there's reasoning content, prepend it as a details element
        if (reasoning) {
            const details = document.createElement('details');
            details.innerHTML = `<summary>已思考</summary><div class="reasoning-wrapper"><div class="reasoning-content"></div></div>`;
            details.querySelector('.reasoning-content').innerHTML = renderMessageContent(reasoning);
            contentDiv.appendChild(details);
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.innerHTML = isHtml ? content : renderMessageContent(content);
        contentDiv.appendChild(contentWrapper);
        messageElement.appendChild(contentDiv);

        if (id && (role === 'user' || role === 'assistant')) {
            const footer = document.createElement('div');
            footer.className = 'message-footer';

            // Details Button (only for assistant messages with stats)
            if (role === 'assistant' && stats) {
                const detailsBtn = document.createElement('button');
                detailsBtn.className = 'footer-btn details-btn';
                detailsBtn.title = '详情';
                detailsBtn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
                    <div class="message-stats-tooltip">
                        <div class="stat-row"><span class="stat-label">Context:</span><span class="stat-value">${stats.contextLength || 0} tokens</span></div>
                        <div class="stat-row"><span class="stat-label">Output:</span><span class="stat-value">${stats.outputLength || 0} tokens</span></div>
                        <div class="stat-row"><span class="stat-label">Rate:</span><span class="stat-value">${stats.outputRate || 0} t/s</span></div>
                        ${stats.thinkingTime ? `<div class="stat-row"><span class="stat-label">Time:</span><span class="stat-value">${stats.thinkingTime}s</span></div>` : ''}
                    </div>
                `;
                footer.appendChild(detailsBtn);
            }

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'footer-btn';
            copyBtn.title = '复制';
            const copyIconDefault = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg>`;
            copyBtn.innerHTML = copyIconDefault;
            copyBtn.onclick = () => {
                const c = messageElement.querySelector('.message-content').cloneNode(true);
                c.querySelector('details')?.remove();
                copyTextToClipboard(c.innerText.trim()).then(() => {
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>`;
                    setTimeout(() => { copyBtn.innerHTML = copyIconDefault; }, 2000);
                });
            };

            // Regenerate Button
            const regenBtn = document.createElement('button');
            regenBtn.className = 'footer-btn';
            regenBtn.title = '重新生成';
            regenBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97-.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
            regenBtn.onclick = () => handleRegenerate(id);

            // Edit Button
            const editBtn = document.createElement('button');
            editBtn.className = 'footer-btn';
            editBtn.title = '编辑';
            editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>`;
            editBtn.onclick = () => enterEditMode(messageElement, id);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn delete-btn';
            deleteBtn.title = '删除';
            deleteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>`;
            deleteBtn.onclick = async () => {
                const confirmed = await showCustomPrompt('删除消息', '确定删除？', { isConfirm: true, confirmText: '删除', isDestructive: true });
                if (confirmed) handleDeleteMessage(id);
            };

            footer.appendChild(copyBtn);
            footer.appendChild(regenBtn);
            footer.appendChild(editBtn);
            footer.appendChild(deleteBtn);
            messageElement.appendChild(footer);
        }
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // If adding message while loading, disable buttons immediately
        if(isAssistantResponding) {
             messageElement.querySelectorAll('.footer-btn').forEach(btn => btn.disabled = true);
        }

        // Auto-save conversation after adding a message
        saveConversation();

        return messageElement;
    };

    const renderPreviews = () => {
        imagePreviewContainer.innerHTML = '';
        stagedImages.forEach(image => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `<img src="${image.dataUrl}" alt="Image preview"><button class="remove-image-btn" data-id="${image.id}">&times;</button>`;
            imagePreviewContainer.appendChild(item);
        });
    };

    imagePreviewContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-image-btn')) {
            stagedImages = stagedImages.filter(img => img.id != e.target.dataset.id);
            renderPreviews();
        }
    });
    uploadBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', e => {
        const files = Array.from(e.target.files);
        if (stagedImages.length + files.length > MAX_IMAGES) {
            showCustomPrompt('超限', `最多 ${MAX_IMAGES} 张图片。`);
            files.splice(MAX_IMAGES - stagedImages.length);
        }
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => stagedImages.push({ id: Date.now() + Math.random(), dataUrl: event.target.result }) && renderPreviews();
            reader.readAsDataURL(file);
        });
        imageInput.value = '';
    });
    
    const setInteractionState = (isProcessing) => {
        isAssistantResponding = isProcessing;
        // Buttons
        userInput.disabled = isProcessing;
        uploadBtn.disabled = isProcessing;
        // Chat history buttons
        document.querySelectorAll('.footer-btn').forEach(btn => btn.disabled = isProcessing);
        
        const sendIcon = sendBtn.querySelector('.send-icon');
        const stopIcon = sendBtn.querySelector('.stop-icon');
        
        if (isProcessing) {
            sendBtn.classList.add('stop-mode');
            sendBtn.title = "停止生成";
            sendIcon.style.display = 'none';
            stopIcon.style.display = 'block';
        } else {
            sendBtn.classList.remove('stop-mode');
            sendBtn.title = "发送";
            sendIcon.style.display = 'block';
            stopIcon.style.display = 'none';
        }
    };

    // Estimate token count (rough approximation: 1 token ≈ 4 characters for English, 1 token ≈ 1.5 characters for Chinese)
    const estimateTokens = (text) => {
        if (!text) return 0;
        // Count Chinese characters as 1 token each, and non-Chinese as 0.25 tokens per character
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const otherChars = text.length - chineseChars;
        return Math.ceil(chineseChars + otherChars / 4);
    };

    const fetchAssistantResponse = async () => {
        if (conversationHistory.length === 0) return;

        setInteractionState(true);
        abortController = new AbortController();

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        chatContainer.appendChild(typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        let assistantMessage = null, assistantMessageElement = null, finalContentElement = null;
        let reasoningText = '', reasoningContainer = null, reasoningSummaryElement = null;
        let thinkingStartTime = null, reasoningFinished = false;
        let outputTokenCount = 0;
        let startTime = null;
        let contextLength = 0;

        try {
            const historyToSend = conversationHistory.map(({ id, ...rest }) => rest);
            if (currentSettings.systemPrompt) historyToSend.unshift({ role: 'system', content: currentSettings.systemPrompt });

            // Calculate context length (approximate)
            contextLength = historyToSend.reduce((sum, msg) => {
                if (typeof msg.content === 'string') {
                    return sum + estimateTokens(msg.content);
                } else if (Array.isArray(msg.content)) {
                    return sum + msg.content.reduce((s, item) => {
                        if (item.type === 'text') return s + estimateTokens(item.text);
                        return s;
                    }, 0);
                }
                return sum;
            }, 0);

            const payload = {
                model: currentSettings.modelId,
                messages: historyToSend,
                stream: true,
                max_tokens: 4096
            };
            if (currentSettings.enableAdvanced) {
                payload.temperature = parseFloat(currentSettings.temperature);
                payload.top_p = parseFloat(currentSettings.top_p);
            }

            // URL Processing logic
            let fetchUrl = currentSettings.apiUrl.trim();
            // Remove trailing slash
            if (fetchUrl.endsWith('/')) fetchUrl = fetchUrl.slice(0, -1);
            // Automatically append /chat/completions if not present
            if (!fetchUrl.endsWith('/chat/completions')) {
                fetchUrl += '/chat/completions';
            }

            startTime = performance.now();
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSettings.apiKey}` },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            typingIndicator.remove();
            if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.substring(5).trimStart();
                    if (data === '[DONE]') break;
                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices[0]?.delta || {};

                        if (!assistantMessageElement && (delta.reasoning_content || delta.content)) {
                            assistantMessage = { id: Date.now(), role: 'assistant', content: '' };
                            assistantMessageElement = addMessage(assistantMessage);
                        }

                        if (delta.reasoning_content) {
                            if (!reasoningContainer) {
                                thinkingStartTime = performance.now();
                                const details = document.createElement('details');
                                details.innerHTML = `<summary>正在思考...</summary><div class="reasoning-wrapper"><div class="reasoning-content"></div></div>`;
                                assistantMessageElement.querySelector('.message-content').prepend(details);
                                reasoningSummaryElement = details.querySelector('summary');
                                reasoningContainer = details.querySelector('.reasoning-content');
                                details.open = true; // Auto open reasoning
                            }
                            reasoningText += delta.reasoning_content;
                            reasoningContainer.innerHTML = renderMessageContent(reasoningText);
                        }

                        if (delta.content) {
                            if (thinkingStartTime && !reasoningFinished) {
                                reasoningSummaryElement.textContent = `已思考 (用时 ${((performance.now() - thinkingStartTime)/1000).toFixed(1)}秒)`;
                                reasoningFinished = true;
                                assistantMessageElement.querySelector('details').open = false;
                            }
                            if (!finalContentElement) {
                                finalContentElement = document.createElement('div');
                                assistantMessageElement.querySelector('.message-content').appendChild(finalContentElement);
                            }
                            assistantMessage.content += delta.content;
                            outputTokenCount += estimateTokens(delta.content);
                            finalContentElement.innerHTML = renderMessageContent(assistantMessage.content);
                        }
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    } catch (e) { }
                }
            }
        } catch (error) {
            if (typingIndicator.parentNode) typingIndicator.remove();
            if (error.name === 'AbortError') {
                 if (!assistantMessage) addMessage({ role: 'assistant', content: '[已中断生成]' });
            } else {
                addMessage({ role: 'error', content: `请求失败: ${error.message}` });
            }
        } finally {
            if (assistantMessage) {
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000; // seconds
                const outputRate = duration > 0 ? (outputTokenCount / duration).toFixed(1) : 0;

                 const thinkingTime = thinkingStartTime ? ((performance.now() - thinkingStartTime) / 1000).toFixed(1) : 0;
                 const messageWithStats = {
                    id: assistantMessage.id,
                    role: 'assistant',
                    content: assistantMessage.content,
                    reasoning: reasoningText || null,
                    stats: {
                        contextLength,
                        outputLength: outputTokenCount,
                        outputRate: parseFloat(outputRate),
                        thinkingTime: parseFloat(thinkingTime)
                    }
                };

                // Update the existing message element with stats (don't remove and re-add)
                if (assistantMessageElement) {
                    // Add details button to the footer
                    const footer = assistantMessageElement.querySelector('.message-footer');
                    if (footer && !footer.querySelector('.details-btn')) {
                        const detailsBtn = document.createElement('button');
                        detailsBtn.className = 'footer-btn details-btn';
                        detailsBtn.title = '详情';
                        detailsBtn.innerHTML = `
                            <svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
                            <div class="message-stats-tooltip">
                                <div class="stat-row"><span class="stat-label">Context:</span><span class="stat-value">${contextLength} tokens</span></div>
                                <div class="stat-row"><span class="stat-label">Output:</span><span class="stat-value">${outputTokenCount} tokens</span></div>
                                <div class="stat-row"><span class="stat-label">Rate:</span><span class="stat-value">${outputRate} t/s</span></div>
                                ${thinkingTime > 0 ? `<div class="stat-row"><span class="stat-label">Thinking:</span><span class="stat-value">${thinkingTime}s</span></div>` : ''}
                            </div>
                        `;
                        footer.insertBefore(detailsBtn, footer.firstChild);
                    }
                }

                conversationHistory.push(messageWithStats);
                saveConversation(); // Save immediately after adding assistant message
            }
            setInteractionState(false);
            abortController = null;
            userInput.focus();
        }
    };

    const handleSendOrStop = () => {
        if (isAssistantResponding) {
            // Stop Logic
            if (abortController) abortController.abort();
            return;
        }

        // Remove error messages when sending new message
        removeErrorMessages();

        // Send Logic
        const userText = userInput.value.trim();
        if (!userText && stagedImages.length === 0) return;
        if (!currentSettings.apiKey || !currentSettings.apiUrl || !currentSettings.modelId) {
            addMessage({ role: 'error', content: '请先完成并保存 API 配置。' }); return;
        }

        const userMessageContent = [{ type: 'text', text: userText }];
        stagedImages.forEach(img => userMessageContent.push({ type: 'image_url', image_url: { url: img.dataUrl } }));

        let messageHtml = userText ? `<p>${userText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : '';
        if (stagedImages.length > 0) messageHtml += `<div class="message-images">${stagedImages.map(img => ` <img src="${img.dataUrl}">`).join('')}</div>`;

        const messageId = Date.now();
        conversationHistory.push({ id: messageId, role: 'user', content: userMessageContent });
        addMessage({ id: messageId, role: 'user', content: messageHtml, isHtml: true });

        userInput.value = ''; autoAdjustTextareaHeight(userInput);
        stagedImages = []; renderPreviews();
        fetchAssistantResponse();
    };

    // Global Click to Close Menus
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && (e.target.closest('.message-images') || e.target.closest('#image-preview-container'))) {
            if (e.target.closest('.remove-image-btn')) return;
            e.preventDefault(); imageLightbox.style.display = 'flex'; lightboxImg.src = e.target.src;
        }
        if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) dropdownMenu.classList.remove('show');
        if (!titleWrapper.contains(e.target) && !configDropdownMenu.contains(e.target)) configDropdownMenu.classList.remove('show');
    });
    
    lightboxClose.addEventListener('click', () => imageLightbox.style.display = 'none');
    imageLightbox.addEventListener('click', (e) => { if(e.target === imageLightbox) imageLightbox.style.display = 'none'; });
    
    const downloadBlob = (blob, filename) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); };
    
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenu.classList.toggle('show'); configDropdownMenu.classList.remove('show'); });
    
    exportSettingsBtn.addEventListener('click', () => downloadBlob(new Blob([JSON.stringify({ currentId: currentConfigId, configs: configList }, null, 2)], { type: 'application/json' }), 'nchat-settings.json'));
    
    exportConversationBtn.addEventListener('click', () => {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        const filename = `nchat_${timestamp}.md`;
        let md = `# nChat Conversation\n\n**Time:** ${new Date().toLocaleString()}\n\n---\n\n`;
        conversationHistory.forEach(msg => {
            const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
            let content = '';
            if (Array.isArray(msg.content)) {
                const txt = msg.content.find(i => i.type === 'text')?.text || '';
                const imgCount = msg.content.filter(i => i.type === 'image_url').length;
                content = txt + (imgCount ? `\n\n*[Sent ${imgCount} images]*` : '');
            } else content = msg.content;
            md += `## ${role}\n\n${content}\n\n---\n\n`;
        });

        downloadBlob(new Blob([md], { type: 'text/markdown' }), filename);
        dropdownMenu.classList.remove('show');
    });

    // Backup conversation to JSON file
    backupConversationBtn.addEventListener('click', () => {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        const filename = `nchat_backup_${timestamp}.json`;
        const backupData = {
            version: 1,
            timestamp: new Date().toISOString(),
            conversation: conversationHistory
        };
        downloadBlob(new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }), filename);
        dropdownMenu.classList.remove('show');
    });

    // Restore conversation from JSON file
    restoreConversationBtn.addEventListener('click', () => {
        restoreConversationInput.click();
        dropdownMenu.classList.remove('show');
    });

    restoreConversationInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.conversation && Array.isArray(data.conversation)) {
                    conversationHistory = data.conversation;
                    chatContainer.innerHTML = '';
                    conversationHistory.forEach(msg => {
                        if (msg.role === 'user') {
                            let html = '';
                            if (Array.isArray(msg.content)) {
                                const textPart = msg.content.find(p => p.type === 'text');
                                const text = textPart ? textPart.text : '';
                                html = text ? `<p>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : '';
                                const images = msg.content.filter(p => p.type === 'image_url');
                                if (images.length > 0) {
                                    html += `<div class="message-images">${images.map(img => ` <img src="${img.image_url.url}">`).join('')}</div>`;
                                }
                            } else {
                                html = msg.content;
                            }
                            addMessage({ id: msg.id, role: 'user', content: html, isHtml: true });
                        } else if (msg.role === 'assistant') {
                            addMessage({ id: msg.id, role: 'assistant', content: msg.content, reasoning: msg.reasoning, stats: msg.stats });
                        }
                    });
                    saveConversation();
                    showCustomPrompt('成功', '对话已恢复');
                } else {
                    showCustomPrompt('错误', '无效的备份文件格式');
                }
            } catch (err) {
                showCustomPrompt('错误', '无法解析备份文件');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    importSettingsBtn.addEventListener('click', () => importSettingsInput.click());
    importSettingsInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.configs) {
                    configList = data.configs; currentConfigId = data.currentId || configList[0]?.id;
                } else if (data.apiUrl) {
                     // Legacy/Single import
                     const c = createDefaultConfig(); Object.assign(c, data, {name: '导入配置'}); 
                     configList.push(c); currentConfigId = c.id;
                }
                renderConfigSelect(); loadConfigToUI(currentConfigId); saveSettings();
                showCustomPrompt('成功', '配置已导入');
            } catch (err) { showCustomPrompt('错误', '格式无效'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });
    
    const closeEditModal = () => { editModalOverlay.classList.remove('show'); currentEditingMessageId = null; };
    editModalSave.addEventListener('click', () => { if (currentEditingMessageId) saveEdit(currentEditingMessageId, editModalTextarea.value); closeEditModal(); });
    editModalCancel.addEventListener('click', closeEditModal);
    
    toggleSettingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('open'));
    saveSettingsBtn.addEventListener('click', saveSettings);
    clearChatBtn.addEventListener('click', () => { clearConversation(); dropdownMenu.classList.remove('show'); });
    
    sendBtn.addEventListener('click', handleSendOrStop);
    userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendOrStop(); } });
    userInput.addEventListener('input', () => autoAdjustTextareaHeight(userInput));
    
    loadSettings();
    // Try to load saved conversation, otherwise show welcome message
    const hasLoadedConversation = loadConversation();
    if (!hasLoadedConversation) {
        addMessage({ role: 'assistant', content: '你好，有什么可以帮你？' });
    }
});