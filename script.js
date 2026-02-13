const textInput = document.getElementById('textInput');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const suggestionsList = document.getElementById('suggestionsList');
const loading = document.getElementById('loading');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const sentenceCount = document.getElementById('sentenceCount');
const readTime = document.getElementById('readTime');

// Update statistics in real-time
textInput.addEventListener('input', updateStats);

function updateStats() {
    const text = textInput.value;
    
    // Word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    wordCount.textContent = words.length;
    
    // Character count
    charCount.textContent = text.length;
    
    // Sentence count
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    sentenceCount.textContent = sentences.length;
    
    // Reading time (average 200 words per minute)
    const minutes = Math.ceil(words.length / 200);
    readTime.textContent = `${minutes} min`;
}

// Clear button
clearBtn.addEventListener('click', () => {
    textInput.value = '';
    results.style.display = 'none';
    updateStats();
});

// Check grammar button
checkBtn.addEventListener('click', checkGrammar);

async function checkGrammar() {
    const text = textInput.value.trim();
    
    if (!text) {
        alert('Please enter some text to check!');
        return;
    }
    
    loading.style.display = 'block';
    results.style.display = 'none';
    
    try {
        // Using LanguageTool API (free, open-source)
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        
        const data = await response.json();
        displayResults(data.matches, text);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error checking grammar. Please try again.');
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(matches, originalText) {
    suggestionsList.innerHTML = '';
    
    if (matches.length === 0) {
        suggestionsList.innerHTML = '<p style="color: #00b894; font-weight: 600;">✓ No grammar issues found! Your text looks great.</p>';
    } else {
        matches.forEach(match => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            
            const type = getCategoryType(match.rule.issueType);
            
            suggestionItem.innerHTML = `
                <span class="suggestion-type type-${type}">${type.toUpperCase()}</span>
                <p class="suggestion-text">
                    <strong>Issue:</strong> ${match.message}
                </p>
                ${match.replacements.length > 0 ? `
                    <p class="suggestion-correction">
                        ✓ Suggestion: ${match.replacements[0].value}
                    </p>
                ` : ''}
                <p style="color: #999; font-size: 14px; margin-top: 8px;">
                    Context: "${match.context.text}"
                </p>
            `;
            
            suggestionsList.appendChild(suggestionItem);
        });

        // ADD CORRECTED TEXT SECTION
        const correctedText = applySuggestions(originalText, matches);
        
        const correctedSection = document.createElement('div');
        correctedSection.className = 'corrected-section';
        correctedSection.innerHTML = `
            <h3>✨ Corrected Text</h3>
            <div class="corrected-text-box">
                <p>${correctedText}</p>
            </div>
            <button id="copyBtn" class="btn-copy">📋 Copy Corrected Text</button>
        `;
        
        suggestionsList.appendChild(correctedSection);
        
        // Add copy functionality
        document.getElementById('copyBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(correctedText).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.textContent = '✓ Copied!';
                btn.style.background = '#00b894';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Corrected Text';
                    btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                }, 2000);
            });
        });
    }
    
    results.style.display = 'block';
}

function applySuggestions(text, matches) {
    // Sort matches by offset in descending order to avoid index issues
    const sortedMatches = matches.slice().sort((a, b) => b.offset - a.offset);
    
    let correctedText = text;
    
    sortedMatches.forEach(match => {
        if (match.replacements.length > 0) {
            const offset = match.offset;
            const length = match.length;
            const replacement = match.replacements[0].value;
            
            correctedText = 
                correctedText.substring(0, offset) + 
                replacement + 
                correctedText.substring(offset + length);
        }
    });
    
    return correctedText;
}

function getCategoryType(issueType) {
    const typeMap = {
        'misspelling': 'spelling',
        'typographical': 'spelling',
        'grammar': 'grammar',
        'style': 'style',
        'uncategorized': 'grammar'
    };
    return typeMap[issueType] || 'grammar';
}

// Initialize stats
updateStats();
