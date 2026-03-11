const getEl = id => document.getElementById(id);

const generateId = () => Math.random().toString(36).substr(2, 9);

const copyTextToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
    }
};

const downloadBlob = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};

const autoAdjustTextareaHeight = (el) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

const adjustChatPadding = () => {
    const inputArea = document.getElementById('input-area-container');
    const chatContainer = document.getElementById('chat-container');
    if (inputArea && chatContainer) {
        chatContainer.style.paddingBottom = (inputArea.offsetHeight + 20) + 'px';
    }
};

const syncInputs = (range, number) => {
    range.addEventListener('input', () => number.value = range.value);
    number.addEventListener('input', () => range.value = number.value);
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getEl, generateId, copyTextToClipboard, downloadBlob, autoAdjustTextareaHeight, adjustChatPadding, syncInputs };
}
