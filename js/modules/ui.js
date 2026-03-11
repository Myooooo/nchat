let currentEditingMessageId = null;

const showCustomPrompt = (title, message, options = {}) => {
    const overlay = document.getElementById('custom-prompt-overlay');
    const titleEl = document.getElementById('custom-prompt-title');
    const messageEl = document.getElementById('custom-prompt-message');
    const confirmBtn = document.getElementById('custom-prompt-confirm');
    const cancelBtn = document.getElementById('custom-prompt-cancel');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    if (options.confirmText) confirmBtn.textContent = options.confirmText;
    if (options.cancelText) cancelBtn.textContent = options.cancelText;
    if (options.confirmClass) confirmBtn.className = options.confirmClass;
    
    overlay.classList.add('show');
    
    return new Promise((resolve) => {
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        const cleanup = () => {
            overlay.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    });
};

const enterEditMode = (messageElement, id, conversationHistory, renderMessageContent) => {
    currentEditingMessageId = id;
    const message = conversationHistory.find(m => m.id === id);
    if (!message) return;
    
    const overlay = document.getElementById('edit-modal-overlay');
    const textarea = document.getElementById('edit-modal-textarea');
    
    let content = '';
    if (Array.isArray(message.content)) {
        content = message.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
    } else {
        content = message.content;
    }
    
    textarea.value = content;
    overlay.classList.add('show');
    textarea.focus();
};

const closeEditModal = () => {
    const overlay = document.getElementById('edit-modal-overlay');
    overlay.classList.remove('show');
    currentEditingMessageId = null;
};

const saveEdit = async (id, newContent, conversationHistory, saveSettings, addMessage, renderMessageContent, fetchAssistantResponse) => {
    const index = conversationHistory.findIndex(m => m.id === id);
    if (index === -1) return;
    
    const message = conversationHistory[index];
    
    if (Array.isArray(message.content)) {
        const textIndex = message.content.findIndex(item => item.type === 'text');
        if (textIndex !== -1) {
            message.content[textIndex].text = newContent;
        }
    } else {
        message.content = newContent;
    }
    
    conversationHistory.splice(index + 1);
    
    const messageEl = document.querySelector(`.message[data-id="${id}"]`);
    if (messageEl) {
        const contentEl = messageEl.querySelector('.message-content');
        contentEl.innerHTML = renderMessageContent(message.content);
    }
    
    const followingMessages = document.querySelectorAll(`.message[data-id]`);
    followingMessages.forEach(el => {
        const msgId = el.dataset.id;
        const msgIndex = conversationHistory.findIndex(m => m.id === msgId);
        if (msgIndex > index) {
            el.remove();
        }
    });
    
    saveSettings();
    closeEditModal();
    
    await fetchAssistantResponse();
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showCustomPrompt, enterEditMode, closeEditModal, saveEdit, currentEditingMessageId };
}
