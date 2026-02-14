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

let currentMatches = []; 

textInput.addEventListener('input', updateStats);

function updateStats() {
    const text = textInput.value;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    wordCount.textContent = words.length;
    charCount.textContent = text.length;
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    sentenceCount.textContent = sentences.length;
    const minutes = Math.ceil(words.length / 200);
    readTime.textContent = `${minutes} min`;
}

clearBtn.addEventListener('click', () => {
    textInput.value = '';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Stop speaking if clearing
    updateStats();
});

checkBtn.addEventListener('click', checkGrammar);

async function checkGrammar() {
    const text = textInput.value.trim();
    if (!text) return alert('Please enter some text!');
    
    loading.style.display = 'block';
    results.style.display = 'none';
    
    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        const data = await response.json();
        
        // Save matches and auto-select the first suggestion
        currentMatches = data.matches.map(match => ({
            ...match,
            chosenReplacement: match.replacements.length > 0 ? match.replacements[0].value : null
        }));
        
        displayResults(text);
    } catch (error) {
        alert('API Error. Please check your connection.');
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(originalText) {
    suggestionsList.innerHTML = '';
    
    if (currentMatches.length === 0) {
        suggestionsList.innerHTML = '<p style="color: #00b894; font-weight: 600;">✓ Perfect! No errors found.</p>';
    } else {
        currentMatches.forEach((match, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            
            let chipsHtml = '';
            if (match.replacements.length > 0) {
                chipsHtml = '<div class="replacement-chips">';
                match.replacements.slice(0, 5).forEach(rep => {
                    const isSelected = rep.value === match.chosenReplacement;
                    chipsHtml += `<span class="chip ${isSelected ? 'selected' : ''}" 
                                  onclick="selectReplacement(${index}, '${rep.value.replace(/'/g, "\\'")}')">
                                  ${rep.value}</span>`;
                });
                chipsHtml += '</div>';
            }

            suggestionItem.innerHTML = `
                <span class="suggestion-type">${match.rule.issueType.toUpperCase()}</span>
                <p><strong>Issue:</strong> ${match.message}</p>
                ${chipsHtml}
            `;
            suggestionsList.appendChild(suggestionItem);
        });
        renderCorrectedSection(originalText);
    }
    results.style.display = 'block';
}

function selectReplacement(index, val) {
    currentMatches[index].chosenReplacement = val;
    displayResults(textInput.value);
}

function renderCorrectedSection(originalText) {
    const correctedText = applySuggestions(originalText, currentMatches);
    const correctedSection = document.createElement('div');
    correctedSection.className = 'corrected-section';
    correctedSection.innerHTML = `
        <h3>✨ Final Result</h3>
        <div class="corrected-text-box" id="finalText">${correctedText}</div>
        <div class="action-buttons">
            <button id="speakBtn" class="btn-speak">🔊 Read Aloud</button>
            <button id="copyBtn" class="btn-copy">📋 Copy Text</button>
        </div>
    `;
    suggestionsList.appendChild(correctedSection);

    document.getElementById('copyBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(correctedText);
        document.getElementById('copyBtn').textContent = '✓ Copied!';
    });

    document.getElementById('speakBtn').addEventListener('click', () => {
        readAloud(correctedText);
    });
}

function readAloud(text) {
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for better clarity
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

function applySuggestions(text, matches) {
    let result = text;
    const sorted = [...matches].sort((a, b) => b.offset - a.offset);
    sorted.forEach(m => {
        if (m.chosenReplacement !== null) {
            result = result.substring(0, m.offset) + m.chosenReplacement + result.substring(m.offset + m.length);
        }
    });
    return result;
}

updateStats();
