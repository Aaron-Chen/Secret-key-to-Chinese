document.addEventListener('DOMContentLoaded', function() {
    const svg = document.querySelector('.connection-lines');
    const boxes = document.querySelectorAll('[data-box]');
    const reverseBoxes = document.querySelectorAll('[data-reverse-box]');
    const inputBox = document.querySelector('#key-input');
    const reverseInputBox = document.querySelector('#reverse-key-input');
    const container = document.querySelector('.container');
    
    let conversionTimeout;
    
    function createBezierCurves() {
        // Clear existing paths
        svg.innerHTML = '';
        
        // Get container and SVG dimensions
        const containerRect = container.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        // TOP-LEFT SECTION: Input box to mnemonic boxes
        if (inputBox && boxes.length > 0) {
            const inputRect = inputBox.getBoundingClientRect();
            
            // Calculate the convergence point - bottom center of the input box
            const inputCenterX = (inputRect.left + inputRect.width / 2 - svgRect.left) / svgRect.width * 100;
            const inputBottomY = (inputRect.bottom - svgRect.top) / svgRect.height * 100;
            
            boxes.forEach((box, index) => {
                const boxRect = box.getBoundingClientRect();
                
                // Calculate box position relative to SVG
                const boxCenterX = (boxRect.left + boxRect.width / 2 - svgRect.left) / svgRect.width * 100;
                const boxTopY = (boxRect.top - svgRect.top) / svgRect.height * 100;
                
                // Create Bezier curve path
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Control points for a smooth Bezier curve that converges at the bottom center of the input box
                const midY = (inputBottomY + boxTopY) / 2;
                const controlPoint1Y = inputBottomY + (midY - inputBottomY) * 0.3;
                const controlPoint2Y = boxTopY - (boxTopY - midY) * 0.3;
                
                // All lines start from the same convergence point at the bottom center of the input box
                const pathData = `M ${inputCenterX} ${inputBottomY} C ${inputCenterX} ${controlPoint1Y} ${boxCenterX} ${controlPoint2Y} ${boxCenterX} ${boxTopY}`;
                
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', 'white');
                path.setAttribute('stroke-width', '0.15');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.8');
                
                svg.appendChild(path);
            });
        }
        
        // BOTTOM-RIGHT SECTION: Mnemonic boxes to output box
        if (reverseInputBox && reverseBoxes.length > 0) {
            const reverseInputRect = reverseInputBox.getBoundingClientRect();
            
            // Calculate the convergence point - top center of the reverse input box
            const reverseInputCenterX = (reverseInputRect.left + reverseInputRect.width / 2 - svgRect.left) / svgRect.width * 100;
            const reverseInputTopY = (reverseInputRect.top - svgRect.top) / svgRect.height * 100;
            
            reverseBoxes.forEach((box, index) => {
                const boxRect = box.getBoundingClientRect();
                
                // Calculate box position relative to SVG
                const boxCenterX = (boxRect.left + boxRect.width / 2 - svgRect.left) / svgRect.width * 100;
                const boxBottomY = (boxRect.bottom - svgRect.top) / svgRect.height * 100;
                
                // Create Bezier curve path
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Control points for a smooth Bezier curve that converges at the top center of the reverse input box
                const midY = (reverseInputTopY + boxBottomY) / 2;
                const controlPoint1Y = boxBottomY - (boxBottomY - midY) * 0.3;
                const controlPoint2Y = reverseInputTopY + (midY - reverseInputTopY) * 0.3;
                
                // All lines start from the boxes and converge at the top center of the reverse input box
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
    
    // Clear all boxes
    function clearBoxes() {
        boxes.forEach(box => {
            box.textContent = '';
        });
    }
    
    // Handle automatic Bitcoin private key conversion
    async function convertBitcoinKey() {
        const privateKey = inputBox.value.trim();
        
        // Clear boxes if no input
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
                // Split Chinese mnemonic into words and display in boxes
                const chineseWords = data.chineseMnemonic.split(' ');
                
                boxes.forEach((box, index) => {
                    if (chineseWords[index]) {
                        box.textContent = chineseWords[index];
                    } else {
                        box.textContent = '';
                    }
                });
            } else {
                // Clear boxes on error
                clearBoxes();
            }
        } catch (error) {
            console.error('Error:', error);
            clearBoxes();
        }
    }
    
    // Debounced conversion function
    function debouncedConvert() {
        clearTimeout(conversionTimeout);
        conversionTimeout = setTimeout(convertBitcoinKey, 500); // Wait 500ms after user stops typing
    }
    
    // Add event listeners for automatic conversion
    inputBox.addEventListener('input', debouncedConvert);
    inputBox.addEventListener('paste', function() {
        setTimeout(debouncedConvert, 100); // Small delay to ensure paste content is processed
    });
    
    // Copy functionality for top-left section
    const copyButton = document.getElementById('copy-button');
    
    // Copy mnemonic to clipboard
    copyButton.addEventListener('click', async function() {
        const chineseWords = Array.from(boxes).map(box => box.textContent).filter(word => word.trim() !== '');
        if (chineseWords.length === 0) {
            alert('No mnemonic to copy');
            return;
        }
        
        const mnemonicText = chineseWords.join(' ');
        try {
            await navigator.clipboard.writeText(mnemonicText);
            // Visual feedback
            copyButton.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
            setTimeout(() => {
                copyButton.style.backgroundColor = 'black';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        }
    });
    
    // Reverse section functionality
    const reversePasteButton = document.getElementById('reverse-paste-button');
    
    // Paste mnemonic to reverse section
    reversePasteButton.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                // Clear reverse boxes first
                reverseBoxes.forEach(box => box.textContent = '');
                
                // Split and populate reverse boxes
                const chineseWords = text.trim().split(' ');
                reverseBoxes.forEach((box, index) => {
                    if (chineseWords[index]) {
                        box.textContent = chineseWords[index];
                    }
                });
                
                // Convert mnemonic back to private key
                convertMnemonicToKey(text.trim());
            }
        } catch (err) {
            console.error('Failed to paste: ', err);
            alert('Failed to paste from clipboard');
        }
    });
    
    // Function to convert mnemonic back to private key
    async function convertMnemonicToKey(mnemonic) {
        try {
            // Use the unified API endpoint with the mnemonic as input
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

    // Add event listeners for editable boxes
    reverseBoxes.forEach(box => {
        box.addEventListener('input', function() {
            // Limit to single character
            if (this.textContent.length > 1) {
                this.textContent = this.textContent.slice(0, 1);
            }
            
            // Trigger conversion when any box is edited
            convertReverseMnemonic();
        });
        
        box.addEventListener('keydown', function(e) {
            // Prevent line breaks and multiple characters
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
            }
        });
    });
    
    // Function to convert mnemonic from editable boxes
    function convertReverseMnemonic() {
        const chineseWords = Array.from(reverseBoxes).map(box => box.textContent.trim()).filter(word => word !== '');
        if (chineseWords.length > 0) {
            const mnemonicText = chineseWords.join(' ');
            convertMnemonicToKey(mnemonicText);
        }
    }

    // Create curves on load and resize
    setTimeout(createBezierCurves, 100); // Small delay to ensure layout is complete
    window.addEventListener('resize', createBezierCurves);
});