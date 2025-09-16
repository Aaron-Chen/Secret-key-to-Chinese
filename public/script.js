document.addEventListener('DOMContentLoaded', function() {
    const svg = document.querySelector('.connection-lines');
    const boxes = document.querySelectorAll('[data-box]');
    const reverseBoxes = document.querySelectorAll('[data-reverse-box]');
    const inputBox = document.querySelector('#key-input');
    const reverseInputBox = document.querySelector('#reverse-key-input');
    const container = document.querySelector('.container');
    
    let conversionTimeout;
    
    function createBezierCurves() {
        svg.innerHTML = '';
        
        const containerRect = container.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        if (inputBox && boxes.length > 0) {
            const inputRect = inputBox.getBoundingClientRect();
            
            const inputCenterX = (inputRect.left + inputRect.width / 2 - svgRect.left) / svgRect.width * 100;
            const inputBottomY = (inputRect.bottom - svgRect.top) / svgRect.height * 100;
            
            boxes.forEach((box, index) => {
                const boxRect = box.getBoundingClientRect();
                
                const boxCenterX = (boxRect.left + boxRect.width / 2 - svgRect.left) / svgRect.width * 100;
                const boxTopY = (boxRect.top - svgRect.top) / svgRect.height * 100;
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                const midY = (inputBottomY + boxTopY) / 2;
                const controlPoint1Y = inputBottomY + (midY - inputBottomY) * 0.3;
                const controlPoint2Y = boxTopY - (boxTopY - midY) * 0.3;
                
                const pathData = `M ${inputCenterX} ${inputBottomY} C ${inputCenterX} ${controlPoint1Y} ${boxCenterX} ${controlPoint2Y} ${boxCenterX} ${boxTopY}`;
                
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', 'white');
                path.setAttribute('stroke-width', '0.15');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.8');
                
                svg.appendChild(path);
            });
        }
        
        if (reverseInputBox && reverseBoxes.length > 0) {
            const reverseInputRect = reverseInputBox.getBoundingClientRect();
            
            const reverseInputCenterX = (reverseInputRect.left + reverseInputRect.width / 2 - svgRect.left) / svgRect.width * 100;
            const reverseInputTopY = (reverseInputRect.top - svgRect.top) / svgRect.height * 100;
            
            reverseBoxes.forEach((box, index) => {
                const boxRect = box.getBoundingClientRect();
                
                const boxCenterX = (boxRect.left + boxRect.width / 2 - svgRect.left) / svgRect.width * 100;
                const boxBottomY = (boxRect.bottom - svgRect.top) / svgRect.height * 100;
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                const midY = (reverseInputTopY + boxBottomY) / 2;
                const controlPoint1Y = boxBottomY - (boxBottomY - midY) * 0.3;
                const controlPoint2Y = reverseInputTopY + (midY - reverseInputTopY) * 0.3;
                
                const pathData = `M ${boxCenterX} ${boxBottomY} C ${boxCenterX} ${controlPoint1Y} ${reverseInputCenterX} ${controlPoint2Y} ${reverseInputCenterX} ${reverseInputTopY}`;
                
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', 'white');
                path.setAttribute('stroke-width', '0.15');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.8');
                
                svg.appendChild(path);
            });
        }
    }
    
    function clearBoxes() {
        boxes.forEach(box => {
            box.textContent = '';
        });
    }
    
    async function convertBitcoinKey() {
        const privateKey = inputBox.value.trim();
        
        if (!privateKey) {
            clearBoxes();
            return;
        }
        
        try {
            const response = await fetch('/api/convert-bitcoin-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ privateKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const chineseWords = data.chineseMnemonic.split(' ');
                
                boxes.forEach((box, index) => {
                    if (chineseWords[index]) {
                        box.textContent = chineseWords[index];
                    } else {
                        box.textContent = '';
                    }
                });
            } else {
                clearBoxes();
            }
        } catch (error) {
            console.error('Error:', error);
            clearBoxes();
        }
    }
    
    function debouncedConvert() {
        clearTimeout(conversionTimeout);
        conversionTimeout = setTimeout(convertBitcoinKey, 500);
    }
    
    inputBox.addEventListener('input', debouncedConvert);
    inputBox.addEventListener('paste', function() {
        setTimeout(debouncedConvert, 100);
    });
    
    const copyButton = document.getElementById('copy-button');
    
    copyButton.addEventListener('click', async function() {
        const chineseWords = Array.from(boxes).map(box => box.textContent).filter(word => word.trim() !== '');
        if (chineseWords.length === 0) {
            alert('No mnemonic to copy');
            return;
        }
        
        const mnemonicText = chineseWords.join(' ');
        try {
            await navigator.clipboard.writeText(mnemonicText);
            copyButton.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
            setTimeout(() => {
                copyButton.style.backgroundColor = 'black';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        }
    });
    
    const reversePasteButton = document.getElementById('reverse-paste-button');
    
    reversePasteButton.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                reverseBoxes.forEach(box => box.textContent = '');
                
                const chineseWords = text.trim().split(' ');
                reverseBoxes.forEach((box, index) => {
                    if (chineseWords[index]) {
                        box.textContent = chineseWords[index];
                    }
                });
                
                convertMnemonicToKey(text.trim());
            }
        } catch (err) {
            console.error('Failed to paste: ', err);
            alert('Failed to paste from clipboard');
        }
    });
    
    async function convertMnemonicToKey(mnemonic) {
        try {
            const response = await fetch('/api/convert-bitcoin-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ privateKey: mnemonic })
            });
            
            const data = await response.json();
            
            if (data.success && data.inputType === 'chinese_mnemonic') {
                reverseInputBox.value = data.privateKey;
            } else {
                reverseInputBox.value = 'Error: Invalid mnemonic';
            }
        } catch (error) {
            console.error('Error:', error);
            reverseInputBox.value = 'Error: Conversion failed';
        }
    }

    reverseBoxes.forEach(box => {
        box.addEventListener('input', function() {
            if (this.textContent.length > 1) {
                this.textContent = this.textContent.slice(0, 1);
            }
            
            convertReverseMnemonic();
        });
        
        box.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
            }
        });
    });
    
    function convertReverseMnemonic() {
        const chineseWords = Array.from(reverseBoxes).map(box => box.textContent.trim()).filter(word => word !== '');
        if (chineseWords.length > 0) {
            const mnemonicText = chineseWords.join(' ');
            convertMnemonicToKey(mnemonicText);
        }
    }

    setTimeout(createBezierCurves, 100);
    window.addEventListener('resize', createBezierCurves);
});