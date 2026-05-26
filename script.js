const textInput = document.getElementById('textInput');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const copyInputBtn = document.getElementById('copyInputBtn');
const themeToggle = document.getElementById('themeToggle');
const results = document.getElementById('results');
const suggestionsList = document.getElementById('suggestionsList');
const loading = document.getElementById('loading');
const languageSelect = document.getElementById('languageSelect');
const autoCheck = document.getElementById('autoCheck');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const sentenceCount = document.getElementById('sentenceCount');
const readTime = document.getElementById('readTime');
const vocabScore = document.getElementById('vocabScore');
const readabilityScore = document.getElementById('readabilityScore');

let currentMatches = []; 
let debounceTimer;

// Theme Toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
});

textInput.addEventListener('input', () => {
    updateStats();
    if (autoCheck.checked) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            checkGrammar();
        }, 1500);
    }
});

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

        // Readability Score (Flesch Reading Ease)
        const sents = sentences.length || 1;
        const totalSyllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
        const fscore = 206.835 - 1.015 * (words.length / sents) - 84.6 * (totalSyllables / words.length);
        readabilityScore.textContent = Math.max(0, Math.min(100, Math.round(fscore)));
    } else {
        vocabScore.textContent = '0%';
        readabilityScore.textContent = '0';
    }
}

function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
}

clearBtn.addEventListener('click', () => {
    textInput.value = '';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Safety stop
    updateStats();
});

copyInputBtn.addEventListener('click', () => {
    if (!textInput.value) return;
    navigator.clipboard.writeText(textInput.value);
    const originalText = copyInputBtn.textContent;
    copyInputBtn.textContent = '✓ Copied!';
    setTimeout(() => copyInputBtn.textContent = originalText, 2000);
});

checkBtn.addEventListener('click', checkGrammar);

async function checkGrammar() {
    const text = textInput.value.trim();
    if (!text) return alert('Please enter some text!');
    
    loading.style.display = 'block';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Stop speech if starting new check
    
    try {
        const language = languageSelect.value;
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=${language}`
        });
        const data = await response.json();
        
        currentMatches = data.matches.map(match => ({
            ...match,
            chosenReplacement: null
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
            const type = match.rule.issueType || 'other';
            suggestionItem.className = `suggestion-item ${type}`;
            
            let chipsHtml = '';
            if (match.replacements.length > 0) {
                chipsHtml = '<div class="replacement-chips">';
                match.replacements.slice(0, 5).forEach((rep, idx) => {
                    const isSelected = (match.chosenReplacement === rep.value) || (!match.chosenReplacement && idx === 0);
                    chipsHtml += `<span class="chip ${isSelected ? 'selected' : ''}" 
                                  onclick="selectReplacement(${index}, '${rep.value.replace(/'/g, "\\'")}')">
                                  ${rep.value}</span>`;
                });
                chipsHtml += '</div>';
            }

            suggestionItem.innerHTML = `
                <span class="suggestion-type" style="color:#667eea; font-weight:bold;">${(match.rule.issueType || 'suggestion').toUpperCase()}</span>
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
    const hasSecondOption = currentMatches.some(m => m.replacements.length > 1);

    const option1Text = applySuggestions(originalText, currentMatches, 0);
    const option2Text = hasSecondOption ? applySuggestions(originalText, currentMatches, 1) : "";

    let summaryHtml = `
        <div class="summary-section">
            <h3>📝 Fix Summary</h3>
            <ul class="summary-list">
    `;

    currentMatches.forEach(m => {
        const original = originalText.substring(m.offset, m.offset + m.length);
        const corrected = m.chosenReplacement || (m.replacements.length > 0 ? m.replacements[0].value : "(removed)");
        summaryHtml += `
            <li class="summary-item">
                <span class="original-text">${original}</span>
                <span class="arrow">→</span>
                <span class="corrected-text">${corrected}</span>
            </li>`;
    });
    summaryHtml += `</ul></div>`;

    const correctedSection = document.createElement('div');
    correctedSection.className = 'corrected-section';
    correctedSection.innerHTML = `
        <div class="options-grid">
            <div class="option-box">
                <h3>✨ Option 1</h3>
                <div class="finalText" style="white-space: pre-wrap; margin: 10px 0; line-height: 1.6; color: var(--text-main);">${option1Text}</div>
                <div class="action-buttons">
                    <button id="copyBtn1" class="btn-copy">📋 Copy Option 1</button>
                </div>
            </div>
            ${hasSecondOption ? `
            <div class="option-box">
                <h3>✨ Option 2</h3>
                <div class="finalText" style="white-space: pre-wrap; margin: 10px 0; line-height: 1.6; color: var(--text-main);">${option2Text}</div>
                <div class="action-buttons">
                    <button id="copyBtn2" class="btn-copy">📋 Copy Option 2</button>
                </div>
            </div>` : ''}
        </div>

        <div class="action-buttons secondary-actions">
            <button id="speakBtn" class="btn-speak">🔊 Read Aloud (Opt 1)</button>
            <button id="stopBtn" class="btn-stop">⏹ Stop</button>
            <button id="downloadBtn" class="btn-download">💾 Download .txt</button>
        </div>
        ${summaryHtml}
    `;
    suggestionsList.appendChild(correctedSection);

    document.getElementById('copyBtn1').addEventListener('click', () => {
        navigator.clipboard.writeText(option1Text);
        document.getElementById('copyBtn1').textContent = '✓ Copied!';
        setTimeout(() => document.getElementById('copyBtn1').textContent = '📋 Copy Option 1', 2000);
    });

    if (hasSecondOption) {
        document.getElementById('copyBtn2').addEventListener('click', () => {
            navigator.clipboard.writeText(option2Text);
            document.getElementById('copyBtn2').textContent = '✓ Copied!';
            setTimeout(() => document.getElementById('copyBtn2').textContent = '📋 Copy Option 2', 2000);
        });
    }

    document.getElementById('speakBtn').addEventListener('click', () => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(option1Text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    });

    document.getElementById('stopBtn').addEventListener('click', () => {
        window.speechSynthesis.cancel();
    });

    document.getElementById('downloadBtn').addEventListener('click', () => {
        const element = document.createElement('a');
        const content = `OPTION 1:\n${option1Text}\n\n${hasSecondOption ? `OPTION 2:\n${option2Text}\n\n` : ''}SUMMARY:\n${currentMatches.map(m => `${originalText.substring(m.offset, m.offset + m.length)} -> ${m.chosenReplacement || (m.replacements.length > 0 ? m.replacements[0].value : "(removed)")}`).join('\n')}`;
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = 'corrected_text.txt';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    });
}

function applySuggestions(text, matches, replacementIndex = 0) {
    let result = text;
    const sorted = [...matches].sort((a, b) => b.offset - a.offset);
    sorted.forEach(m => {
        let replacement = m.chosenReplacement;

        // If no manual choice, use the replacement at the specified index
        if (replacement === null && m.replacements && m.replacements.length > 0) {
            const idx = (replacementIndex < m.replacements.length) ? replacementIndex : 0;
            replacement = m.replacements[idx].value;
        }

        if (replacement !== null) {
            result = result.substring(0, m.offset) + replacement + result.substring(m.offset + m.length);
        }
    });
    return result;
}

updateStats();
