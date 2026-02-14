const textInput = document.getElementById('textInput');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const themeToggle = document.getElementById('themeToggle');
const results = document.getElementById('results');
const suggestionsList = document.getElementById('suggestionsList');
const loading = document.getElementById('loading');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const sentenceCount = document.getElementById('sentenceCount');
const readTime = document.getElementById('readTime');
const vocabScore = document.getElementById('vocabScore');

let currentMatches = []; 

// Theme Toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
});

textInput.addEventListener('input', updateStats);

function updateStats() {
    const text = textInput.value;
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    wordCount.textContent = words.length;
    charCount.textContent = text.length;
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    sentenceCount.textContent = sentences.length;
    const minutes = Math.ceil(words.length / 200);
    readTime.textContent = `${minutes} min`;

    if (words.length > 0) {
        const uniqueWords = new Set(words).size;
        const score = Math.round((uniqueWords / words.length) * 100);
        vocabScore.textContent = `${score}%`;
    } else {
        vocabScore.textContent = '0%';
    }
}

clearBtn.addEventListener('click', () => {
    textInput.value = '';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Safety stop
    updateStats();
});

checkBtn.addEventListener('click', checkGrammar);

async function checkGrammar() {
    const text = textInput.value.trim();
    if (!text) return alert('Please enter some text!');
    
    loading.style.display = 'block';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Stop speech if starting new check
    
    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        const data = await response.json();
        
        currentMatches = data.matches.map(match => ({
            ...match,
            chosenReplacement: match.replacements.length > 0 ? match.replacements[0].value : null
        }));
        
        displayResults(text);
    } catch (error) {
        alert('Check failed. Try again later.');
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(originalText) {
    suggestionsList.innerHTML = '';
    
    if (currentMatches.length === 0) {
        suggestionsList.innerHTML = '<p style="color: #00b894; font-weight: 600;">✓ Looking good! No errors.</p>';
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
                <span class="suggestion-type" style="color:#667eea; font-weight:bold;">${match.rule.issueType.toUpperCase()}</span>
                <p style="margin: 5px 0;"><strong>Issue:</strong> ${match.message}</p>
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
        <div id="finalText" style="white-space: pre-wrap; margin: 10px 0; line-height: 1.6; color: var(--text-main);">${correctedText}</div>
        <div class="action-buttons">
            <button id="speakBtn" class="btn-speak">🔊 Read Aloud</button>
            <button id="stopBtn" class="btn-stop">⏹ Stop</button>
            <button id="copyBtn" class="btn-copy">📋 Copy Text</button>
        </div>
    `;
    suggestionsList.appendChild(correctedSection);

    document.getElementById('copyBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(correctedText);
        document.getElementById('copyBtn').textContent = '✓ Copied!';
        setTimeout(() => document.getElementById('copyBtn').textContent = '📋 Copy Text', 2000);
    });

    document.getElementById('speakBtn').addEventListener('click', () => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(correctedText);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    });

    // NEW STOP BUTTON LOGIC
    document.getElementById('stopBtn').addEventListener('click', () => {
        window.speechSynthesis.cancel();
    });
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
